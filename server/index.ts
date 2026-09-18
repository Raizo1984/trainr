/**
 * Backend voor Trainr.
 *
 * Doet twee dingen: de gebouwde app uitserveren, en `/api/coach` aanbieden als
 * doorgeefluik naar OpenAI. De API-sleutel staat uitsluitend hier. Hij komt
 * nooit in de browser, want alles wat de browser kent kan iedere bezoeker met
 * de ontwikkelaarsconsole uitlezen.
 *
 * De provider zit alleen in deze map. De adaptieve planner, de veiligheidspoort
 * en de contextopbouw staan in `src/domain` en weten niets van OpenAI: een
 * andere provider is een wijziging in `server/`, niet in de app.
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import type { Response } from 'express'
import OpenAI from 'openai'
import { COACH_SYSTEM } from './prompt.ts'
import { ADJUSTMENT_TOOL } from './tools.ts'
import { parseCoachResponse } from './parse.ts'
import { COMPLAINT_SYSTEM, COMPLAINT_TOOL, COMPLAINT_TOOL_NAME, parseComplaintArguments } from './complaint.ts'
import { REPORT_SYSTEM } from './report.ts'
import cookieParser from 'cookie-parser'
import { accountRoutes, startOpruimen } from './routes-account.ts'
import { beschikbaar as databaseBeschikbaar, migreer } from './db.ts'
import type { NextFunction, Request } from 'express'
import { type Bon, boekTokens, grensVoor, magHet, noteerVerzoek } from './verbruik.ts'

const here = path.dirname(fileURLToPath(import.meta.url))
const app = express()

// Het profiel plus de recente historie is ruim, maar niet onbeperkt: zonder
// grens kan iemand de server als generiek doorgeefluik naar OpenAI gebruiken.
/*
 * De grens op de body staat er om te voorkomen dat iemand de server als
 * generiek doorgeefluik naar OpenAI gebruikt. Het opslaan van je eigen log is
 * de uitzondering: vier jaar trainen is al gauw een paar megabyte, en dan zou
 * opslaan stilletjes stuklopen bij precies de gebruiker die er het langst mee
 * werkt. Die route zet daarom verderop zijn eigen, ruimere grens.
 *
 * De volgorde is hier het punt: een tweede parser op de route zelf zou nooit
 * aan bod komen, want deze heeft de body dan al gelezen of geweigerd.
 */
const STAAT_PAD = '/api/account/staat'
const gewoneJson = express.json({ limit: '1mb' })
app.use((req, res, next) => {
  if (req.path === STAAT_PAD) {
    next()
    return
  }
  gewoneJson(req, res, next)
})
app.use(cookieParser())

/*
 * Achter een publicatie staat een proxy. Zonder dit staat er bij elk verzoek
 * hetzelfde adres, en dan begrenst de teller op inlogpogingen iedereen samen
 * in plaats van per bezoeker.
 */
app.set('trust proxy', 1)

accountRoutes(app)

/**
 * Poort. Replit zet `PORT` niet altijd, maar wijst in `.replit` wel poort 5000
 * naar buiten. Luisteren op 3001 levert daar een app op die draait en toch
 * onbereikbaar is; dat kost meer tijd om te vinden dan het waard is.
 * `REPL_ID` staat alleen op Replit.
 */
const PORT = Number(process.env.PORT ?? (process.env.REPL_ID ? 5000 : 3001))

/**
 * Het model staat in de omgeving, niet in de code. Modelnamen bij OpenAI
 * veranderen regelmatig en welke er beschikbaar zijn hangt af van het account;
 * een naam hardcoderen levert vroeg of laat een 404 op die niemand verwacht.
 */
const MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o'

/* ------------------------------------------------------------------ */
/* Een grens op wat het model mag kosten                               */
/* ------------------------------------------------------------------ */

declare module 'express-serve-static-core' {
  interface Request {
    /** De bon van dit verzoek, om er straks het aantal tokens bij te zetten. */
    bon?: Bon
  }
}

/**
 * Wie dit verzoek doet.
 *
 * Ingelogd is een account: aangemaakt, toestemming gegeven, terug te vinden.
 * Anders blijft er een IP-adres over, en dat kost niets om te vervangen. Beide
 * krijgen een grens, maar niet dezelfde.
 */
function wieIsHet(req: Request): { sleutel: string; ingelogd: boolean } {
  if (req.gebruiker) return { sleutel: `gebruiker:${req.gebruiker.id}`, ingelogd: true }
  return { sleutel: `adres:${req.ip ?? 'onbekend'}`, ingelogd: false }
}

