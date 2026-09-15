/**
 * Trainen zonder bereik, en de gegevens later alsnog op de server.
 *
 * Dit is het scenario waar de app voor gemaakt is: je staat in een sportschool
 * zonder verbinding, logt je sets, doet de app dicht, en pas thuis gaat hij
 * weer open. Wat je daar hebt ingevoerd moet er dan nog zijn en vanzelf naar de
 * server gaan, zonder dat de app je een keuze voorlegt die je verkeerd kunt
 * beantwoorden.
 *
 * De test doet dat echt: netwerk eruit, invoeren, tabblad sluiten, nieuw
 * tabblad met netwerk erin, en daarna kijken wat er in de database staat.
 *
 *   DATABASE_URL=postgres://... node e2e/offline-sync.mjs
 */

import { chromium } from 'playwright'
import { startServer, stopServer, wachtOpServer } from './serverproces.mjs'

const APP_PORT = 4388
const DB = process.env.DATABASE_URL
if (!DB) {
  console.error('Zet DATABASE_URL naar een testdatabase.')
  process.exit(1)
}

const fails = []
const ok = (cond, msg) => {
  process.stdout.write(`${cond ? 'PASS  ' : 'FAIL  '}${msg}\n`)
  if (!cond) fails.push(msg)
}

const { Client } = await import('pg')
const schoon = new Client({ connectionString: DB })
await schoon.connect()
await schoon.query('drop table if exists migraties, inlogpogingen, staat, sessies, gebruikers cascade')
await schoon.end()

const server = startServer({ PORT: String(APP_PORT), DATABASE_URL: DB, DATABASE_SSL: 'uit' })
const BASE = `http://localhost:${APP_PORT}`
await wachtOpServer(`${BASE}/api/account`)

const db = new Client({ connectionString: DB })
await db.connect()

const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
const EMAIL = 'sporter@voorbeeld.nl'
const WACHTWOORD = 'paarse olifant danst'

/** Wat er nu in de database staat voor deze gebruiker. */
async function inDatabase() {
  const { rows } = await db.query(
    `select s.versie, s.data from staat s join gebruikers g on g.id = s.gebruiker_id where g.email = $1`,
    [EMAIL],
  )
  return rows[0] ?? null
}

// Eén browsercontext = één toestel. De opslag blijft tussen tabbladen bestaan,
// net als op een echte telefoon die je dichtdoet en later weer opent.
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' })

