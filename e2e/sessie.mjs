/**
 * Het sessiescherm zoals je het in de zaal gebruikt.
 *
 * Eén oefening tegelijk, met één hand te bedienen, en een rustklok die vanzelf
 * loopt. Deze test controleert wat je met een lijst niet kunt zien: dat je maar
 * één oefening in beeld hebt, dat je ertussen kunt wisselen, en dat het advies
 * om zwaarder te gaan ook echt in het gewicht terechtkomt.
 *
 *   npm run build && npm start &
 *   node e2e/sessie.mjs
 */

import { chromium } from 'playwright'
import { slaWelkomOver } from './serverproces.mjs'

const BASE = process.env.E2E_BASE ?? 'http://localhost:3001'
const fails = []
const ok = (cond, msg) => {
  process.stderr.write((cond ? 'PASS  ' : 'FAIL  ') + msg + '\n')
  if (!cond) fails.push(msg)
}

const b = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
)
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' })
await slaWelkomOver(ctx)
const p = await ctx.newPage()
p.setDefaultTimeout(15000)
p.on('pageerror', (e) => ok(false, 'geen scriptfout: ' + e.message))

try {
  await p.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await p.getByRole('button', { name: /demodata/i }).click()
  await p.waitForTimeout(1200)
  await p.getByRole('button', { name: 'Trainen', exact: true }).first().click()
  await p.waitForTimeout(900)
  await p.getByRole('button', { name: /^Beginnen met/ }).click()
  await p.waitForTimeout(900)

  /* ---- Eén oefening tegelijk ---- */
  const body = await p.textContent('body')
  ok(/Oefening 1 van \d+/.test(body), 'de app zegt waar je bent in de sessie')

  const kaarten = await p.locator('.card').filter({ hasText: 'Reps' }).count()
  ok(kaarten <= 1, `er staat hoogstens één oefening met invoervelden in beeld (${kaarten})`)
  await p.screenshot({ path: 'e2e/sessie-een-oefening.png' })

  /* ---- Navigatie ---- */
  const volgende = p.getByRole('button', { name: 'Volgende oefening' })
  ok(await volgende.isVisible(), 'er is een knop naar de volgende oefening')
  const vorige = p.getByRole('button', { name: 'Vorige oefening' })
  ok(await vorige.isDisabled(), 'bij de eerste oefening kun je niet terug')

  await volgende.click()
  await p.waitForTimeout(700)
  ok(/Oefening 2 van \d+/.test((await p.textContent('body')) ?? ''), 'je gaat naar de tweede oefening')
  await vorige.click()
  await p.waitForTimeout(700)
  ok(/Oefening 1 van \d+/.test((await p.textContent('body')) ?? ''), 'en weer terug')

  /* ---- Rustklok ---- */
  await p.getByRole('button', { name: /Set \d+ toevoegen/ }).first().click()
  await p.waitForTimeout(900)
  const naSet = (await p.textContent('body')) ?? ''
  ok(/rust/.test(naSet), 'na een set loopt de rustklok')
  ok(/[0-9]:[0-9]{2}/.test(naSet), 'met een tijd erbij')
  await p.screenshot({ path: 'e2e/sessie-rust.png' })

  const voor = (await p.textContent('body')) ?? ''
  const tijdVoor = /(\d):(\d{2})\s*rust/.exec(voor)
  await p.waitForTimeout(2500)
  const na = (await p.textContent('body')) ?? ''
  const tijdNa = /(\d):(\d{2})\s*rust/.exec(na)
  if (tijdVoor && tijdNa) {
    const a = Number(tijdVoor[1]) * 60 + Number(tijdVoor[2])
    const c = Number(tijdNa[1]) * 60 + Number(tijdNa[2])
    ok(c < a, `de klok telt af (${tijdVoor[0].trim()} naar ${tijdNa[0].trim()})`)
  } else {
    ok(false, 'de klok is niet af te lezen')
  }

  await p.getByRole('button', { name: 'Klaar' }).click()
  await p.waitForTimeout(500)
  ok(!/rust/.test((await p.textContent('body')) ?? ''), 'je kunt de rust overslaan')

  /* ---- Zwaarder adviseren en overnemen ---- */
  // Reps naar de bovenkant en RIR ruim: dan hoort er een stap omhoog te komen.
  for (let i = 0; i < 6; i++) await p.getByRole('button', { name: 'Reps omhoog' }).first().click()
  await p.getByRole('button', { name: '4', exact: true }).first().click()
  await p.waitForTimeout(800)
  const advies = (await p.textContent('body')) ?? ''
  ok(/te licht/.test(advies), 'de app merkt dat de set te licht was')
  ok(/Zet de volgende set op/.test(advies), 'en biedt aan het gewicht over te nemen')
  await p.screenshot({ path: 'e2e/sessie-zwaarder.png' })

  // De waarde van de kilo-stepper staat tussen de twee knoppen in.
  const leesGewicht = () =>
    p.evaluate(() => {
      const omhoog = [...document.querySelectorAll('button')].find(
        (b) => b.getAttribute('aria-label') === 'Kg omhoog',
      )
      return omhoog?.previousElementSibling?.textContent?.trim() ?? null
    })

  const gewichtVoor = await leesGewicht()
  await p.getByRole('button', { name: /Zet de volgende set op/ }).click()
  await p.waitForTimeout(800)
  const gewichtNa = await leesGewicht()
  ok(gewichtNa !== gewichtVoor, `het gewicht is aangepast (${gewichtVoor} naar ${gewichtNa})`)

  const naOvernemen = (await p.textContent('body')) ?? ''
  ok(!/Zet de volgende set op/.test(naOvernemen) || /al een keer omhoog/.test(naOvernemen), 'daarna wordt er geen tweede stap aangeboden')
} finally {
  await b.close()
}

process.stderr.write(fails.length === 0 ? '\nSESSIESCHERM WERKT\n' : `\n${fails.length} PROBLEMEN:\n${fails.join('\n')}\n`)
process.exit(fails.length === 0 ? 0 : 1)
