/**
 * Het ophaalscript voor oefeningsbeeld, tegen een nepversie van wger.
 *
 * Draait tegen een eigen server in plaats van wger zelf, zodat de test geen
 * netwerk nodig heeft en niet afhangt van wat er vandaag in die databank staat.
 * Wat hier gecontroleerd wordt, is het gedrag dat ertoe doet: dat beeld zonder
 * licentie of maker wordt geweigerd, dat alles op onbevestigd binnenkomt, en
 * dat een onverwacht antwoord hard stukloopt in plaats van rommel weg te
 * schrijven.
 *
 *   node e2e/wger.mjs
 */

import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync, mkdirSync, cpSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import http from 'node:http'

const PORT = 4393
const fails = []
const ok = (cond, msg) => {
  process.stdout.write(`${cond ? 'PASS  ' : 'FAIL  '}${msg}\n`)
  if (!cond) fails.push(msg)
}

// Eén doorzichtige pixel, genoeg om te downloaden.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

let modus = 'goed'

const stub = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)

  if (url.pathname === '/plaatje.png') {
    res.writeHead(200, { 'Content-Type': 'image/png' })
    res.end(PNG)
    return
  }

  if (url.pathname.startsWith('/api/v2/exercise/search')) {
    if (modus === 'kapot') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ iets: 'anders' }))
      return
    }
    const term = url.searchParams.get('term') ?? ''
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ suggestions: [{ data: { id: 1, base_id: 42, name: `wger: ${term}` } }] }))
    return
  }

  if (url.pathname.startsWith('/api/v2/exerciseimage')) {
    const zonderLicentie = modus === 'geen-licentie'
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      results: [{
        image: `http://localhost:${PORT}/plaatje.png`,
        is_main: true,
        license_author: zonderLicentie ? '' : 'Jane Doe',
        license_title: zonderLicentie ? '' : 'CC-BY-SA 4.0',
      }],
    }))
    return
  }

  res.writeHead(404)
  res.end()
})
await new Promise((r) => stub.listen(PORT, r))

// In een kopie werken, zodat de echte repo niet verandert.
const werk = mkdtempSync(join(tmpdir(), 'wger-'))
mkdirSync(join(werk, 'src/domain'), { recursive: true })
mkdirSync(join(werk, 'scripts'), { recursive: true })
mkdirSync(join(werk, 'public/exercises'), { recursive: true })
cpSync('scripts/wger.mjs', join(werk, 'scripts/wger.mjs'))
cpSync('src/domain/exercises.ts', join(werk, 'src/domain/exercises.ts'))
writeFileSync(join(werk, 'src/domain/exerciseMedia.generated.json'), '{}\n')

/*
 * Asynchroon starten, niet met spawnSync. De nepserver draait in dit proces, en
 * spawnSync blokkeert de hele gebeurtenislus: het kind wacht dan op antwoorden
 * die pas kunnen komen als het kind klaar is. Dat loopt eeuwig door.
 */
function draai(extraEnv = {}) {
  return new Promise((resolve) => {
    const kind = spawn('node', ['scripts/wger.mjs'], {
      cwd: werk,
      env: { ...process.env, WGER_API: `http://localhost:${PORT}/api/v2`, ...extraEnv },
    })
    let stdout = ''
    let stderr = ''
    kind.stdout.on('data', (d) => (stdout += d))
    kind.stderr.on('data', (d) => (stderr += d))
    kind.on('close', (status) => resolve({ status, stdout, stderr }))
  })
}

try {
  const r = await draai()
  ok(r.status === 0, 'het script loopt door zonder te crashen')
  ok(/treden gevonden in de app/.test(r.stdout), 'het leest de treden uit de app')

  const register = JSON.parse(readFileSync(join(werk, 'src/domain/exerciseMedia.generated.json'), 'utf8'))
  const rijen = Object.values(register)
  ok(rijen.length > 50, `er zijn veel treden verwerkt (${rijen.length})`)
  ok(rijen.every((m) => m.bevestigd === false), 'alles komt binnen als onbevestigd')
  ok(rijen.every((m) => m.licentie && m.auteur), 'elk beeld draagt licentie en maker mee')
  ok(rijen.every((m) => m.trede && m.bron), 'elk beeld onthoudt welke trede en welke wger-oefening')
  ok(existsSync(join(werk, 'public/exercises', rijen[0].bestand)), 'het beeld staat op schijf')
  ok(/bevestigd: false/.test(r.stdout), 'het script zegt dat alles nagekeken moet worden')

  // Zonder licentie of maker mag er niets binnenkomen.
  writeFileSync(join(werk, 'src/domain/exerciseMedia.generated.json'), '{}\n')
  modus = 'geen-licentie'
  const zonder = await draai()
  const leeg = JSON.parse(readFileSync(join(werk, 'src/domain/exerciseMedia.generated.json'), 'utf8'))
  ok(Object.keys(leeg).length === 0, 'beeld zonder licentie of maker komt er niet in')
  ok(/mist licentie of maker/.test(zonder.stdout), 'en het script zegt waarom')

  // Een onverwacht antwoord moet opvallen, niet stil rommel wegschrijven.
  writeFileSync(join(werk, 'src/domain/exerciseMedia.generated.json'), '{}\n')
  modus = 'kapot'
  const kapot = await draai()
  const naKapot = JSON.parse(readFileSync(join(werk, 'src/domain/exerciseMedia.generated.json'), 'utf8'))
  ok(Object.keys(naKapot).length === 0, 'een onverwacht antwoord levert geen half register op')
  ok(/Onverwacht antwoord van wger/.test(kapot.stdout), 'het script meldt wat het wél kreeg')

  // Wat al bevestigd is, blijft staan.
  modus = 'goed'
  writeFileSync(
    join(werk, 'src/domain/exerciseMedia.generated.json'),
    JSON.stringify({ 'squat-1': { bestand: 'x.png', trede: 'Box squat', bron: 'Eigen keuze', licentie: 'CC', auteur: 'A', bevestigd: true } }, null, 2),
  )
  await draai()
  const na = JSON.parse(readFileSync(join(werk, 'src/domain/exerciseMedia.generated.json'), 'utf8'))
  ok(na['squat-1'].bron === 'Eigen keuze', 'een bevestigde koppeling wordt niet overschreven')
} finally {
  stub.close()
  rmSync(werk, { recursive: true, force: true })
}

process.stdout.write(fails.length === 0 ? '\nOPHALEN WERKT\n' : `\n${fails.length} PROBLEMEN:\n${fails.join('\n')}\n`)
process.exit(fails.length === 0 ? 0 : 1)
