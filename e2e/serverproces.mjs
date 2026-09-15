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

export function startServer(env = {}, { toonFouten = true } = {}) {
  const proces = spawn('npx', ['tsx', 'server/index.ts'], {
    env: { ...process.env, ...env },
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
