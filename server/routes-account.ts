/**
 * De eindpunten voor accounts.
 *
 * Dun gehouden: hier staat het nakijken van invoer en het vertalen naar HTTP,
 * het werk zelf staat in accounts.ts. Zo is de logica te testen zonder een
 * webserver, en blijft dit bestand te lezen als een lijst afspraken.
 */

import express from 'express'
import type { Express, NextFunction, Request, Response } from 'express'
import {
  AccountFout,
  HERSTEL_MINUTEN,
  TOESTEMMING_VERSIE,
  bewaarStaat,
  gebruikerBijToken,
  haalStaat,
  logOveralUit,
  logUit,
  login,
  registreer,
  ruimPogingenOp,
  ruimSessiesOp,
  herstelWachtwoord,
  maakHerstelToken,
  noteerPoging,
  ruimHerstelOp,
  telPogingen,
  verwijderAccount,
  wijzigWachtwoord,
} from './accounts.ts'
import { herstelBericht, mailBeschikbaar, verstuur } from './mail.ts'
import { SESSIE_COOKIE, cookieOpties, keurEmail, keurWachtwoord } from './auth.ts'
import { beschikbaar } from './db.ts'

/** De ingelogde gebruiker hangt aan het verzoek. */
declare module 'express-serve-static-core' {
  interface Request {
    gebruiker?: { id: string; email: string; toestemmingVersie: string | null }
  }
}

const HTTPS = () => process.env.NODE_ENV === 'productie' || process.env.REPL_ID !== undefined

/**
 * Een eigen kopregel op alles wat iets wijzigt.
 *
 * Een formulier op een andere website kan wel een verzoek naar ons sturen met
 * jouw cookie erbij, maar geen eigen kopregel meesturen: daarvoor is een
 * fetch nodig, en die wordt door de browser eerst bij ons nagevraagd. Dit is
 * dus een eenvoudige en sluitende afscherming tegen verzoeken die je zonder
 * het te weten uitvoert.
 */
export const CLIENT_HEADER = 'x-trainr-client'

function eisEigenClient(req: Request, res: Response, next: NextFunction): void {
  if (req.method === 'GET' || req.method === 'HEAD') {
    next()
    return
  }
  if (req.get(CLIENT_HEADER) !== '1') {
    res.status(403).json({
      error: 'verkeerde-herkomst',
      message: 'Dit verzoek komt niet uit de app.',
    })
    return
  }
  next()
}

async function laadGebruiker(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = (req.cookies as Record<string, string> | undefined)?.[SESSIE_COOKIE]
  if (token && beschikbaar()) {
    try {
      const gebruiker = await gebruikerBijToken(token)
      if (gebruiker) {
        req.gebruiker = {
          id: gebruiker.id,
          email: gebruiker.email,
          toestemmingVersie: gebruiker.toestemmingVersie,
        }
      }
    } catch (error) {
      console.error('Sessie lezen mislukte', error)
    }
  }
  next()
}

function eisInlog(req: Request, res: Response, next: NextFunction): void {
  if (!req.gebruiker) {
    res.status(401).json({ error: 'niet-ingelogd', message: 'Log eerst in.' })
    return
  }
  next()
}

function stuurAccountFout(res: Response, error: unknown): void {
  if (error instanceof AccountFout) {
    res.status(error.status).json({ error: error.code, message: error.message })
    return
  }
  console.error('Accountfout', error)
  res.status(500).json({ error: 'onbekend', message: 'Er ging iets mis aan onze kant.' })
}

/**
 * Waar de app draait, voor de link in de mail.
 *
 * Achter een publicatie staat een proxy, dus het protocol uit het verzoek
 * klopt niet altijd. `APP_URL` gaat daarom voor: één plek waar het goed staat,
 * in plaats van raden per verzoek.
 */
function herkomst(req: Request): string {
  const ingesteld = process.env.APP_URL?.replace(/\/+$/, '')
  if (ingesteld) return ingesteld
  const protocol = req.get('x-forwarded-proto') ?? req.protocol
  return `${protocol}://${req.get('host') ?? 'localhost'}`
}

function eisDatabase(_req: Request, res: Response, next: NextFunction): void {
  if (!beschikbaar()) {
    res.status(503).json({
      error: 'geen-database',
      message:
        'Accounts staan uit omdat er geen database is ingesteld. De app werkt gewoon; je gegevens blijven dan op dit toestel.',
    })
    return
  }
  next()
}

