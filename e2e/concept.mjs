/**
 * Een lopende sessie mag niet verdwijnen.
 *
 * Wat de app tot nu toe deed: alles tussen "Beginnen" en "Opslaan" stond
 * alleen in het geheugen van het scherm. Je logt drie sets, je krijgt een
 * telefoontje, de browser ruimt het tabblad op om geheugen vrij te maken, en
 * alles is weg. Op een telefoon gebeurt dat sneller dan je denkt.
 *
 * Deze test doet dat na door het tabblad echt te sluiten en een nieuw tabblad
 * in dezelfde browser te openen, net als een telefoon die je wegstopt.
 *
 *   npm run build && npm start &
 *   node e2e/concept.mjs
 */

import { chromium } from 'playwright'

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

async function open() {
  const p = await ctx.newPage()
  p.setDefaultTimeout(15000)
  p.on('pageerror', (e) => ok(false, 'geen scriptfout: ' + e.message))
  await p.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  return p
}

async function naarTrainen(p) {
  await p.getByRole('button', { name: 'Trainen', exact: true }).first().click()
  await p.waitForTimeout(900)
}

try {
  /* ---- Sessie beginnen en sets loggen ---- */
  const p1 = await open()
  await p1.getByRole('button', { name: /demodata/i }).click()
  await p1.waitForTimeout(1200)
  await naarTrainen(p1)

  await p1.getByRole('button', { name: /^Beginnen met/ }).click()
  await p1.waitForTimeout(800)

  for (let i = 0; i < 3; i++) {
    await p1.getByRole('button', { name: /Set \d+ toevoegen/ }).first().click()
    await p1.waitForTimeout(350)
  }
  const voor = await p1.textContent('body')
  ok(/3 van \d+ sets gelogd/.test(voor), 'drie sets staan er')

  // Een herkenbare waarde zetten, zodat we zien dat het écht dezelfde sets zijn.
  await p1.getByRole('button', { name: 'Reps omhoog' }).first().click()
  await p1.getByRole('button', { name: 'Reps omhoog' }).first().click()
  await p1.waitForTimeout(600)
  const repsVoor = await p1.locator('.card-quiet').first().innerText()

  /* ---- Telefoon in de tas: tabblad weg ---- */
  await p1.close()

  const p2 = await open()
  await p2.waitForTimeout(1200)

  // Op het dashboard moet je al zien dat er iets openstaat, anders moet je zelf
  // onthouden dat je halverwege was.
  const dashboard = (await p2.textContent('body')) ?? ''
  ok(/Sessie loopt, 3 sets gelogd/.test(dashboard), 'het dashboard meldt de lopende sessie')
  ok(/Sessie hervatten/.test(dashboard), 'en de knop zegt hervatten in plaats van starten')
  await p2.screenshot({ path: 'e2e/concept-dashboard.png' })

  await naarTrainen(p2)
  await p2.waitForTimeout(600)
  const na = await p2.textContent('body')
  ok(/sets gelogd/.test(na), 'de app komt meteen terug in de lopende sessie')
  ok(/3 van \d+ sets gelogd/.test(na), 'alle drie de sets staan er nog')

  const repsNa = await p2.locator('.card-quiet').first().innerText()
  ok(repsNa === repsVoor, 'ook de ingevulde waarden staan er nog')
  await p2.screenshot({ path: 'e2e/concept-hervat.png' })

  /* ---- Terug naar het overzicht en weer verder ---- */
  await p2.getByRole('button', { name: /Terug/ }).first().click()
  await p2.waitForTimeout(700)
  const overzicht = await p2.textContent('body')
  ok(/Verder met/.test(overzicht), 'het overzicht zegt dat je verder kunt in plaats van beginnen')

  await p2.getByRole('button', { name: /^Verder met/ }).click()
  await p2.waitForTimeout(700)
  ok(/3 van \d+ sets gelogd/.test((await p2.textContent('body')) ?? ''), 'verdergaan wist je sets niet')

  /* ---- Opslaan ruimt het concept op ---- */
  await p2.getByRole('button', { name: 'Opslaan' }).click()
  await p2.waitForTimeout(1500)
  const opgeslagen = await p2.textContent('body')
  ok(/Sessie opgeslagen/.test(opgeslagen), 'opslaan werkt')

  await p2.close()
  const p3 = await open()
  await naarTrainen(p3)
  await p3.waitForTimeout(800)
  const schoon = (await p3.textContent('body')) ?? ''
  ok(/^(?!.*sets gelogd).*$/s.test(schoon), 'na opslaan is het concept weg')
  ok(/Beginnen met/.test(schoon), 'en je begint weer met een lege sessie')

  /* ---- De opgeslagen sessie draagt de dag waarop hij begon ---- */
  const datums = await p3.evaluate(() => {
    const ruw = localStorage.getItem('trainr-v1')
    if (!ruw) return null
    const staat = JSON.parse(ruw)?.state
    const sessies = staat?.sessions ?? []
    return sessies.slice(-1)[0]?.date ?? null
  })
  const vandaag = new Date().toISOString().slice(0, 10)
  ok(datums === vandaag, `de sessie draagt de datum van het begin (${datums})`)
} finally {
  await b.close()
}

process.stderr.write(fails.length === 0 ? '\nLOPENDE SESSIE BLIJFT BEHOUDEN\n' : `\n${fails.length} PROBLEMEN:\n${fails.join('\n')}\n`)
process.exit(fails.length === 0 ? 0 : 1)
