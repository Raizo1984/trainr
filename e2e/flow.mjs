/**
 * Doorloop van de app in een echte browser.
 *
 * Draait tegen een draaiende `npm run preview` (standaard poort 4173). Test wat
 * unit tests niet kunnen zien: dat de veiligheidsregels ook daadwerkelijk in de
 * interface landen.
 *
 *   npm run build && npm run preview &
 *   node e2e/flow.mjs
 */

import { chromium } from 'playwright'
import { slaWelkomOver } from './serverproces.mjs'

const BASE = process.env.E2E_BASE ?? 'http://localhost:4173'

const out = process.env.E2E_OUT ?? new URL('.', import.meta.url).pathname
const b = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
)
const fails = []
const ok = (cond, msg) => { process.stderr.write((cond ? 'PASS  ' : 'FAIL  ') + msg + '\n'); if (!cond) fails.push(msg) }
const step = (m) => process.stderr.write('  .. ' + m + '\n')

async function fresh(scheme = 'dark') {
  const ctx = await b.newContext({ viewport: { width: 1360, height: 1000 }, deviceScaleFactor: 2, colorScheme: scheme })
  await slaWelkomOver(ctx)
  // Externe verzoeken blokkeren: de fonts zijn in deze omgeving onbereikbaar en
  // laten de pagina anders hangen op netwerkverkeer dat niets met de app te maken heeft.
  await ctx.route('**', (route) => (route.request().url().startsWith(BASE) ? route.continue() : route.abort()))
  const p = await ctx.newPage()
  p.on('pageerror', (e) => fails.push('pageerror: ' + e.message))
  await p.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  return { ctx, p }
}

async function fillIntake(p, { redFlag = false, extremeFood = false } = {}) {
  await p.getByPlaceholder('Je voornaam').fill('Rasim')
  await p.getByPlaceholder('1983').fill('1983')
  await p.getByPlaceholder('182').fill('182')
  await p.getByRole('button', { name: /^Verder/ }).click()

  await p.getByPlaceholder('Bijvoorbeeld: geen bekende diagnoses').fill('geen bekende diagnoses')
  if (redFlag) await p.getByRole('button', { name: /Uitstralende pijn in een ledemaat/ }).click()
  await p.getByRole('button', { name: /^Verder/ }).click()   // training
  await p.getByRole('button', { name: /^Verder/ }).click()   // klachten
  await p.getByRole('button', { name: /^Verder/ }).click()   // voeding
  await p.getByRole('button', { name: 'kg' }).first().waitFor({ state: 'attached' }).catch(() => {})
  await p.locator('.input-groep input').first().fill('84')
  if (extremeFood) await p.getByRole('button', { name: /crashdiëten, vasten of intermittent fasting/ }).click()
  await p.getByRole('button', { name: /^Verder/ }).click()   // doelen
  await p.getByPlaceholder(/Tien strakke pull-ups/).fill('Tien pull-ups en pijnvrij traplopen')
  await p.getByRole('button', { name: /^Verder/ }).click()   // leven
  await p.getByRole('button', { name: /^Verder/ }).click()   // samenvatting
}

// ---- 1. Rode vlag pauzeert het programma -------------------------------
{
  const { ctx, p } = await fresh()
  step('flow1 intake'); await fillIntake(p, { redFlag: true })
  await p.waitForTimeout(900)
  const summary = await p.textContent('body')
  ok(/Training start in pauzestand/.test(summary), 'rode vlag: samenvatting kondigt pauze aan')
  ok(/Arts/.test(summary), 'rode vlag: doorverwijzing naar arts zichtbaar')
  await p.getByRole('button', { name: /Programma starten/ }).click()
  await p.waitForTimeout(800)
  const dash = await p.textContent('body')
  ok(/Training staat gepauzeerd/.test(dash), 'rode vlag: dashboard toont pauze')
  const startBtn = p.getByRole('button', { name: /Gepauzeerd/ })
  ok(await startBtn.isDisabled(), 'rode vlag: sessieknop is uitgeschakeld')
  await p.screenshot({ path: `${out}/flow-rodevlag.png`, fullPage: true })
  await ctx.close()
}