export function accountRoutes(app: Express): void {
  app.use(laadGebruiker)
  app.use('/api', eisEigenClient)

  /** Wat de app moet weten voordat er iets getoond wordt. */
  app.get('/api/account', (req, res) => {
    res.json({
      accountsMogelijk: beschikbaar(),
      toestemmingVersie: TOESTEMMING_VERSIE,
      gebruiker: req.gebruiker
        ? { email: req.gebruiker.email, toestemmingVersie: req.gebruiker.toestemmingVersie }
        : null,
    })
  })

  app.post('/api/account/registreren', eisDatabase, async (req, res) => {
    const { email, wachtwoord, toestemming } = req.body as {
      email?: string
      wachtwoord?: string
      toestemming?: boolean
    }

    const emailFout = keurEmail(email)
    if (emailFout) {
      res.status(400).json({ error: 'email-ongeldig', message: emailFout })
      return
    }
    const wachtwoordFout = keurWachtwoord(wachtwoord ?? '')
    if (wachtwoordFout) {
      res.status(400).json({ error: 'wachtwoord-zwak', message: wachtwoordFout })
      return
    }

    try {
      await registreer(email as string, wachtwoord as string, toestemming === true)
      // Meteen inloggen: een scherm dat zegt "gelukt, log nu in" is een stap
      // die niemand wil zetten en die niets veiliger maakt.
      const inlog = await login(email as string, wachtwoord as string)
      res.cookie(SESSIE_COOKIE, inlog.token, cookieOpties(HTTPS()))
      res.status(201).json({ gebruiker: { email: inlog.gebruiker.email }, toestemmingVersie: TOESTEMMING_VERSIE })
    } catch (error) {
      stuurAccountFout(res, error)
    }
  })

  app.post('/api/account/inloggen', eisDatabase, async (req, res) => {
    const { email, wachtwoord } = req.body as { email?: string; wachtwoord?: string }
    if (typeof email !== 'string' || typeof wachtwoord !== 'string') {
      res.status(400).json({ error: 'onvolledig', message: 'Vul je e-mailadres en wachtwoord in.' })
      return
    }
    try {
      const inlog = await login(email, wachtwoord)
      res.cookie(SESSIE_COOKIE, inlog.token, cookieOpties(HTTPS()))
      res.json({ gebruiker: { email: inlog.gebruiker.email, toestemmingVersie: inlog.gebruiker.toestemmingVersie } })
    } catch (error) {
      stuurAccountFout(res, error)
    }
  })

  app.post('/api/account/uitloggen', async (req, res) => {
    const token = (req.cookies as Record<string, string> | undefined)?.[SESSIE_COOKIE]
    if (token && beschikbaar()) {
      try {
        await logUit(token)
      } catch (error) {
        console.error('Uitloggen mislukte', error)
      }
    }
    res.clearCookie(SESSIE_COOKIE, { ...cookieOpties(HTTPS()), maxAge: undefined })
    res.json({ ok: true })
  })

  app.post('/api/account/wachtwoord', eisDatabase, eisInlog, async (req, res) => {
    const { huidig, nieuw } = req.body as { huidig?: string; nieuw?: string }
    const fout = keurWachtwoord(nieuw ?? '')
    if (fout) {
      res.status(400).json({ error: 'wachtwoord-zwak', message: fout })
      return
    }
    try {
      await wijzigWachtwoord(req.gebruiker!.id, huidig ?? '', nieuw as string)
      // Andere apparaten eruit. Wie je wachtwoord wijzigt, wil meestal precies
      // dat: een sessie die iemand anders nog open heeft, moet dicht.
      const token = (req.cookies as Record<string, string>)[SESSIE_COOKIE]
      const uitgelogd = await logOveralUit(req.gebruiker!.id, token)
      res.json({ ok: true, andereApparatenUitgelogd: uitgelogd })
    } catch (error) {
      stuurAccountFout(res, error)
    }
  })

  /* ---- Gegevens ---- */

  app.get('/api/account/staat', eisDatabase, eisInlog, async (req, res) => {
    try {
      const staat = await haalStaat(req.gebruiker!.id)
      res.json(staat ? { versie: staat.versie, data: staat.data, bijgewerktOp: staat.bijgewerktOp } : { versie: 0, data: null })
    } catch (error) {
      stuurAccountFout(res, error)
    }
  })

  /*
   * Een ruimere limiet dan de rest van de API. Vier jaar loggen is al gauw een
   * paar megabyte, en dan zou opslaan ineens stilletjes stuklopen bij de
   * gebruiker die er het langst mee werkt. De coach houdt zijn eigen krappe
   * limiet, want die grens is er juist om te voorkomen dat iemand de server
   * als doorgeefluik naar OpenAI gebruikt.
   */
  app.put('/api/account/staat', express.json({ limit: '12mb' }), eisDatabase, eisInlog, async (req, res) => {
    const { data, versie } = req.body as { data?: unknown; versie?: number }
    if (data === undefined || data === null) {
      res.status(400).json({ error: 'geen-data', message: 'Er is niets meegestuurd om te bewaren.' })
      return
    }
    try {
      const uitkomst = await bewaarStaat(
        req.gebruiker!.id,
        data,
        typeof versie === 'number' && versie > 0 ? versie : null,
      )
      if (!uitkomst.ok) {
        res.status(409).json({
          error: 'conflict',
          message: 'Er is op een ander toestel iets gewijzigd. Haal dat eerst op.',
          huidige: { versie: uitkomst.huidige.versie, data: uitkomst.huidige.data },
        })
        return
      }
      res.json({ versie: uitkomst.versie })
    } catch (error) {
      stuurAccountFout(res, error)
    }
  })

  /* ---- Wachtwoord vergeten ---- */

  app.get('/api/account/herstel-mogelijk', (_req, res) => {
    res.json({ mogelijk: beschikbaar() && mailBeschikbaar() })
  })

  app.post('/api/account/wachtwoord-vergeten', eisDatabase, async (req, res) => {
    if (!mailBeschikbaar()) {
      res.status(503).json({
        error: 'geen-mail',
        message:
          'Er is geen e-maildienst ingesteld, dus we kunnen je geen herstellink sturen. Neem contact op met de beheerder.',
      })
      return
    }

    const { email } = req.body as { email?: string }
    const fout = keurEmail(email)
    if (fout) {
      res.status(400).json({ error: 'email-ongeldig', message: fout })
      return
    }

    /*
     * Een grens op het aanvragen, want zonder grens kan iemand met een script
     * honderden mails laten versturen naar een adres dat hij niet bezit. Dat
     * kost jou geld en de ontvanger zijn geduld.
     */
    const sleutel = `herstel:${(email as string).trim().toLowerCase()}`
    if ((await telPogingen(sleutel)) >= 3) {
      res.status(429).json({
        error: 'te-veel-pogingen',
        message: 'Er zijn net al herstellinks aangevraagd. Kijk in je inbox, of wacht een kwartier.',
      })
      return
    }
    await noteerPoging(sleutel)

    try {
      const herstel = await maakHerstelToken(email as string)

      /*
       * Het antwoord is hetzelfde of het adres nu bestaat of niet. Zou dat
       * verschillen, dan kan iemand met een lijst adressen uitvinden wie hier
       * een account heeft, en bij gezondheidsgegevens is alleen dat al
       * gevoelige informatie.
       */
      if (herstel) {
        const basis = herkomst(req)
        const link = `${basis}/wachtwoord-herstellen?token=${encodeURIComponent(herstel.token)}`
        await verstuur(herstelBericht(herstel.email, link, HERSTEL_MINUTEN))
      }

      res.json({
        ok: true,
        message:
          'Als er een account bij dit adres hoort, is er een herstellink onderweg. Kijk ook in je ongewenste post.',
      })
    } catch (error) {
      console.error('Herstelmail mislukte', error)
      res.status(502).json({
        error: 'mail-mislukt',
        message: 'De herstelmail kon niet verstuurd worden. Probeer het later opnieuw.',
      })
    }
  })

  app.post('/api/account/wachtwoord-herstellen', eisDatabase, async (req, res) => {
    const { token, wachtwoord } = req.body as { token?: string; wachtwoord?: string }
    if (typeof token !== 'string' || token.length < 10) {
      res.status(400).json({ error: 'token-onbekend', message: 'Deze link werkt niet. Vraag een nieuwe aan.' })
      return
    }
    const fout = keurWachtwoord(wachtwoord ?? '')
    if (fout) {
      res.status(400).json({ error: 'wachtwoord-zwak', message: fout })
      return
    }
    try {
      await herstelWachtwoord(token, wachtwoord as string)
      // Bewust niet meteen inloggen. Je hebt net een wachtwoord gekozen; dat
      // één keer intypen bevestigt dat je het ook echt onthouden hebt.
      res.json({
        ok: true,
        message: 'Je wachtwoord is gewijzigd en je bent overal uitgelogd. Log in met je nieuwe wachtwoord.',
      })
    } catch (error) {
      stuurAccountFout(res, error)
    }
  })

  /** Artikel 17 AVG. Weg is weg, ook de openstaande sessies. */
  app.post('/api/account/verwijderen', eisDatabase, eisInlog, async (req, res) => {
    const { bevestiging } = req.body as { bevestiging?: string }
    if (bevestiging !== 'VERWIJDER') {
      res.status(400).json({
        error: 'geen-bevestiging',
        message: 'Typ VERWIJDER om te bevestigen. Dit kan niet ongedaan gemaakt worden.',
      })
      return
    }
    try {
      await verwijderAccount(req.gebruiker!.id)
      res.clearCookie(SESSIE_COOKIE, { ...cookieOpties(HTTPS()), maxAge: undefined })
      res.json({ ok: true })
    } catch (error) {
      stuurAccountFout(res, error)
    }
  })
}

/**
 * Verlopen sessies en oude inlogpogingen weggooien.
 *
 * Eén keer bij het starten en daarna elk uur. Niet omdat het dringend is, maar
 * omdat een tabel die alleen maar groeit uiteindelijk een probleem wordt dat
 * niemand zag aankomen.
 */
export function startOpruimen(): void {
  if (!beschikbaar()) return
  const opruimen = async () => {
    try {
      await ruimSessiesOp()
      await ruimPogingenOp()
      await ruimHerstelOp()
    } catch (error) {
      console.error('Opruimen mislukte', error)
    }
  }
  void opruimen()
  setInterval(opruimen, 60 * 60 * 1000).unref()
}