try {
  /* ---- 1. Account maken met verbinding ---- */
  const p1 = await ctx.newPage()
  p1.setDefaultTimeout(15000)
  p1.on('pageerror', (e) => ok(false, `geen scriptfout (${e.message})`))
  await p1.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await p1.getByRole('button', { name: /demodata/i }).click()
  await p1.waitForTimeout(1200)

  const status = await p1.evaluate(
    async ([email, wachtwoord]) => {
      const res = await fetch('/api/account/registreren', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Trainr-Client': '1' },
        body: JSON.stringify({ email, wachtwoord, toestemming: true }),
      })
      return res.status
    },
    [EMAIL, WACHTWOORD],
  )
  ok(status === 201, 'account aangemaakt')

  await p1.reload({ waitUntil: 'domcontentloaded' })
  await p1.waitForTimeout(3000)

  const eerste = await inDatabase()
  ok(eerste !== null, 'de eerste keer synchroniseert de app vanzelf bij het openen')
  const sessiesVoor = eerste?.data?.sessions?.length ?? 0
  ok(sessiesVoor > 0, `er staan ${sessiesVoor} sessies op de server`)

  await p1.close()

  /* ---- 2. Sportschool: geen bereik, wel trainen ---- */
  await ctx.setOffline(true)
  const p2 = await ctx.newPage()
  p2.setDefaultTimeout(15000)
  await p2.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' }).catch(() => {})
  await p2.waitForTimeout(2000)

  const draaitOffline = ((await p2.textContent('body')) ?? '').length > 800
  ok(draaitOffline, 'de app opent zonder verbinding')

  await p2.getByRole('button', { name: 'Trainen', exact: true }).first().click()
  await p2.waitForTimeout(900)
  await p2.getByRole('button', { name: /^Beginnen met/ }).click()
  await p2.waitForTimeout(900)

  // Twee sets loggen, zoals je dat tussen twee oefeningen door doet.
  for (let i = 0; i < 2; i++) {
    await p2.getByRole('button', { name: /Set \d+ toevoegen/ }).first().click()
    await p2.waitForTimeout(400)
  }
  await p2.getByRole('button', { name: 'Opslaan' }).first().click()
  await p2.waitForTimeout(2500)

  const naOffline = (await p2.textContent('body')) ?? ''
  ok(/Sessie opgeslagen|opgeslagen/i.test(naOffline), 'de sessie wordt lokaal opgeslagen zonder bereik')

  const tussenstand = await inDatabase()
  ok(
    (tussenstand?.data?.sessions?.length ?? 0) === sessiesVoor,
    'er gaat niets naar de server zolang er geen verbinding is',
  )

  const melding = await p2.textContent('body')
  ok(/Nog niet op de server/.test(melding), 'de app laat zien dat er invoer klaarstaat')
  // Bovenaan kijken: daar staat de melding, en daar moet hij leesbaar zijn.
  await p2.evaluate(() => window.scrollTo(0, 0))
  await p2.waitForTimeout(400)
  await p2.screenshot({ path: 'e2e/offline-wacht.png' })

  // Telefoon in de tas: tabblad dicht.
  await p2.close()

  /* ---- 3. Thuis: app weer open, wel verbinding ---- */
  await ctx.setOffline(false)
  const p3 = await ctx.newPage()
  p3.setDefaultTimeout(15000)
  p3.on('pageerror', (e) => ok(false, `geen scriptfout na terugkeer (${e.message})`))
  await p3.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await p3.waitForTimeout(4000)

  const na = await inDatabase()
  const sessiesNa = na?.data?.sessions?.length ?? 0
  ok(sessiesNa === sessiesVoor + 1, `de offline sessie staat nu in de database (${sessiesVoor} -> ${sessiesNa})`)
  ok((na?.versie ?? 0) > (eerste?.versie ?? 0), 'de versie is opgehoogd')

  const scherm = (await p3.textContent('body')) ?? ''
  ok(!/Twee versies van je gegevens/.test(scherm), 'er wordt geen keuze gevraagd, want er is niets tegenstrijdigs')
  ok(!/Nog niet op de server/.test(scherm), 'de melding is weg zodra alles verstuurd is')
  await p3.screenshot({ path: 'e2e/offline-gesynchroniseerd.png' })

  /* ---- 4. En een echte botsing blijft wel een keuze ---- */
  await ctx.setOffline(true)
  await p3.getByRole('button', { name: 'Trainen', exact: true }).first().click()
  await p3.waitForTimeout(900)
  await p3.getByRole('button', { name: /^Beginnen met/ }).click()
  await p3.waitForTimeout(700)
  await p3.getByRole('button', { name: /Set \d+ toevoegen/ }).first().click()
  await p3.waitForTimeout(400)
  await p3.getByRole('button', { name: 'Opslaan' }).first().click()
  await p3.waitForTimeout(2000)

  // Ondertussen schrijft een ander toestel rechtstreeks naar de server.
  const { rows: g } = await db.query('select id from gebruikers where email = $1', [EMAIL])
  await db.query(
    `update staat set versie = versie + 1, data = jsonb_set(data, '{intake,name}', '"Vanaf ander toestel"') where gebruiker_id = $1`,
    [g[0].id],
  )

  await ctx.setOffline(false)
  await p3.waitForTimeout(1000)
  await p3.getByRole('button', { name: 'Instellingen', exact: true }).first().click()
  await p3.waitForTimeout(3500)

  const botsing = (await p3.textContent('body')) ?? ''
  ok(/Twee versies van je gegevens|ander toestel/.test(botsing), 'een echte botsing wordt wél voorgelegd')
  await p3.screenshot({ path: 'e2e/offline-echte-botsing.png' })
} finally {
  await b.close()
  await db.end()
  await stopServer(server)
}

process.stdout.write(fails.length === 0 ? '\nOFFLINE TRAINEN EN LATER SYNCHRONISEREN WERKT\n' : `\n${fails.length} PROBLEMEN:\n${fails.join('\n')}\n`)
process.exit(fails.length === 0 ? 0 : 1)
