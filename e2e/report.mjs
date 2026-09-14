/**
 * Het geschreven weekrapport, met en zonder verzonnen getal.
 *
 * Het tweede geval is waarom deze test bestaat. Een rapport dat vlot leest en
 * een cijfer noemt dat nergens uit volgt, is zonder de bron ernaast niet van de
 * waarheid te onderscheiden. Dat mag niet in beeld komen.
 *
 *   node e2e/report.mjs
 */

import { spawn } from 'node:child_process'
import http from 'node:http'
import { chromium } from 'playwright'

const STUB_PORT = 4395
const APP_PORT = 4394
const fails = []
const ok = (cond, msg) => {
  process.stdout.write(`${cond ? 'PASS  ' : 'FAIL  '}${msg}\n`)
  if (!cond) fails.push(msg)
}

let rapport = 'Je traint stabiel. De techniek houdt stand en er is geen pijn boven je grens.\n\nHoud komende week dezelfde belasting aan en let op je uitvoering bij de laatste set.'
let laatsteVerzoek = null

const stub = http.createServer((req, res) => {
  let body = ''
  req.on('data', (c) => (body += c))
  req.on('end', () => {
    laatsteVerzoek = body ? JSON.parse(body) : null
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      id: 'x', object: 'chat.completion', created: 0, model: 'nep',
      choices: [{ index: 0, message: { role: 'assistant', content: rapport }, finish_reason: 'stop', logprobs: null }],
      usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
    }))
  })
})
await new Promise((r) => stub.listen(STUB_PORT, r))

const server = spawn('npx', ['tsx', 'server/index.ts'], {
  env: { ...process.env, PORT: String(APP_PORT), OPENAI_API_KEY: 'sk-test', OPENAI_BASE_URL: `http://localhost:${STUB_PORT}` },
  stdio: ['ignore', 'pipe', 'pipe'],
})
server.stderr.on('data', (d) => process.stderr.write(`[server] ${d}`))
for (let i = 0; i < 40; i++) {
  try { if ((await fetch(`http://localhost:${APP_PORT}/api/coach/status`)).ok) break } catch { /* nog niet op */ }
  await new Promise((r) => setTimeout(r, 250))
}

const BASE = `http://localhost:${APP_PORT}`
const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})

try {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' })
  const p = await ctx.newPage()
  p.setDefaultTimeout(12000)
  p.on('pageerror', (e) => ok(false, 'geen scriptfout: ' + e.message))

  await p.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await p.getByRole('button', { name: /demodata/i }).click()
  await p.waitForTimeout(1200)
  await p.getByRole('button', { name: 'Coach', exact: true }).first().click()
  await p.waitForTimeout(1200)

  const knop = p.getByRole('button', { name: 'Maak het rapport' })
  await knop.scrollIntoViewIfNeeded()
  ok(await knop.isVisible(), 'de knop voor het weekrapport staat er')
  await knop.click()
  await p.waitForTimeout(1500)

  const body = await p.textContent('body')
  ok(/Je traint stabiel/.test(body), 'het rapport komt in beeld')

  const instructie = laatsteVerzoek?.messages?.[0]?.content ?? ''
  ok(/uitsluitend getallen die letterlijk in de meegestuurde data staan/.test(instructie), 'de instructie verbiedt verzonnen getallen')
  ok(/DATA VAN DEZE WEEK/.test(laatsteVerzoek?.messages?.[1]?.content ?? ''), 'de weekdata gaat als aparte systeemboodschap mee')
  ok(!/geboortejaar|birthYear/i.test(JSON.stringify(laatsteVerzoek)), 'er gaat geen geboortejaar mee')
  await p.screenshot({ path: 'e2e/report.png' })

  // Nu een rapport met een getal dat nergens uit volgt.
  rapport = 'Je opkomst ging van 37 naar 91 procent en je squat staat op 762 kg.'
  await p.getByRole('button', { name: 'Opnieuw' }).click()
  await p.waitForTimeout(1500)
  const na = await p.textContent('body')
  ok(!/762/.test(na), 'een verzonnen getal komt niet in beeld')
  ok(/niet in je data staan/.test(na), 'de app zegt waarom het rapport is weggegooid')
  await p.screenshot({ path: 'e2e/report-geweigerd.png' })
} finally {
  await b.close()
  server.kill()
  stub.close()
}

process.stdout.write(fails.length === 0 ? '\nWEEKRAPPORT WERKT\n' : `\n${fails.length} PROBLEMEN:\n${fails.join('\n')}\n`)
process.exit(fails.length === 0 ? 0 : 1)