// ---- 2. Extreme voedingshistorie schakelt het beschermende model in -----
{
  const { ctx, p } = await fresh()
  step('flow2 intake'); await fillIntake(p, { extremeFood: true })
  await p.getByRole('button', { name: /Programma starten/ }).click()
  await p.waitForTimeout(600)
  await p.getByRole('button', { name: 'Voeding', exact: true }).first().click()
  await p.waitForTimeout(700)
  const food = await p.textContent('body')
  ok(/Beschermend/.test(food), 'hoog risico: beschermend model actief')
  ok(/Calorieën tellen of een caloriedoel stellen/.test(food), 'hoog risico: verboden lijst zichtbaar')
  ok(!/Calorieën zijn informatie/.test(food), 'hoog risico: calorieën niet als informatie aangeboden')
  await p.screenshot({ path: `${out}/flow-voeding-hoogrisico.png`, fullPage: true })
  await ctx.close()
}

// ---- 3. Sessie loggen van begin tot eind -------------------------------
{
  const { ctx, p } = await fresh()
  step('flow3 intake')
  await fillIntake(p)
  await p.getByRole('button', { name: /Programma starten/ }).click()
  await p.waitForTimeout(600)
  step('flow3 sessie starten')
  await p.getByRole('button', { name: /Sessie starten/ }).click()
  await p.waitForTimeout(700)
  ok(/Voor je begint/.test(await p.textContent('body')), 'sessie: vitals worden eerst gevraagd')
  step('flow3 beginnen')
  await p.getByRole('button', { name: /Beginnen met/ }).click()
  await p.waitForTimeout(600)

  // Drie sets loggen op de eerste oefening.
  step('flow3 sets')
  for (let i = 0; i < 3; i++) {
    await p.getByRole('button', { name: new RegExp(`Set ${i + 1} toevoegen`) }).click()
    await p.waitForTimeout(220)
  }
  const counter = await p.textContent('body')
  ok(/3\/\d+ *$|3\/\d+[^0-9]/.test(counter), 'sessie: teller telt gelogde sets')
  await p.screenshot({ path: `${out}/flow-sessie.png`, fullPage: true })

  step('flow3 opslaan')
  await p.getByRole('button', { name: 'Opslaan' }).click()
  await p.waitForTimeout(800)
  ok(/Sessie opgeslagen/.test(await p.textContent('body')), 'sessie: bevestiging na opslaan')

  await p.getByRole('button', { name: 'Vandaag', exact: true }).first().click()
  await p.waitForTimeout(800)
  const dash = await p.textContent('body')
  ok(/Totaal gelogd/.test(dash), 'sessie: dashboard toont de log')
  ok(/1 sessie afgerond|1 van 3/.test(dash), 'sessie: check-in verwerkt de nieuwe sessie')
  await ctx.close()
}

// ---- 4. Demodata en navigatie over alle tabbladen ----------------------
{
  const { ctx, p } = await fresh()
  step('flow4 demo')
  await p.getByRole('button', { name: /demodata/i }).click()
  await p.waitForTimeout(900)
  for (const tab of ['Trainen', 'Plan', 'Voeding', 'Metingen', 'Coach', 'Instellingen']) {
    await p.getByRole('button', { name: tab, exact: true }).first().click()
    await p.waitForTimeout(500)
    const body = await p.textContent('body')
    ok(body.length > 400, `navigatie: ${tab} rendert inhoud`)
  }
  await ctx.close()
}

await b.close()
process.stderr.write((fails.length === 0 ? '\nALLE FLOWS GESLAAGD\n' : `\n${fails.length} PROBLEMEN:\n` + fails.join('\n') + '\n'))
process.exit(fails.length === 0 ? 0 : 1)
