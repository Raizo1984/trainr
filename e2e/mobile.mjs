/**
 * Mobiele audit: loopt elk scherm af op 390 pixels breed en meldt horizontale
 * overflow, elementen die breder zijn dan het scherm en raakvlakken die te
 * klein zijn voor een duim.
 *
 *   npm run build && npm run preview &
 *   node e2e/mobile.mjs
 */

import { chromium } from 'playwright'

const BASE = process.env.E2E_BASE ?? 'http://localhost:4173'

const out = process.env.E2E_OUT ?? new URL('.', import.meta.url).pathname
const b = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
)
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'dark' })
await ctx.route('**', (r) => (r.request().url().startsWith(BASE) ? r.continue() : r.abort()))
const p = await ctx.newPage()
p.setDefaultTimeout(8000)

async function audit(name) {
  await p.waitForTimeout(600)
  const report = await p.evaluate(() => {
    const doc = document.documentElement
    const overflow = doc.scrollWidth - doc.clientWidth
    const wide = [...document.querySelectorAll('*')]
      .filter((el) => {
        const r = el.getBoundingClientRect()
        return r.width > window.innerWidth + 1 && r.height > 0
      })
      .slice(0, 6)
      .map((el) => `${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ').slice(0, 3).join('.')} w=${Math.round(el.getBoundingClientRect().width)}`)
    const small = [...document.querySelectorAll('button, a, input, select')]
      .filter((el) => {
        const r = el.getBoundingClientRect()
        return r.height > 0 && r.height < 32 && r.width < 32
      })
      .slice(0, 6)
      .map((el) => `${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 18)}" ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`)
    return { overflow, wide, small }
  })
  console.log(`\n[${name}] horizontale overflow: ${report.overflow}px`)
  if (report.wide.length) console.log('  te breed:', report.wide.join(' | '))
  if (report.small.length) console.log('  kleine raakvlakken:', report.small.join(' | '))
  await p.screenshot({ path: `${out}/m-${name}.png`, fullPage: true })
}

await p.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
await audit('01-intake')

// Door de hele intake heen op telefoonformaat.
await p.getByPlaceholder('Je voornaam').fill('Rasim')
await p.getByPlaceholder('1983').fill('1983')
await p.getByRole('button', { name: /^Verder/ }).click()
await audit('02-intake-medisch')
await p.getByPlaceholder('Bijvoorbeeld: geen bekende diagnoses').fill('geen bekende diagnoses')
await p.getByRole('button', { name: /^Verder/ }).click()
await audit('03-intake-training')
await p.getByRole('button', { name: /^Verder/ }).click()
await p.getByRole('button', { name: /^Klacht$/ }).click()
await audit('04-intake-klachten')
await p.getByRole('button', { name: /^Verder/ }).click()
await p.locator('input[type=number]').first().fill('84')
await audit('05-intake-voeding')
await p.getByRole('button', { name: /^Verder/ }).click()
await p.getByPlaceholder(/Tien strakke pull-ups/).fill('Tien pull-ups')
await audit('06-intake-doelen')
await p.getByRole('button', { name: /^Verder/ }).click()
await audit('07-intake-leven')
await p.getByRole('button', { name: /^Verder/ }).click()
await audit('08-intake-samenvatting')

await p.evaluate(() => localStorage.clear())
await p.reload({ waitUntil: 'domcontentloaded' })
await p.getByRole('button', { name: /demodata/i }).click()
await audit('09-vandaag')
for (const [tab, name] of [['Trainen', '10-trainen'], ['Plan', '11-plan'], ['Voeding', '12-voeding'], ['Metingen', '13-metingen'], ['Coach', '14-coach']]) {
  await p.getByRole('button', { name: tab, exact: true }).first().click()
  await audit(name)
}
// Sessie loggen op telefoonformaat: de zwaarste layout van de app.
await p.getByRole('button', { name: 'Trainen', exact: true }).first().click()
await p.waitForTimeout(500)
await p.getByRole('button', { name: /Beginnen met/ }).click()
await p.waitForTimeout(500)
await p.getByRole('button', { name: /Set 1 toevoegen/ }).click()
await p.waitForTimeout(300)
await p.getByRole('button', { name: /Pijn \/ vorm/ }).first().click()
await audit('15-sessie-set')
await b.close()
