/**
 * Werkt het inspreken van een set echt, van knop tot ingevuld veld?
 *
 * De spraakherkenning van de browser is hier niet aan te sturen, dus die wordt
 * vervangen door een nepversie die één vaste zin teruggeeft. Wat daarna gebeurt
 * is wél het echte werk: het parsen, het invullen van de set en het oordeel dat
 * daarop volgt. Precies het stuk waar een fout stil blijft.
 *
 *   npm run build && npm start &
 *   node e2e/speech.mjs
 */

import { chromium } from 'playwright'
import { slaWelkomOver } from './serverproces.mjs'

const BASE = process.env.E2E_BASE ?? 'http://localhost:3001'
const ZIN = process.env.SPEECH_ZIN ?? 'twaalf reps zestig kilo rir twee'

const b = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
)
const fails = []
const ok = (cond, msg) => {
  process.stderr.write((cond ? 'PASS  ' : 'FAIL  ') + msg + '\n')
  if (!cond) fails.push(msg)
}

const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' })
await slaWelkomOver(ctx)

// Nepherkenner: levert de zin meteen als definitief resultaat.
await ctx.addInitScript((zin) => {
  class NepHerkenning {
    start() {
      setTimeout(() => {
        this.onresult?.({
          resultIndex: 0,
          results: { length: 1, 0: { 0: { transcript: zin }, isFinal: true, length: 1 } },
        })
        this.onend?.()
      }, 30)
    }
    stop() { this.onend?.() }
    abort() {}
  }
  Object.defineProperty(window, 'SpeechRecognition', { value: NepHerkenning, writable: true })
}, ZIN)

const p = await ctx.newPage()
p.setDefaultTimeout(12000)
p.on('pageerror', (e) => ok(false, 'geen scriptfout: ' + e.message))

await p.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
await p.getByRole('button', { name: /demodata/i }).click()
await p.waitForTimeout(1200)
await p.getByRole('button', { name: 'Trainen', exact: true }).first().click()
await p.waitForTimeout(800)
await p.getByRole('button', { name: /^Beginnen met/ }).click()
await p.waitForTimeout(800)
await p.getByRole('button', { name: /Set \d+ toevoegen/ }).first().click()
await p.waitForTimeout(500)

const knop = p.getByRole('button', { name: /Set inspreken/ }).first()
ok(await knop.isVisible(), 'de knop om in te spreken staat er')

await knop.click()
await p.waitForTimeout(700)

const kaart = p.locator('.card').filter({ hasText: 'Reps' }).first()
const waarden = await p.evaluate(() => {
  const nums = [...document.querySelectorAll('main *')]
    .filter((e) => e.children.length === 0 && /^\d+([.,]\d+)?$/.test((e.textContent || '').trim()))
    .map((e) => (e.textContent || '').trim())
  return nums
})
ok(waarden.includes('12'), `reps staat op 12 (gezien: ${waarden.slice(0, 8).join(', ')})`)
ok(waarden.includes('60'), 'gewicht staat op 60')

const body = await p.textContent('body')
ok(/Ingevuld:/.test(body), 'de app toont wat het begrepen heeft')
ok(/12 reps/.test(body) && /60 kg/.test(body), 'de bevestiging noemt reps en kilo')
ok(/RIR 2/.test(body), 'RIR is meegenomen')

await p.screenshot({ path: 'e2e/speech.png' })
await b.close()
process.stderr.write(fails.length === 0 ? '\nINSPREKEN WERKT\n' : `\n${fails.length} PROBLEMEN:\n${fails.join('\n')}\n`)
process.exit(fails.length === 0 ? 0 : 1)
