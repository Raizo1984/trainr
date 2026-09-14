/**
 * Maakt de app-iconen voor het beginscherm van een telefoon.
 *
 * Er is in deze omgeving geen beeldgereedschap, maar wel een browser. Die kan
 * SVG naar PNG omzetten zonder dat het project er een afhankelijkheid bij
 * krijgt. De uitkomst staat in public/ en gaat mee in de repo, zodat een
 * gewone build geen browser nodig heeft.
 *
 *   node scripts/icons.mjs
 */

import { chromium } from 'playwright'
import { writeFile } from 'node:fs/promises'

const BRAND_1 = '#5b4fd6'
const BRAND_2 = '#2a78d6'

/**
 * `padding` houdt het beeldmerk binnen de veilige cirkel die Android over een
 * maskable icoon legt. Zonder die marge snijdt het toestel de punten eraf.
 */
function svg({ size, padding, radius }) {
  const inner = size - padding * 2
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${BRAND_1}"/>
      <stop offset="1" stop-color="${BRAND_2}"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${radius}" fill="url(#g)"/>
  <g transform="translate(${padding} ${padding}) scale(${inner / 24})">
    <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"
      fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`
}

const TARGETS = [
  { file: 'icon-192.png', size: 192, padding: 40, radius: 40 },
  { file: 'icon-512.png', size: 512, padding: 106, radius: 108 },
  // Maskable: het toestel snijdt er zelf een vorm uit, dus ruimere marge en
  // een volledig gevulde achtergrond zonder afgeronde hoeken.
  { file: 'icon-maskable-512.png', size: 512, padding: 140, radius: 0 },
  { file: 'apple-touch-icon.png', size: 180, padding: 38, radius: 0 },
]

const b = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
})
const p = await b.newPage()

for (const t of TARGETS) {
  const markup = svg(t)
  await p.setViewportSize({ width: t.size, height: t.size })
  await p.setContent(
    `<body style="margin:0;background:transparent">${markup}</body>`,
    { waitUntil: 'load' },
  )
  const png = await p.screenshot({ omitBackground: true })
  await writeFile(new URL(`../public/${t.file}`, import.meta.url), png)
  console.log(`${t.file}  ${t.size}x${t.size}  ${(png.length / 1024).toFixed(1)} kB`)
}

await writeFile(new URL('../public/icon.svg', import.meta.url), svg({ size: 512, padding: 106, radius: 108 }))
console.log('icon.svg')
await b.close()
