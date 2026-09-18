/**
 * Een backend starten en daarna ook echt weer stoppen.
 *
 * `spawn('npx', ['tsx', ...])` start npx, en npx start node. `kill()` op dat
 * proces doodt alleen npx: de server blijft draaien en houdt de poort vast.
 * Het gevolg is een volgende test die praat met de server van de vorige, wat
 * eruitziet als een onverklaarbare fout in de code.
 *
 * Daarom een eigen procesgroep, en bij het stoppen de hele groep.
 */

import { spawn } from 'node:child_process'

/**
 * De grens op wat het model mag kosten staat in een test standaard ruim.
 *
 * Een test doet in tien seconden wat een mens op een drukke dag doet, en loopt
 * dus tegen een grens aan die voor mensen gemaakt is. Dat zou elke andere test
 * laten falen op iets wat er niet aan de hand is. De grens zelf wordt
 * onderzocht in e2e/verbruik.mjs, en die zet deze waarden juist laag.
 */
const RUIME_GRENZEN = {
  AI_INGELOGD_PER_MINUUT: '10000',
  AI_INGELOGD_PER_DAG: '10000',
  AI_INGELOGD_TOKENS: '100000000',
  AI_ANONIEM_PER_MINUUT: '10000',
  AI_ANONIEM_PER_DAG: '10000',
  AI_ANONIEM_TOKENS: '100000000',
  AI_TOKENS_PER_DAG: '0',
}

export function startServer(env = {}, { toonFouten = true } = {}) {
  const proces = spawn('npx', ['tsx', 'server/index.ts'], {
    env: { ...process.env, ...RUIME_GRENZEN, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  })
  if (toonFouten) {
    proces.stderr.on('data', (d) => {
      const tekst = String(d)
      if (!/ExperimentalWarning|trace-warnings/.test(tekst)) process.stderr.write(`[server] ${tekst}`)
    })
  }
  return proces
}

export async function stopServer(proces) {
  if (!proces || proces.killed || proces.pid === undefined) return
  try {
    // Het minteken maakt er de hele procesgroep van, dus ook het kind van npx.
    process.kill(-proces.pid, 'SIGTERM')
  } catch {
    try { proces.kill('SIGTERM') } catch { /* al weg */ }
  }
  // Even wachten tot de poort vrij is, anders botst de volgende test erop.
  await new Promise((r) => setTimeout(r, 600))
}

export async function wachtOpServer(url, pogingen = 60) {
  for (let i = 0; i < pogingen; i++) {
    try {
      const res = await fetch(url)
      if (res.ok) return true
    } catch { /* nog niet op */ }
    await new Promise((r) => setTimeout(r, 250))
  }
  return false
}

/**
 * Het startscherm overslaan in een test.
 *
 * Nieuwe gebruikers krijgen eerst de keuze tussen een account en verder zonder
 * account. Voor tests die iets anders onderzoeken is dat alleen ruis, dus die
 * zetten de keuze vooraf klaar. Tests die het startscherm zelf onderzoeken,
 * zoals e2e/welkom.mjs, doen dit juist niet.
 */
export async function slaWelkomOver(ctx) {
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem(
        'trainr-onboarding-v1',
        JSON.stringify({ zonderAccount: true, naIntakeGevraagd: true }),
      )
    } catch {
      // Geen opslag: dan verschijnt het startscherm alsnog en faalt de test,
      // wat beter is dan stilletjes iets anders testen.
    }
  })
}
