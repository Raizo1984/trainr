/**
 * Accounts in de browser, met twee toestellen en een echte database.
 *
 * Het tweede toestel is de reden dat deze test bestaat. Synchroniseren gaat
 * altijd goed tot twee mensen, of twee apparaten van dezelfde persoon,
 * tegelijk iets loggen. Dat is geen randgeval maar wat er gebeurt zodra je de
 * app op je telefoon en je laptop hebt.
 *
 *   DATABASE_URL=postgres://... node e2e/account-ui.mjs
 */

import { chromium } from 'playwright'
import { startServer, stopServer, wachtOpServer } from './serverproces.mjs'

const APP_PORT = 4390
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
/*
 * Het hele schema weg in plaats van een lijst tabellen. Zo'n lijst raakt
 * achter zodra er een migratie bij komt, en dan faalt de test op een tabel die
 * nog van de vorige keer staat. Dat is precies wat hier gebeurde toen de tabel
 * voor wachtwoordherstel erbij kwam.
 */
await schoon.query('drop schema public cascade; create schema public;')
await schoon.end()

const server = startServer({ PORT: String(APP_PORT), DATABASE_URL: DB, DATABASE_SSL: 'uit' })
const BASE = `http://localhost:${APP_PORT}`
await wachtOpServer(`${BASE}/api/account`)

const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})

async function toestel(naam) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' })
  const p = await ctx.newPage()
  p.setDefaultTimeout(15000)
  p.on('pageerror', (e) => ok(false, `${naam}: geen scriptfout (${e.message})`))
  await p.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  return { ctx, p }
}

const EMAIL = 'sporter@voorbeeld.nl'
const WACHTWOORD = 'paarse olifant danst'

try {
  /* ---- Toestel 1: demodata en een account ---- */
  const een = await toestel('toestel 1')
  await een.p.getByRole('button', { name: /demodata/i }).click()
  await een.p.waitForTimeout(1200)
  await een.p.getByRole('button', { name: 'Instellingen', exact: true }).first().click()
  await een.p.waitForTimeout(1000)

  const body1 = await een.p.textContent('body')
  ok(/Account/.test(body1), 'de accountkaart staat er')
  ok(/Ik geef toestemming/.test(body1), 'de toestemming staat er uitgeschreven')
  ok(/gezondheidsgegevens/.test(body1), 'en benoemt dat het om gezondheidsgegevens gaat')

  await een.p.getByLabel('E-mailadres').fill(EMAIL)
  await een.p.getByLabel('Wachtwoord', { exact: true }).fill(WACHTWOORD)

  const knop = een.p.getByRole('button', { name: 'Account maken' }).last()
  ok(await knop.isDisabled(), 'zonder vinkje kun je geen account maken')

  await een.p.getByRole('button', { name: /Lees wat we precies bewaren/ }).click()
  await een.p.waitForTimeout(400)
  const privacy = await een.p.textContent('body')
  ok(/bijzondere categorie/.test(privacy), 'de privacytekst benoemt de bijzondere categorie')
  ok(/Autoriteit Persoonsgegevens/.test(privacy), 'en waar je kunt klagen')

  await een.p.locator('input[type="checkbox"]').first().check()
  await knop.click()
  await een.p.waitForTimeout(2500)

  const na = await een.p.textContent('body')
  ok(new RegExp(EMAIL).test(na), 'je bent ingelogd en ziet je adres')
  ok(/Bijgewerkt/.test(na), 'de gegevens zijn naar de server gegaan')
  await een.p.screenshot({ path: 'e2e/account-ingelogd.png' })

  /* ---- Toestel 2: inloggen en de data ophalen ---- */
  const twee = await toestel('toestel 2')
  await twee.p.waitForTimeout(800)
  const startTwee = await twee.p.textContent('body')
  ok(/intake|Welkom|Beginnen/i.test(startTwee), 'het tweede toestel begint leeg')

  // Intake overslaan via demodata mag niet: dan is het geen leeg toestel meer.
  await twee.p.evaluate(() => {
    document.querySelector('a[href="#instellingen"]')
  })
  // Zonder intake is er geen navigatie, dus inloggen via de API en herladen.
  const inlog = await twee.p.evaluate(
    async ([email, wachtwoord]) => {
      const res = await fetch('/api/account/inloggen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Trainr-Client': '1' },
        body: JSON.stringify({ email, wachtwoord }),
      })
      return res.status
    },
    [EMAIL, WACHTWOORD],
  )
  ok(inlog === 200, 'inloggen op het tweede toestel lukt')

  await twee.p.reload({ waitUntil: 'domcontentloaded' })
  await twee.p.waitForTimeout(2500)
  const naSync = await twee.p.textContent('body')
  ok(!/Beginnen met je intake|intakevragen/i.test(naSync) || /Vandaag/.test(naSync), 'het tweede toestel heeft de gegevens opgehaald')
  await twee.p.screenshot({ path: 'e2e/account-tweede-toestel.png' })

  /* ---- Botsing ----
   *
   * Een botsing vraagt twee dingen tegelijk: de server is verder, én dit
   * toestel heeft eigen wijzigingen die er nog niet zijn. Is alleen de server
   * verder, dan hoort de app gewoon op te halen zonder iets te vragen.
   */
  await twee.p.evaluate(async () => {
    const res = await fetch('/api/account/staat', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Trainr-Client': '1' },
      body: JSON.stringify({ data: { intake: { name: 'Vanaf toestel 2' }, sessions: [] }, versie: 0 }),
    })
    return res.status
  })

  // Toestel 1 wijzigt ondertussen zelf ook iets.
  await een.p.getByRole('button', { name: 'Demodata laden' }).click()
  await een.p.waitForTimeout(1200)
  await een.p.getByRole('button', { name: 'Nu synchroniseren' }).click()
  await een.p.waitForTimeout(2500)
  const botsing = await een.p.textContent('body')
  ok(/Twee versies van je gegevens/.test(botsing), 'een botsing wordt gemeld en niet stil overschreven')
  ok(/Houd dit toestel/.test(botsing) && /Houd de server/.test(botsing), 'en je krijgt de keuze')
  await een.p.screenshot({ path: 'e2e/account-botsing.png' })

  await een.p.getByRole('button', { name: 'Houd dit toestel' }).click()
  await een.p.waitForTimeout(2000)
  const opgelost = await een.p.textContent('body')
  ok(/Bijgewerkt/.test(opgelost), 'na je keuze is het weer bij')

  /* ---- Uitloggen ---- */
  await een.p.getByRole('button', { name: 'Uitloggen' }).click()
  await een.p.waitForTimeout(1800)
  const uit = await een.p.textContent('body')
  ok(/Account maken/.test(uit), 'na uitloggen staat het aanmeldscherm er weer')
  ok(!new RegExp(EMAIL).test(uit), 'en je adres staat er niet meer')
} finally {
  await b.close()
  await stopServer(server)
}

process.stdout.write(fails.length === 0 ? '\nACCOUNTS IN DE APP WERKEN\n' : `\n${fails.length} PROBLEMEN:\n${fails.join('\n')}\n`)
process.exit(fails.length === 0 ? 0 : 1)
