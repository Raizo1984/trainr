/**
 * Wachtwoord vergeten, van de knop tot opnieuw inloggen.
 *
 * De mail gaat hier naar het logboek in plaats van naar een postbus, zodat de
 * test geen e-maildienst en geen inbox nodig heeft. Alles daarna is het echte
 * werk: de link die de gebruiker zou krijgen, het scherm dat eruit volgt, en
 * of het oude wachtwoord daarna inderdaad niet meer werkt.
 *
 *   DATABASE_URL=postgres://... node e2e/herstel.mjs
 */

import { chromium } from 'playwright'
import { startServer, stopServer, wachtOpServer } from './serverproces.mjs'

const APP_PORT = 4387
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

let link = null
const server = startServer({
  PORT: String(APP_PORT),
  DATABASE_URL: DB,
  DATABASE_SSL: 'uit',
  MAIL_LOGBOEK: 'aan',
  APP_URL: `http://localhost:${APP_PORT}`,
})
server.stdout.on('data', (d) => {
  const m = /(http:\/\/\S*wachtwoord-herstellen\?token=[^\s]+)/.exec(String(d))
  if (m) link = m[1]
})

const BASE = `http://localhost:${APP_PORT}`
await wachtOpServer(`${BASE}/api/account`)

const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
const EMAIL = 'vergeetachtig@voorbeeld.nl'

try {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' })
  const p = await ctx.newPage()
  p.setDefaultTimeout(15000)
  p.on('pageerror', (e) => ok(false, 'geen scriptfout: ' + e.message))

  await p.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await p.getByRole('button', { name: /demodata/i }).click()
  await p.waitForTimeout(1200)

  const gemaakt = await p.evaluate(
    async ([email]) => {
      const res = await fetch('/api/account/registreren', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Trainr-Client': '1' },
        body: JSON.stringify({ email, wachtwoord: 'eerste lange wachtwoord', toestemming: true }),
      })
      return res.status
    },
    [EMAIL],
  )
  ok(gemaakt === 201, 'account aangemaakt')

  // Uitloggen, want vergeten doe je als je eruit ligt.
  await p.evaluate(() =>
    fetch('/api/account/uitloggen', { method: 'POST', headers: { 'X-Trainr-Client': '1' } }),
  )
  await p.reload({ waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(1500)

  await p.getByRole('button', { name: 'Instellingen', exact: true }).first().click()
  await p.waitForTimeout(1200)
  await p.getByRole('button', { name: 'Inloggen', exact: true }).first().click()
  await p.waitForTimeout(500)

  const inlogScherm = (await p.textContent('body')) ?? ''
  ok(/Wachtwoord vergeten\?/.test(inlogScherm), 'de vraag staat bij het inlogscherm')

  await p.getByLabel('E-mailadres').fill(EMAIL)
  await p.getByRole('button', { name: 'Wachtwoord vergeten?' }).click()
  await p.waitForTimeout(400)
  await p.getByRole('button', { name: 'Stuur me een link' }).click()
  await p.waitForTimeout(2000)

  const naAanvraag = (await p.textContent('body')) ?? ''
  ok(/Als er een account bij dit adres hoort/.test(naAanvraag), 'de app zegt niet of het adres bestaat')
  await p.screenshot({ path: 'e2e/herstel-aangevraagd.png' })

  ok(typeof link === 'string' && link.includes('token='), 'er is een herstellink verstuurd')

  /* ---- De link openen ---- */
  await p.goto(link, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(1200)
  const scherm = (await p.textContent('body')) ?? ''
  ok(/Kies een nieuw wachtwoord/.test(scherm), 'de link opent het herstelscherm')
  ok(!/Vandaag|Trainen|Metingen/.test(scherm), 'en toont verder niets van de app')
  await p.screenshot({ path: 'e2e/herstel-scherm.png' })

  const opslaan = p.getByRole('button', { name: 'Opslaan' })
  await p.getByLabel('Nieuw wachtwoord').fill('kort')
  ok(await opslaan.isDisabled(), 'een te kort wachtwoord kun je niet opslaan')

  await p.getByLabel('Nieuw wachtwoord').fill('tweede lange wachtwoord')
  await opslaan.click()
  await p.waitForTimeout(2000)
  const gelukt = (await p.textContent('body')) ?? ''
  ok(/Gelukt/.test(gelukt), 'het wachtwoord is gewijzigd')
  ok(/overal uitgelogd/.test(gelukt), 'en de app zegt dat je overal uitgelogd bent')

  /* ---- Opnieuw inloggen ---- */
  const oud = await p.evaluate(
    async ([email]) => {
      const res = await fetch('/api/account/inloggen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Trainr-Client': '1' },
        body: JSON.stringify({ email, wachtwoord: 'eerste lange wachtwoord' }),
      })
      return res.status
    },
    [EMAIL],
  )
  ok(oud === 401, 'het oude wachtwoord werkt niet meer')

  const nieuw = await p.evaluate(
    async ([email]) => {
      const res = await fetch('/api/account/inloggen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Trainr-Client': '1' },
        body: JSON.stringify({ email, wachtwoord: 'tweede lange wachtwoord' }),
      })
      return res.status
    },
    [EMAIL],
  )
  ok(nieuw === 200, 'het nieuwe wachtwoord werkt')

  /* ---- Een tweede keer dezelfde link ---- */
  await p.goto(link, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(1000)
  await p.getByLabel('Nieuw wachtwoord').fill('derde lange wachtwoord')
  await p.getByRole('button', { name: 'Opslaan' }).click()
  await p.waitForTimeout(1500)
  ok(/al gebruikt/.test((await p.textContent('body')) ?? ''), 'dezelfde link werkt maar één keer')

  /* ---- Zonder code in het adres ---- */
  await p.goto(`${BASE}/wachtwoord-herstellen`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(1000)
  ok(/onvolledig/.test((await p.textContent('body')) ?? ''), 'een link zonder code zegt wat er mis is')
} finally {
  await b.close()
  await stopServer(server)
}

process.stdout.write(fails.length === 0 ? '\nWACHTWOORD VERGETEN WERKT\n' : `\n${fails.length} PROBLEMEN:\n${fails.join('\n')}\n`)
process.exit(fails.length === 0 ? 0 : 1)