const UITLEG: Record<string, string> = {
  'per-minuut': 'Even te snel achter elkaar. Probeer het over een minuut opnieuw.',
  'per-dag': 'Je hebt vandaag het maximum aan vragen aan de coach gebruikt. Morgen kun je weer verder.',
  tokens: 'Je hebt vandaag het maximum aan vragen aan de coach gebruikt. Morgen kun je weer verder.',
  totaal: 'De coach is vandaag even niet bereikbaar. Je programma, je sessies en je logboek werken gewoon door.',
}

/**
 * De grens op de eindpunten die het model gebruiken.
 *
 * Het verzoek wordt meteen genoteerd, niet pas bij een geslaagd antwoord. Een
 * script dat honderd keer een fout uitlokt hoort ook honderd verzoeken te zijn.
 */
function begrens(route: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Zonder sleutel gaat er niets naar het model, dus valt er ook niets te
    // beschermen. Wel tellen zou betekenen dat een server die nog niet is
    // ingesteld na twintig pogingen 429 geeft in plaats van te zeggen wat er
    // ontbreekt, en dan zoek je het probleem op de verkeerde plek.
    if (!process.env.OPENAI_API_KEY) {
      next()
      return
    }

    const { sleutel, ingelogd } = wieIsHet(req)
    const oordeel = await magHet(sleutel, grensVoor(ingelogd))

    if (!oordeel.mag) {
      res.setHeader('Retry-After', String(oordeel.wachtSeconden))
      res.status(429).json({
        error: 'te-veel',
        message:
          UITLEG[oordeel.reden] +
          (ingelogd || oordeel.reden === 'totaal'
            ? ''
            : ' Met een account krijg je meer ruimte.'),
      })
      return
    }

    req.bon = await noteerVerzoek(sleutel, route)
    next()
  }
}

/** Wat dit verzoek werkelijk gekost heeft bijschrijven. */
function boek(req: Request, usage: { prompt_tokens?: number; completion_tokens?: number } | undefined): void {
  if (!req.bon) return
  void boekTokens(req.bon, (usage?.prompt_tokens ?? 0) + (usage?.completion_tokens ?? 0))
}

/** Laat de client weten of de coach bruikbaar is, zonder de sleutel te tonen. */
app.get('/api/coach/status', (_req, res) => {
  res.json({ available: Boolean(process.env.OPENAI_API_KEY), model: MODEL })
})

/**
 * Welke modellen dit account heeft. Handig bij het instellen: zo hoef je niet
 * te gokken welke naam werkt. Geeft geen sleutel of andere gegevens prijs.
 */
app.get('/api/coach/models', begrens('modellen'), async (_req, res) => {
  if (!process.env.OPENAI_API_KEY) {
    res.status(503).json({ error: 'geen-sleutel', message: 'Geen OPENAI_API_KEY ingesteld.' })
    return
  }
  try {
    const client = new OpenAI()
    const list = await client.models.list()
    const names = list.data.map((m) => m.id).filter((id) => id.startsWith('gpt') || id.startsWith('o')).sort()
    res.json({ huidig: MODEL, beschikbaar: names })
  } catch (error) {
    res.status(502).json({ error: 'api-fout', message: errorMessage(error) })
  }
})

app.post('/api/coach', begrens('coach'), async (req, res) => {
  if (!process.env.OPENAI_API_KEY) {
    res.status(503).json({
      error: 'geen-sleutel',
      message:
        'De coach is niet geconfigureerd. Zet OPENAI_API_KEY in de omgeving van de server, bijvoorbeeld in de Replit Secrets.',
    })
    return
  }

  const { messages, context } = req.body as {
    messages?: Array<{ role: 'user' | 'assistant'; content: string }>
    context?: unknown
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'geen-bericht', message: 'Er is geen gesprek meegestuurd.' })
    return
  }
  if (messages.length > 40) {
    res.status(400).json({ error: 'te-lang', message: 'Dit gesprek is te lang. Begin een nieuw gesprek.' })
    return
  }

  const client = new OpenAI()

  try {
    const completion = await client.chat.completions.create({
      model: MODEL,
      max_completion_tokens: 1200,
      messages: [
        { role: 'system', content: COACH_SYSTEM },
        { role: 'system', content: `DATA VAN DEZE GEBRUIKER\n${JSON.stringify(context ?? {}, null, 1)}` },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      tools: [ADJUSTMENT_TOOL],
      tool_choice: 'auto',
    })

    const parsed = parseCoachResponse(completion)
    boek(req, completion.usage)

    res.json({
      ...parsed,
      usage: {
        input: completion.usage?.prompt_tokens ?? 0,
        output: completion.usage?.completion_tokens ?? 0,
      },
    })
  } catch (error) {
    stuurFout(res, error)
  }
})

