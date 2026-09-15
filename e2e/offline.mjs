/**
 * Werkt de app zonder bereik?
 *
 * Dit is de reden dat de service worker bestaat: in een sportschool valt het
 * netwerk weg, en dan moet je nog steeds je set kunnen loggen. Een unit test
 * kan dit niet zien, want die kent geen cache en geen tweede laadbeurt.
 *
 *   npm run build && npm start &
 *   node e2e/offline.mjs
 */

import { chromium } from 'playwright'
import { slaWelkomOver } from './serverproces.mjs'

const BASE = process.env.E2E_BASE ?? 'http://localhost:3001'
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
const p = await ctx.newPage()
p.setDefaultTimeout(15000)

await p.goto(`${BASE}/`, { waitUntil: 'load' })

const sw = await p.evaluate(async () => {
  const reg = await navigator.serviceWorker.ready
  return { scope: reg.scope, actief: !!reg.active }
})
ok(sw.actief, 'service worker is actief')
ok(sw.scope.endsWith('/'), 'service worker geldt voor de hele app')

const manifest = await p.evaluate(async () => {
  const res = await fetch('/manifest.webmanifest')
  const m = await res.json()
  return { display: m.display, start: m.start_url, iconen: m.icons?.length ?? 0, maskable: m.icons?.some((i) => i.purpose === 'maskable') }
})
ok(manifest.display === 'standalone', 'manifest opent zonder browserbalk')
ok(manifest.start === '/', 'manifest start op de hoofdpagina')
ok(manifest.iconen >= 3, `manifest heeft iconen (${manifest.iconen})`)
ok(manifest.maskable === true, 'manifest heeft een maskable icoon voor Android')

await p.getByRole('button', { name: /demodata/i }).click()
await p.waitForTimeout(1500)

const cache = await p.evaluate(async () => {
  const namen = await caches.keys()
  const c = await caches.open(namen[0])
  const keys = await c.keys()
  return { naam: namen[0] ?? '', aantal: keys.length, paden: keys.map((k) => new URL(k.url).pathname) }
})
ok(cache.aantal > 10, `de app staat in de cache (${cache.aantal} bestanden)`)
ok(cache.paden.includes('/index.html'), 'de pagina zelf staat in de cache')
ok(cache.paden.some((x) => x.startsWith('/assets/')), 'de code staat in de cache')
ok(!cache.paden.some((x) => x.startsWith('/api/')), 'antwoorden van de coach staan niet in de cache')

await ctx.setOffline(true)
await p.reload({ waitUntil: 'load' })
await p.waitForTimeout(1800)

const body = (await p.textContent('body')) ?? ''
ok(body.length > 800, `app start zonder netwerk (${body.length} tekens)`)
ok(/Vandaag/.test(body) && /Trainen/.test(body), 'navigatie staat er zonder netwerk')
ok(/Week|Blok|sessie/i.test(body), 'je eigen data staat er zonder netwerk')

// Een scherm dat pas bij gebruik geladen wordt, is de echte test: dat bestand
// is nooit door de eerste pagina opgevraagd.
await p.getByRole('button', { name: 'Metingen', exact: true }).first().click()
await p.waitForTimeout(1500)
const metingen = (await p.textContent('body')) ?? ''
ok(metingen.length > 800, `een lui geladen scherm werkt zonder netwerk (${metingen.length} tekens)`)

await b.close()
process.stderr.write(fails.length === 0 ? '\nOFFLINE WERKT\n' : `\n${fails.length} PROBLEMEN:\n${fails.join('\n')}\n`)
process.exit(fails.length === 0 ? 0 : 1)
