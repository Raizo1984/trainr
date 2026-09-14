/**
 * Haalt oefeningsbeeld op uit wger.
 *
 * Draai dit waar wger bereikbaar is; in sommige omgevingen blokkeert het
 * netwerkbeleid externe hosts.
 *
 *   node scripts/wger.mjs            # zoeken en downloaden
 *   node scripts/wger.mjs --lijst    # alleen tonen wat er nu in het register staat
 *
 * Wat het doet:
 * 1. Zoekt per trede een oefening in wger, op basis van de naam van die trede.
 * 2. Pakt het hoofdbeeld, met licentie en maker.
 * 3. Zet het beeld in public/exercises/ en de gegevens in het register.
 * 4. Zet elk nieuw beeld op `bevestigd: false`.
 *
 * Dat laatste is geen slag om de arm maar de kern. Een zoekopdracht op naam
 * levert bij "Box squat (hoge box)" vroeg of laat een plaatje van iets anders,
 * en een verkeerd beeld bij een oefening leert iemand een beweging aan die hij
 * niet moest doen. Onbevestigd beeld toont de app niet. Kijk het overzicht na
 * en zet `bevestigd` met de hand op true.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const API = process.env.WGER_API ?? 'https://wger.de/api/v2'
const REGISTER = 'src/domain/exerciseMedia.generated.json'
const BEELDMAP = 'public/exercises'
const TAAL = 2 // Engels; de namen van oefeningen zijn daar het volledigst.

const register = existsSync(REGISTER) ? JSON.parse(readFileSync(REGISTER, 'utf8')) : {}

if (process.argv.includes('--lijst')) {
  const rijen = Object.entries(register)
  if (rijen.length === 0) {
    console.log('Het register is leeg. Draai dit script zonder --lijst.')
    process.exit(0)
  }
  console.log(`${rijen.length} beelden, waarvan ${rijen.filter(([, m]) => m.bevestigd).length} bevestigd.\n`)
  for (const [stepId, m] of rijen) {
    console.log(`${m.bevestigd ? '[x]' : '[ ]'} ${stepId}`)
    console.log(`     trede : ${m.trede ?? '?'}`)
    console.log(`     wger  : ${m.bron}`)
    console.log(`     licentie: ${m.licentie} (${m.auteur})`)
  }
  process.exit(0)
}

/** De treden uit de app, zonder de app te hoeven importeren. */
function ladders() {
  const bron = readFileSync('src/domain/exercises.ts', 'utf8')
  const uit = []
  for (const m of bron.matchAll(/\{\s*id:\s*'([^']+)',\s*name:\s*'([^']+)',\s*rung:/g)) {
    uit.push({ stepId: m[1], naam: m[2] })
  }
  return uit
}

/**
 * De naam van een trede omzetten naar een zoekterm.
 *
 * Nederlandse toevoegingen tussen haakjes zeggen iets over de uitvoering, niet
 * over welke oefening het is, dus die gaan eruit. Wat overblijft is meestal al
 * de internationale naam.
 */
function zoekterm(naam) {
  return naam
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s*\/\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function haal(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} bij ${url}`)
  return res.json()
}

/** Controleert of het antwoord eruitziet zoals verwacht, en zegt anders wat het wél was. */
function eis(voorwaarde, wat, gekregen) {
  if (!voorwaarde) {
    throw new Error(
      `Onverwacht antwoord van wger: ${wat}. Gekregen: ${JSON.stringify(gekregen).slice(0, 300)}`,
    )
  }
}

async function zoekOefening(term) {
  const data = await haal(`${API}/exercise/search/?term=${encodeURIComponent(term)}&language=${TAAL}&format=json`)
  eis(Array.isArray(data?.suggestions), 'zoekresultaat zonder suggestions', data)
  const eerste = data.suggestions[0]
  if (!eerste) return null
  const d = eerste.data ?? eerste
  eis(typeof d?.name === 'string', 'suggestie zonder naam', eerste)
  const baseId = d.base_id ?? d.baseId ?? d.id
  eis(baseId !== undefined, 'suggestie zonder id', eerste)
  return { naam: d.name, baseId }
}

async function hoofdbeeld(baseId) {
  const data = await haal(`${API}/exerciseimage/?exercise_base=${baseId}&format=json`)
  eis(Array.isArray(data?.results), 'beeldenlijst zonder results', data)
  if (data.results.length === 0) return null
  const beeld = data.results.find((r) => r.is_main) ?? data.results[0]
  eis(typeof beeld?.image === 'string', 'beeld zonder url', beeld)
  return {
    url: beeld.image,
    auteur: beeld.license_author || '',
    licentie: beeld.license_title || beeld.license_full_name || beeld.license || '',
  }
}

async function download(url, doel) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} bij ophalen ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  writeFileSync(doel, buf)
  return buf.length
}

mkdirSync(BEELDMAP, { recursive: true })

const treden = ladders()
console.log(`${treden.length} treden gevonden in de app.\n`)

let nieuw = 0
let overgeslagen = 0
const problemen = []

for (const { stepId, naam } of treden) {
  if (register[stepId]?.bevestigd) {
    overgeslagen++
    continue
  }
  const term = zoekterm(naam)
  try {
    const gevonden = await zoekOefening(term)
    if (!gevonden) {
      problemen.push(`${stepId}: niets gevonden voor "${term}"`)
      continue
    }
    const beeld = await hoofdbeeld(gevonden.baseId)
    if (!beeld) {
      problemen.push(`${stepId}: "${gevonden.naam}" heeft geen beeld`)
      continue
    }
    // Zonder licentie en maker mag het beeld niet mee. CC-BY-SA vraagt allebei.
    if (!beeld.licentie || !beeld.auteur) {
      problemen.push(`${stepId}: "${gevonden.naam}" mist licentie of maker, overgeslagen`)
      continue
    }

    const ext = (beeld.url.split('.').pop() ?? 'jpg').split('?')[0].slice(0, 4)
    const bestand = `${stepId}.${ext}`
    const bytes = await download(beeld.url, join(BEELDMAP, bestand))

    register[stepId] = {
      bestand,
      trede: naam,
      bron: gevonden.naam,
      licentie: beeld.licentie,
      auteur: beeld.auteur,
      bevestigd: false,
    }
    nieuw++
    console.log(`  ${stepId}  "${naam}" -> "${gevonden.naam}"  ${(bytes / 1024).toFixed(0)} kB`)
  } catch (error) {
    problemen.push(`${stepId}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

writeFileSync(REGISTER, JSON.stringify(register, null, 2) + '\n')

console.log(`\n${nieuw} nieuw, ${overgeslagen} al bevestigd, ${problemen.length} niet gelukt.`)
if (problemen.length > 0) {
  console.log('\nNiet gelukt:')
  for (const p of problemen) console.log(`  ${p}`)
}
console.log(`\nAlles staat op bevestigd: false. Kijk na met:\n  node scripts/wger.mjs --lijst`)
console.log(`Zet daarna bevestigd op true in ${REGISTER} voor wat klopt.`)
console.log('Onbevestigd beeld toont de app niet, dus een verkeerde koppeling komt nooit stil in beeld.')
