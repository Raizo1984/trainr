/**
 * Start de frontend en de backend samen.
 *
 * Zonder de backend draait de app wel, maar geeft /api/coach niets terug en
 * lijkt de coach kapot in plaats van uitgeschakeld. Eén commando dus, en bij
 * afsluiten gaan ze allebei netjes dicht.
 *
 * Geen extra afhankelijkheid: dit is bewust een klein scriptje in plaats van
 * een pakket erbij.
 */

import { spawn } from 'node:child_process'

const processes = []

function start(name, script, extraEnv = {}) {
  const child = spawn('npm', ['run', script], {
    stdio: ['ignore', 'inherit', 'inherit'],
    env: { ...process.env, ...extraEnv },
  })
  child.on('exit', (code, signal) => {
    if (signal) return
    console.error(`\n[${name}] gestopt met code ${code}. Beide processen worden afgesloten.`)
    shutdown(code ?? 1)
  })
  processes.push(child)
  return child
}

let shuttingDown = false
function shutdown(code = 0) {
  if (shuttingDown) return
  shuttingDown = true
  for (const child of processes) child.kill('SIGTERM')
  setTimeout(() => process.exit(code), 250)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

// De backend luistert op 3001; de Vite-proxy in vite.config.ts wijst daarheen.
start('backend', 'dev:server', { PORT: '3001' })
start('frontend', 'dev')
