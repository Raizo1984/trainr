/**
 * Getalvelden op een telefoon.
 *
 * Twee meldingen uit de praktijk, allebei bij "Realistische frequentie" in de
 * intake: je kon de 3 niet wissen (je typte 5 en er stond 35), en de pijltjes
 * om te verhogen waren op een telefoon nergens te bekennen.
 *
 * Deze test doet het na op een telefoonscherm: wissen, typen, de knoppen
 * gebruiken, en de grenzen van het veld.
 *
 *   npm run build && npm start &
 *   node e2e/getalveld.mjs
 */

import { chromium } from 'playwright'
import { slaWelkomOver } from './serverproces.mjs'

const BASE = process.env.E2E_BASE ?? 'http://localhost:3001'
const fails = []
const ok = (cond, msg) => {
  process.stdout.write(`${cond ? 'PASS  ' : 'FAIL  '}${msg}\n`)
  if (!cond) fails.push(msg)
}

const b = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
)
const ctx = await b.newContext({
  viewport: { width: 390, height: 844 },
  colorScheme: 'dark',
  hasTouch: true,
  isMobile: true,
})
await slaWelkomOver(ctx)
const p = await ctx.newPage()
p.setDefaultTimeout(15000)
p.on('pageerror', (e) => ok(false, 'geen scriptfout: ' + e.message))

/** Naar de stap van de intake waar de frequentie staat. */
async function naarTraining() {
  await p.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(800)
  await p.getByPlaceholder('Je voornaam').fill('Rasim')
  await p.getByPlaceholder('1983').fill('1983')
  await p.getByPlaceholder('182').fill('182')
  await p.getByRole('button', { name: /^Verder/ }).click()
  await p.getByPlaceholder('Bijvoorbeeld: geen bekende diagnoses').fill('geen bekende diagnoses')
  await p.getByRole('button', { name: /^Verder/ }).click()
  await p.waitForTimeout(400)
  if (!(await p.getByText('Realistische frequentie').isVisible())) {
    throw new Error('de stap met de frequentie is niet bereikt')
  }
}

try {
  await naarTraining()
  const veld = p.locator('.input-groep input').first()
  const frequentie = p
    .locator('label')
    .filter({ hasText: 'Realistische frequentie' })
    .locator('.input-groep input')
  ok(await frequentie.isVisible(), 'het frequentieveld staat in beeld')
  ok((await frequentie.inputValue()) === '3', 'er staat een startwaarde van 3')

  /* ---- Wissen en opnieuw typen ---- */
  await frequentie.click()
  await frequentie.press('ControlOrMeta+a')
  await frequentie.press('Backspace')
  ok((await frequentie.inputValue()) === '', 'je kunt het veld leegmaken')
  await frequentie.type('5')
  ok(
    (await frequentie.inputValue()) === '5',
    `na wissen en 5 typen staat er 5 (er staat: "${await frequentie.inputValue()}")`,
  )
  await p.keyboard.press('Tab')
  await p.waitForTimeout(300)
  ok((await frequentie.inputValue()) === '5', 'en dat blijft zo nadat je het veld verlaat')

  /* ---- De knoppen ---- */
  const omhoog = p
    .locator('label')
    .filter({ hasText: 'Realistische frequentie' })
    .getByRole('button', { name: /omhoog/i })
  const omlaag = p
    .locator('label')
    .filter({ hasText: 'Realistische frequentie' })
    .getByRole('button', { name: /omlaag/i })
  ok(await omhoog.isVisible(), 'de knop omhoog is op een telefoon zichtbaar')
  ok(await omlaag.isVisible(), 'de knop omlaag ook')

  const vak = await omhoog.boundingBox()
  ok(vak !== null && vak.height >= 40 && vak.width >= 40, `de knop is met een duim te raken (${vak?.width}x${vak?.height})`)

  await omhoog.click()
  await p.waitForTimeout(200)
  ok((await frequentie.inputValue()) === '6', 'omhoog maakt er 6 van')
  await omlaag.click()
  await omlaag.click()
  await p.waitForTimeout(200)
  ok((await frequentie.inputValue()) === '4', 'twee keer omlaag maakt er 4 van')

  /* ---- Grenzen ---- */
  // Doorklikken tot de knop zichzelf uitschakelt. Blijft hij klikbaar, dan
  // loopt de waarde door en valt de test op de bovengrens.
  for (let i = 0; i < 8 && !(await omhoog.isDisabled()); i++) {
    await omhoog.click()
    await p.waitForTimeout(120)
  }
  ok((await frequentie.inputValue()) === '7', 'boven het maximum van 7 komt hij niet')
  ok(await omhoog.isDisabled(), 'en dan is de knop omhoog uitgeschakeld')

  /* ---- Leeg laten valt terug op wat de app verwacht ---- */
  await frequentie.click()
  await frequentie.press('ControlOrMeta+a')
  await frequentie.press('Backspace')
  await p.keyboard.press('Tab')
  await p.waitForTimeout(300)
  ok(
    (await frequentie.inputValue()) === '3',
    `leeg verlaten valt terug op de standaardwaarde (er staat: "${await frequentie.inputValue()}")`,
  )

  /* ---- Geen letters ---- */
  await frequentie.click()
  await frequentie.press('ControlOrMeta+a')
  await frequentie.type('abc')
  ok((await frequentie.inputValue()) === '', 'letters komen er niet in')
  await frequentie.type('2')
  await p.keyboard.press('Tab')

  await p.screenshot({ path: 'e2e/getalveld.png' })
  ok(veld !== null, 'het scherm is vastgelegd')

  /* ---- Niets steekt buiten het scherm ---- */
  // Een veld dat breder is dan de kolom duwt de hele kaart uit beeld, en dat
  // zie je niet aan de waarde: het scherm knipt het gewoon af. Elke stap van
  // de intake wordt daarom nagemeten.
  for (let stap = 3; stap <= 8; stap++) {
    const buiten = await p.evaluate((breedte) => {
      const uit = []
      for (const e of document.querySelectorAll('.card *')) {
        const r = e.getBoundingClientRect()
        if (r.width > 0 && (r.right > breedte + 0.5 || r.left < -0.5)) {
          uit.push(`${e.tagName}.${(e.className?.toString?.() ?? '').slice(0, 40)}`)
        }
      }
      return uit.slice(0, 3)
    }, 390)
    ok(buiten.length === 0, `stap ${stap} past op een telefoon${buiten.length ? ': ' + buiten.join(', ') : ''}`)

    const verder = p.getByRole('button', { name: /^Verder/ })
    if (!(await verder.isEnabled().catch(() => false))) {
      // De voedings- en doelenstap laten je niet door zonder antwoord.
      const gewicht = p.locator('.input-groep input').first()
      if (await gewicht.isVisible().catch(() => false)) await gewicht.fill('84')
      const droom = p.getByPlaceholder(/Tien strakke pull-ups/)
      if (await droom.isVisible().catch(() => false)) await droom.fill('Tien pull-ups')
      await p.waitForTimeout(300)
    }
    if (!(await verder.isEnabled().catch(() => false))) break
    await verder.click()
    await p.waitForTimeout(400)
  }
} catch (e) {
  ok(false, 'geen uitzondering: ' + e.message)
} finally {
  await b.close()
}

if (fails.length) {
  console.error(`\n${fails.length} FOUT\n` + fails.map((f) => ' - ' + f).join('\n'))
  process.exit(1)
}
console.log('\nGETALVELDEN WERKEN')
