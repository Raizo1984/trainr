/**
 * Bewaakt wat de app bij het eerste scherm over de lijn haalt.
 *
 * In een sportschool met slecht bereik telt elke kilobyte voor het scherm er
 * staat. De grafieken zijn het zwaarste onderdeel van de app en horen pas mee
 * te komen als je ze in beeld scrolt. Zonder deze controle sluipt dat er zo
 * weer in: één gewone import van `charts` in een scherm dat meteen laadt, en
 * de winst is weg zonder dat een test of de typecontrole iets merkt.
 *
 *   npm run build && npm run size
 */

import { gzipSync } from 'node:zlib'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const DIR = 'dist/assets'

// Alles wat nodig is voordat het eerste scherm iets kan tonen.
const FIRST_PAINT = /^(rolldown-runtime|index)-.*\.(js|css)$|^(primitives|motion|react)-.*\.js$/
const BUDGET_KB = 185

let files
try {
  files = readdirSync(DIR)
} catch {
  console.error(`Geen ${DIR}. Draai eerst: npm run build`)
  process.exit(1)
}

const gz = (f) => gzipSync(readFileSync(join(DIR, f)), { level: 9 }).length
const first = files.filter((f) => FIRST_PAINT.test(f))
const charts = files.filter((f) => f.startsWith('charts-'))

if (first.length === 0) {
  console.error('Geen brokken voor het eerste scherm gevonden; klopt de naamgeving in vite.config.ts nog?')
  process.exit(1)
}

const total = first.reduce((t, f) => t + gz(f), 0)
const kb = total / 1024

for (const f of first.sort((a, z) => gz(z) - gz(a))) {
  console.log(`${String((gz(f) / 1024).toFixed(1)).padStart(7)} kB  ${f}`)
}
console.log(`${String(kb.toFixed(1)).padStart(7)} kB  TOTAAL eerste scherm (gecomprimeerd)`)
for (const f of charts) console.log(`${String((gz(f) / 1024).toFixed(1)).padStart(7)} kB  ${f}  (uitgesteld, niet meegerekend)`)

if (kb > BUDGET_KB) {
  console.error(`\nTe zwaar: ${kb.toFixed(1)} kB boven de grens van ${BUDGET_KB} kB.`)
  console.error('Kijk of er een scherm of grafiek is die niet lui meer geladen wordt.')
  process.exit(1)
}
console.log(`\nBinnen de grens van ${BUDGET_KB} kB.`)
