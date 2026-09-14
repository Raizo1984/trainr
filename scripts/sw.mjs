/**
 * Schrijft de service worker na de build.
 *
 * De lijst met bestanden kan pas hier ontstaan: vite zet een hash in elke
 * bestandsnaam, en die kent niemand vooraf. Daarom wordt sw.js gegenereerd in
 * plaats van met de hand bijgehouden. Vergeet je zo'n lijst bij te werken, dan
 * werkt de app offline half, en dat merk je pas in de sportschool.
 *
 *   npm run build   (draait dit automatisch)
 */

import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const DIST = 'dist'

if (!existsSync(DIST)) {
  console.error(`Geen ${DIST}. Draai eerst vite build.`)
  process.exit(1)
}

/** Alles wat nodig is om de app te starten zonder netwerk. */
function collect(dir, prefix = '') {
  const out = []
  for (const name of readdirSync(join(DIST, dir), { withFileTypes: true })) {
    if (name.isDirectory()) out.push(...collect(join(dir, name.name), `${prefix}${name.name}/`))
    else out.push(`${dir === '.' ? '' : dir + '/'}${name.name}`)
  }
  return out
}

const alles = collect('.')
const precache = alles.filter(
  (f) =>
    f === 'index.html' ||
    f === 'manifest.webmanifest' ||
    f.startsWith('assets/') ||
    /^(icon|apple-touch-icon)[^/]*\.(png|svg)$/.test(f),
)

// De versie volgt de inhoud. Verandert er één byte, dan krijgt de service
// worker een andere naam voor zijn cache en haalt hij alles opnieuw op.
const hash = createHash('sha256')
for (const f of precache.sort()) hash.update(f).update(readFileSync(join(DIST, f)))
const VERSION = hash.digest('hex').slice(0, 12)

const sw = `/* Gegenereerd door scripts/sw.mjs. Niet met de hand aanpassen. */
const VERSIE = '${VERSION}'
const CACHE = 'trainr-' + VERSIE
const SHELL = ${JSON.stringify(precache.map((f) => '/' + f).sort(), null, 2)}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((namen) => Promise.all(namen.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  )
})

/*
 * Bewust géén skipWaiting. Een nieuwe versie neemt het pas over als de app
 * helemaal gesloten is. Zou hij midden in een sessie wisselen, dan verdwijnen
 * de brokken van de oude versie uit de cache terwijl die pagina ze nog nodig
 * heeft, en sta je zonder bereik met een halve app in je hand.
 */

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // De coach nooit uit de cache: een oud antwoord op een nieuwe vraag is
  // erger dan geen antwoord.
  if (url.pathname.startsWith('/api/')) return

  // Navigatie komt altijd bij dezelfde pagina uit; dit is een SPA.
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('/index.html').then((hit) => hit || fetch(req)),
    )
    return
  }

  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit
      return fetch(req).then((res) => {
        // Alleen geslaagde antwoorden van onszelf bewaren.
        if (res.ok && res.type === 'basic') {
          const kopie = res.clone()
          caches.open(CACHE).then((c) => c.put(req, kopie))
        }
        return res
      })
    }),
  )
})
`

writeFileSync(join(DIST, 'sw.js'), sw)
const kb = precache.reduce((t, f) => t + readFileSync(join(DIST, f)).length, 0) / 1024
console.log(`sw.js geschreven, versie ${VERSION}: ${precache.length} bestanden, ${kb.toFixed(0)} kB offline beschikbaar`)