/**
 * Eén plek voor wat er misgaat bij OpenAI.
 *
 * Stond dit per eindpunt, dan krijgt de gebruiker bij het ene een bruikbare
 * melding en bij het andere "er ging iets mis". Juist bij een ongeldige sleutel
 * of een verkeerde modelnaam is de melding het enige aanknopingspunt.
 */
function stuurFout(res: Response, error: unknown): void {
  if (error instanceof OpenAI.AuthenticationError) {
    res.status(502).json({ error: 'sleutel-ongeldig', message: 'De API-sleutel wordt geweigerd. Controleer OPENAI_API_KEY.' })
    return
  }
  if (error instanceof OpenAI.RateLimitError) {
    res.status(429).json({ error: 'te-druk', message: 'Even te veel aanvragen, of je tegoed is op. Probeer het later opnieuw.' })
    return
  }
  if (error instanceof OpenAI.NotFoundError) {
    res.status(502).json({
      error: 'model-onbekend',
      message: `Het model "${MODEL}" bestaat niet of is niet beschikbaar voor dit account. Kijk op /api/coach/models welke namen wel werken en zet die in OPENAI_MODEL.`,
    })
    return
  }
  if (error instanceof OpenAI.APIError) {
    console.error('OpenAI-fout', error.status, error.message)
    res.status(502).json({ error: 'api-fout', message: 'De coach is nu niet bereikbaar. Je programma werkt gewoon door.' })
    return
  }
  console.error(error)
  res.status(500).json({ error: 'onbekend', message: 'Er ging iets mis aan onze kant.' })
}

/**
 * Een klacht in eigen woorden duiden.
 *
 * Het model bepaalt alleen wélk lichaamsgebied het is en welke oefeningen dat
 * belasten. Wat er met het programma gebeurt, rekent de app daarna zelf uit met
 * de regels die er al staan. Zo blijft hetzelfde verhaal altijd hetzelfde
 * gevolg hebben, ook als het model morgen anders formuleert.
 */
app.post('/api/klacht', begrens('klacht'), async (req, res) => {
  if (!process.env.OPENAI_API_KEY) {
    res.status(503).json({
      error: 'geen-sleutel',
      message:
        'Klachten duiden werkt alleen met een sleutel. Zet OPENAI_API_KEY in de omgeving van de server. Je kunt de klacht ook met de hand invullen bij de set.',
    })
    return
  }

  const { text, ladders } = req.body as {
    text?: string
    ladders?: Array<{ id?: string; name?: string; pattern?: string }>
  }

  if (typeof text !== 'string' || text.trim().length < 3) {
    res.status(400).json({ error: 'geen-tekst', message: 'Er is geen klacht meegestuurd.' })
    return
  }
  if (text.length > 1000) {
    res.status(400).json({ error: 'te-lang', message: 'Houd de klacht korter.' })
    return
  }
  if (!Array.isArray(ladders) || ladders.length === 0) {
    res.status(400).json({ error: 'geen-oefeningen', message: 'Er zijn geen oefeningen meegestuurd.' })
    return
  }

  const toegestaan = ladders.map((l) => l?.id).filter((id): id is string => typeof id === 'string')
  if (toegestaan.length === 0) {
    res.status(400).json({ error: 'geen-oefeningen', message: 'De meegestuurde oefeningen hebben geen id.' })
    return
  }

  const client = new OpenAI()

  try {
    const completion = await client.chat.completions.create({
      model: MODEL,
      max_completion_tokens: 400,
      messages: [
        { role: 'system', content: COMPLAINT_SYSTEM },
        {
          role: 'system',
          content: `OEFENINGEN VAN DEZE SESSIE\n${JSON.stringify(ladders, null, 1)}`,
        },
        { role: 'user', content: text },
      ],
      tools: [COMPLAINT_TOOL],
      // Afdwingen: hier is een gesprek geen bruikbaar antwoord.
      tool_choice: { type: 'function', function: { name: COMPLAINT_TOOL_NAME } },
    })

    const call = completion.choices[0]?.message?.tool_calls?.find(
      (c) => 'function' in c && c.function.name === COMPLAINT_TOOL_NAME,
    )
    if (!call || !('function' in call)) {
      res.status(502).json({ error: 'niet-geduid', message: 'De klacht kon niet geduid worden. Vul hem met de hand in bij de set.' })
      return
    }

    boek(req, completion.usage)

    const gelezen = parseComplaintArguments(call.function.arguments, toegestaan)
    if (!gelezen.ok) {
      console.warn('Klacht geweigerd:', gelezen.fout)
      res.status(502).json({ error: 'niet-geduid', message: 'De klacht kon niet geduid worden. Vul hem met de hand in bij de set.' })
      return
    }

    res.json({
      ...gelezen.waarde,
      usage: {
        input: completion.usage?.prompt_tokens ?? 0,
        output: completion.usage?.completion_tokens ?? 0,
      },
    })
  } catch (error) {
    stuurFout(res, error)
  }
})

