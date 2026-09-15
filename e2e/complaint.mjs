/**
 * Van klacht in eigen woorden tot een voorstel dat je kunt accepteren.
 *
 * Draait tegen een nepversie van OpenAI, zodat de test geen sleutel en geen
 * tegoed kost. Wat er daarna gebeurt is wel het echte werk: de app rekent zelf
 * uit wat de klacht betekent, haalt het door de veiligheidspoort en zet het
 * voorstel in de lijst.
 *
 *   node e2e/complaint.mjs
 */

import { startServer, stopServer, wachtOpServer } from './serverproces.mjs'
import http from 'node:http'
import { chromium } from 'playwright'

const STUB_PORT = 4397
const APP_PORT = 4396
const fails = []
const ok = (cond, msg) => {
  process.stdout.write(`${cond ? 'PASS  ' : 'FAIL  '}${msg}\n`)
  if (!cond) fails.push(msg)
}

let duiding = {
  region: 'knie-rechts',
  ladderIds: ['squat'],
  painLevel: 7,
  summary: 'Stekende pijn rechterknie vanaf de zesde rep.',
}

const stub = http.createServer((req, res) => {
  let body = ''
  req.on('data', (c) => (body += c))
  req.on('end', () => {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({
        id: 'x', object: 'chat.completion', created: 0, model: 'nep',
        choices: [{
          index: 0,
          message: {
            role: 'assistant', content: null,
            tool_calls: [{ id: 'c', type: 'function', function: { name: 'duid_klacht', arguments: JSON.stringify(duiding) } }],
          },
          finish_reason: 'stop', logprobs: null,
        }],
        usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
      }),
    )
  })
})
await new Promise((r) => stub.listen(STUB_PORT, r))

const server = startServer({
    PORT: String(APP_PORT),
    OPENAI_API_KEY: 'sk-test-nepsleutel',
    OPENAI_BASE_URL: `http://localhost:${STUB_PORT}`,
})
await wachtOpServer(`http://localhost:${APP_PORT}/api/coach/status`)

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
  await p.getByRole('button', { name: 'Trainen', exact: true }).first().click()
  await p.waitForTimeout(800)
  await p.getByRole('button', { name: /^Beginnen met/ }).click()
  await p.waitForTimeout(800)

  const veld = p.getByPlaceholder(/rechterknie voelt raar/i)
  await veld.scrollIntoViewIfNeeded()
  ok(await veld.isVisible(), 'het veld om een klacht te melden staat er')

  // Eerst mild: dat hoort niets aan het programma te veranderen. Dit moet in
  // dezelfde sessie, want het tabblad verlaten beeindigt de sessie.
  duiding = { region: 'knie-rechts', ladderIds: ['squat'], painLevel: 1, summary: 'Lichte stijfheid.' }
  await veld.fill('knie voelt een beetje stijf, pijn 1')
  await p.getByRole('button', { name: 'Melden' }).click()
  await p.waitForTimeout(1500)
  const mild = await p.textContent('body')
  ok(/blijft onder je grens/.test(mild), 'milde pijn verandert niets aan het programma')
  ok(!/voorstel(len)? klaar bij Coach/.test(mild), 'en levert geen voorstel op')

  // Dan ernstig.
  duiding = {
    region: 'knie-rechts',
    ladderIds: ['squat'],
    painLevel: 7,
    summary: 'Stekende pijn rechterknie vanaf de zesde rep.',
  }
  await veld.fill('mijn rechterknie voelt raar vanaf rep 6 bij squats, pijn een 7')
  await p.getByRole('button', { name: 'Melden' }).click()
  await p.waitForTimeout(1500)

  const body = await p.textContent('body')
  ok(/boven de grens waarop je doortraint/.test(body), 'de app legt uit wat pijn 7 betekent')
  ok(/Stekende pijn rechterknie/.test(body), 'de eigen woorden staan in de onderbouwing')
  ok(/pauzeren|Pauzeren/.test(body), 'het voorstel is de oefening pauzeren')
  await p.screenshot({ path: 'e2e/complaint.png' })

  // Accepteren zet het om in een geldende aanpassing, zichtbaar en intrekbaar.
  await p.getByRole('button', { name: /Toepassen|Accepteren/ }).first().click()
  await p.waitForTimeout(900)
  await p.getByRole('button', { name: 'Plan', exact: true }).first().click()
  await p.waitForTimeout(1200)
  const plan = await p.textContent('body')
  ok(/Stekende pijn rechterknie/.test(plan), 'de geaccepteerde aanpassing staat bij Plan')
  await p.screenshot({ path: 'e2e/complaint-voorstel.png' })
} finally {
  await b.close()
  await stopServer(server)
  stub.close()
}

process.stdout.write(fails.length === 0 ? '\nKLACHT MELDEN WERKT\n' : `\n${fails.length} PROBLEMEN:\n${fails.join('\n')}\n`)
process.exit(fails.length === 0 ? 0 : 1)
