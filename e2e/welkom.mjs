/**
 * Wie krijgt het startscherm, en wie nooit.
 *
 * Het gevaarlijke aan een startscherm is niet dat het er is, maar wie het per
 * ongeluk ziet. Een bestaande gebruiker die na een update ineens voor een
 * dichte deur staat, of iemand in een sportschool zonder bereik die niet bij
 * zijn eigen sessie kan: dat zijn de gevallen die deze test afdekt.
 *
 *   DATABASE_URL=postgres://... node e2e/welkom.mjs
 */

import { chromium } from 'playwright'
import { startServer, stopServer, wachtOpServer } from './serverproces.mjs'

const APP_PORT = 4386
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
await schoon.query('drop schema public cascade; create schema public;')
await schoon.end()

const server = startServer({ PORT: String(APP_PORT), DATABASE_URL: DB, DATABASE_SSL: 'uit' })
const BASE = `http://localhost:${APP_PORT}`
await wachtOpServer(`${BASE}/api/account`)

const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})

async function nieuwToestel(scheme = 'dark') {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme })
  const p = await ctx.newPage()
  p.setDefaultTimeout(15000)
  p.on('pageerror', (e) => ok(false, 'geen scriptfout: ' + e.message))
  return { ctx, p }
}

try {
  /* ---- 1. Nieuwe gebruiker krijgt de keuze ---- */
  const nieuw = await nieuwToestel()
  await nieuw.p.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await nieuw.p.waitForTimeout(2000)
  const start = (await nieuw.p.textContent('body')) ?? ''
  ok(/Maak een account/.test(start), 'een nieuw toestel ziet het startscherm')
  ok(/Ik heb al een account/.test(start), 'inloggen staat erbij')
  ok(/Verder zonder account/.test(start), 'en er is een uitweg')
  ok(!/demodata|intake/i.test(start), 'de app zelf is nog niet zichtbaar')
  await nieuw.p.screenshot({ path: 'e2e/welkom-start.png' })

  /* ---- 2. De uitweg legt uit wat je misloopt ---- */
  await nieuw.p.getByRole('button', { name: 'Verder zonder account' }).click()
  await nieuw.p.waitForTimeout(500)
  const uitleg = (await nieuw.p.textContent('body')) ?? ''
  ok(/alleen op dit toestel/.test(uitleg), 'de uitweg zegt waar je gegevens staan')
  ok(/hele log weg/.test(uitleg), 'en wat er gebeurt als je je telefoon kwijtraakt')
  ok(/later nog omzetten/.test(uitleg), 'en dat je het later kunt omzetten')
  await nieuw.p.screenshot({ path: 'e2e/welkom-zonder.png' })

  await nieuw.p.getByRole('button', { name: /ga verder zonder account/ }).click()
  await nieuw.p.waitForTimeout(1200)
  ok(/intake|Welkom|demodata/i.test((await nieuw.p.textContent('body')) ?? ''), 'daarna gaat de app gewoon open')

  /* ---- 3. Herladen vraagt het niet opnieuw ---- */
  await nieuw.p.reload({ waitUntil: 'domcontentloaded' })
  await nieuw.p.waitForTimeout(1500)
  ok(!/Maak een account/.test((await nieuw.p.textContent('body')) ?? ''), 'de keuze wordt onthouden')

  /* ---- 4. Na de intake nog één keer, en daarna niet meer ---- */
  await nieuw.p.getByRole('button', { name: /demodata/i }).click()
  await nieuw.p.waitForTimeout(2000)
  const naIntake = (await nieuw.p.textContent('body')) ?? ''
  ok(/Je programma staat klaar/.test(naIntake), 'na de intake komt de vraag nog een keer')
  ok(/Bewaar mijn programma/.test(naIntake), 'met een duidelijke reden erbij')
  await nieuw.p.screenshot({ path: 'e2e/welkom-bewaren.png' })

  await nieuw.p.getByRole('button', { name: /Later, ik wil eerst kijken/ }).click()
  await nieuw.p.waitForTimeout(1200)
  ok(/Vandaag|Trainen/.test((await nieuw.p.textContent('body')) ?? ''), 'daarna ben je in de app')

  await nieuw.p.reload({ waitUntil: 'domcontentloaded' })
  await nieuw.p.waitForTimeout(1800)
  const derdeKeer = (await nieuw.p.textContent('body')) ?? ''
  ok(!/Je programma staat klaar/.test(derdeKeer), 'en de vraag komt niet elke keer terug')
  await nieuw.ctx.close()

  /* ---- 5. Een bestaande gebruiker wordt nooit buitengesloten ---- */
  const bestaand = await nieuwToestel()
  await bestaand.p.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await bestaand.p.waitForTimeout(800)
  // Doen alsof dit toestel de app al gebruikte voordat het startscherm bestond.
  await bestaand.p.evaluate(() => {
    localStorage.setItem(
      'trainr-v1',
      JSON.stringify({ state: { intake: { name: 'Oude gebruiker', completedAt: '2026-01-01' }, sessions: [] }, version: 1 }),
    )
  })
  await bestaand.p.reload({ waitUntil: 'domcontentloaded' })
  await bestaand.p.waitForTimeout(1800)
  const oud = (await bestaand.p.textContent('body')) ?? ''
  ok(!/Maak een account/.test(oud), 'iemand die de app al gebruikte ziet geen dichte deur')
  ok(!/Je programma staat klaar/.test(oud), 'en ook de tweede vraag niet')
  await bestaand.ctx.close()

  /* ---- 6. Zonder bereik nooit een inlogscherm ---- */
  const zonderNet = await nieuwToestel()
  await zonderNet.p.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await zonderNet.p.waitForTimeout(1500)
  await zonderNet.p.getByRole('button', { name: 'Verder zonder account' }).click()
  await zonderNet.p.waitForTimeout(300)
  await zonderNet.p.getByRole('button', { name: /ga verder zonder account/ }).click()
  await zonderNet.p.waitForTimeout(1500)
  await zonderNet.p.getByRole('button', { name: /demodata/i }).click()
  await zonderNet.p.waitForTimeout(1500)
  await zonderNet.p.getByRole('button', { name: /Later, ik wil eerst kijken/ }).click().catch(() => {})
  await zonderNet.p.waitForTimeout(1000)

  await zonderNet.ctx.setOffline(true)
  await zonderNet.p.reload({ waitUntil: 'domcontentloaded' })
  await zonderNet.p.waitForTimeout(2500)
  const offline = (await zonderNet.p.textContent('body')) ?? ''
  ok(!/Maak een account/.test(offline), 'zonder bereik komt er geen startscherm')
  ok(/Vandaag|Trainen/.test(offline), 'en de app werkt gewoon')
  await zonderNet.p.screenshot({ path: 'e2e/welkom-offline.png' })
} finally {
  await b.close()
  await stopServer(server)
}

process.stdout.write(fails.length === 0 ? '\nSTARTSCHERM WERKT\n' : `\n${fails.length} PROBLEMEN:\n${fails.join('\n')}\n`)
process.exit(fails.length === 0 ? 0 : 1)
