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
import OpenAI from 'openai'
import { COACH_SYSTEM } from './prompt.ts'
import { ADJUSTMENT_TOOL } from './tools.ts'
import { parseCoachResponse } from './parse.ts'

const here = path.dirname(fileURLToPath(import.meta.url))
const app = express()

// Het profiel plus de recente historie is ruim, maar niet onbeperkt: zonder
// grens kan iemand de server als generiek doorgeefluik naar OpenAI gebruiken.
app.use(express.json({ limit: '1mb' }))

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

/** Laat de client weten of de coach bruikbaar is, zonder de sleutel te tonen. */
app.get('/api/coach/status', (_req, res) => {
  res.json({ available: Boolean(process.env.OPENAI_API_KEY), model: MODEL })
})

/**
 * Welke modellen dit account heeft. Handig bij het instellen: zo hoef je niet
 * te gokken welke naam werkt. Geeft geen sleutel of andere gegevens prijs.
 */
app.get('/api/coach/models', async (_req, res) => {
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

app.post('/api/coach', async (req, res) => {
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

    res.json({
      ...parsed,
      usage: {
        input: completion.usage?.prompt_tokens ?? 0,
        output: completion.usage?.completion_tokens ?? 0,
      },
    })
  } catch (error) {
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Trainr draait op poort ${PORT}, model ${MODEL}`)
  if (!process.env.OPENAI_API_KEY) {
    console.warn('Let op: OPENAI_API_KEY ontbreekt. De app werkt, de coach niet.')
  }
})