/**
 * Het geschreven weekrapport.
 *
 * De cijfers staan al vast en komen mee vanuit de app. Het model schrijft er
 * alleen een verband bij. De client controleert daarna of er geen getallen in
 * staan die nergens uit volgen; gebeurt dat wel, dan toont hij het rapport niet.
 */
app.post('/api/weekrapport', begrens('weekrapport'), async (req, res) => {
  if (!process.env.OPENAI_API_KEY) {
    res.status(503).json({
      error: 'geen-sleutel',
      message:
        'Een geschreven rapport vraagt een sleutel. Zet OPENAI_API_KEY in de omgeving van de server. De cijfers en de wekelijkse check-in werken gewoon zonder.',
    })
    return
  }

  const { context } = req.body as { context?: unknown }
  if (context === undefined || context === null) {
    res.status(400).json({ error: 'geen-data', message: 'Er is geen weekdata meegestuurd.' })
    return
  }

  const client = new OpenAI()

  try {
    const completion = await client.chat.completions.create({
      model: MODEL,
      max_completion_tokens: 400,
      messages: [
        { role: 'system', content: REPORT_SYSTEM },
        { role: 'system', content: `DATA VAN DEZE WEEK\n${JSON.stringify(context, null, 1)}` },
        { role: 'user', content: 'Schrijf het weekrapport.' },
      ],
    })

    boek(req, completion.usage)

    const text = completion.choices[0]?.message?.content?.trim() ?? ''
    if (!text) {
      res.status(502).json({ error: 'leeg', message: 'Het rapport kwam leeg terug.' })
      return
    }

    res.json({
      text,
      usage: {
        input: completion.usage?.prompt_tokens ?? 0,
        output: completion.usage?.completion_tokens ?? 0,
      },
    })
  } catch (error) {
    stuurFout(res, error)
  }
})

function errorMessage(error: unknown): string {
  if (error instanceof OpenAI.APIError) return `${error.status ?? ''} ${error.message}`.trim()
  return error instanceof Error ? error.message : 'Onbekende fout.'
}

// De gebouwde app. In ontwikkeling draait Vite hier zelf voor.
const dist = path.resolve(here, '..', 'dist')

/*
 * De service worker mag nooit uit een cache komen. Hij bepaalt zelf welke
 * versie van de app een gebruiker ziet, dus een oude kopie zet iedereen vast
 * op de vorige versie, ook na een nieuwe publicatie. De bestanden in assets/
 * mogen juist wel lang blijven staan: die hebben een hash in hun naam en
 * veranderen dus nooit van inhoud.
 */
app.use(
  express.static(dist, {
    setHeaders(res, filePath) {
      if (filePath.endsWith('sw.js')) res.setHeader('Cache-Control', 'no-cache')
      else if (filePath.includes(`${path.sep}assets${path.sep}`))
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    },
  }),
)
app.get(/.*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')))

/*
 * Het schema bijwerken voordat er verzoeken binnenkomen. Faalt dat, dan start
 * de app wel, maar zonder accounts: een app die helemaal niet opkomt is erger
 * dan een app waarin je even niet kunt inloggen.
 */
if (databaseBeschikbaar()) {
  try {
    const gedraaid = await migreer()
    console.log(
      gedraaid.length > 0 ? `Database bijgewerkt: ${gedraaid.join(', ')}` : 'Database is bij.',
    )
    startOpruimen()
  } catch (error) {
    console.error('Database niet bereikbaar, accounts staan uit:', error)
  }
} else {
  console.log('Geen DATABASE_URL. Accounts staan uit; gegevens blijven op het toestel.')
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Trainr draait op poort ${PORT}, model ${MODEL}`)
  if (!process.env.OPENAI_API_KEY) {
    console.warn('Let op: OPENAI_API_KEY ontbreekt. De app werkt, de coach niet.')
  }
})
