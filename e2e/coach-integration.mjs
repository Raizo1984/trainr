/**
 * Integratiecontrole van de coach zonder echte API-sleutel.
 *
 * Start een nepserver die zich voordoet als OpenAI, wijst de backend daarheen
 * met OPENAI_BASE_URL, en controleert wat er werkelijk over de lijn gaat.
 * Typecontrole ziet niet of een veldnaam klopt met wat de API verwacht; dit
 * wel.
 *
 *   node e2e/coach-integration.mjs
 */

import { spawn } from 'node:child_process'
import http from 'node:http'

const STUB_PORT = 4399
const APP_PORT = 4398
const fails = []
const ok = (cond, msg) => {
  process.stdout.write(`${cond ? 'PASS  ' : 'FAIL  '}${msg}\n`)
  if (!cond) fails.push(msg)
}

let lastRequest = null
let reply = {
  id: 'chatcmpl_stub',
  object: 'chat.completion',
  created: 0,
  model: 'gpt-4o',
  choices: [
    {
      index: 0,
      message: {
        role: 'assistant',
        content: 'Je squat staat zes sessies stil bij dezelfde belasting.',
        tool_calls: [
          {
            id: 'call_1',
            type: 'function',
            function: {
              name: 'stel_aanpassing_voor',
              arguments: JSON.stringify({
                kind: 'sets-omhoog',
                ladderId: 'squat',
                amount: 1,
                reason: 'Zes sessies op 50 kg zonder extra reps.',
                expiresAfterWeeks: 6,
              }),
            },
          },
        ],
      },
      finish_reason: 'stop',
      logprobs: null,
    },
  ],
  usage: { prompt_tokens: 1200, completion_tokens: 80, total_tokens: 1280 },
}

const stub = http.createServer((req, res) => {
  let body = ''
  req.on('data', (chunk) => (body += chunk))
  req.on('end', () => {
    lastRequest = { url: req.url, headers: req.headers, body: body ? JSON.parse(body) : null }
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(reply))
  })
})
await new Promise((resolve) => stub.listen(STUB_PORT, resolve))

const server = spawn('npx', ['tsx', 'server/index.ts'], {
  env: {
    ...process.env,
    PORT: String(APP_PORT),
    OPENAI_API_KEY: 'sk-test-nepsleutel',
    OPENAI_BASE_URL: `http://localhost:${STUB_PORT}`,
    OPENAI_MODEL: 'gpt-4o-test',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})
server.stderr.on('data', (d) => process.stderr.write(`[server] ${d}`))

// Wachten tot de server luistert.
for (let i = 0; i < 40; i++) {
  try {
    const probe = await fetch(`http://localhost:${APP_PORT}/api/coach/status`)
    if (probe.ok) break
  } catch {
    // nog niet op
  }
  await new Promise((r) => setTimeout(r, 250))
}

async function ask(messages, context = { fase: 'Fase 2', grenzen: ['Pijn van 5 of hoger: nooit meer belasting.'] }) {
  const response = await fetch(`http://localhost:${APP_PORT}/api/coach`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, context }),
  })
  return { status: response.status, body: await response.json() }
}

try {
  const status = await (await fetch(`http://localhost:${APP_PORT}/api/coach/status`)).json()
  ok(status.available === true, 'status meldt de coach als beschikbaar met een sleutel')
  ok(status.model === 'gpt-4o-test', 'status meldt het model uit de omgeving')

  const result = await ask([{ role: 'user', content: 'Waarom staat mijn squat stil?' }])
  ok(result.status === 200, 'een normale vraag levert 200 op')

  // Wat ging er werkelijk naar de API?
  const sent = lastRequest?.body
  ok(lastRequest?.url === '/chat/completions', 'roept het juiste eindpunt aan')
  ok(lastRequest?.headers.authorization === 'Bearer sk-test-nepsleutel', 'stuurt de sleutel mee als Bearer-token')
  ok(sent?.model === 'gpt-4o-test', 'gebruikt het ingestelde model')
  ok(typeof sent?.max_completion_tokens === 'number', 'stuurt een tokenlimiet mee die de API kent')
  ok(sent?.tool_choice === 'auto', 'laat het model zelf kiezen of het gereedschap gebruikt')
  ok(sent?.tools?.[0]?.function?.name === 'stel_aanpassing_voor', 'biedt precies één gereedschap aan')
  ok(sent?.messages?.[0]?.role === 'system', 'zet de instructie vooraan')
  ok(/Pijn gaat altijd voor/.test(sent?.messages?.[0]?.content ?? ''), 'de harde grenzen staan in de instructie')
  ok(/DATA VAN DEZE GEBRUIKER/.test(sent?.messages?.[1]?.content ?? ''), 'stuurt de samenvatting als aparte systeemboodschap')
  ok(sent?.messages?.at(-1)?.content === 'Waarom staat mijn squat stil?', 'de vraag van de gebruiker sluit de rij')

  // En wat kwam er terug bij de client?
  ok(/zes sessies stil/i.test(result.body.text), 'geeft de tekst van het model door')
  ok(result.body.proposals?.length === 1, 'geeft precies één voorstel door')
  ok(result.body.proposals?.[0]?.kind === 'sets-omhoog', 'het voorstel houdt zijn soort')
  ok(result.body.incomplete === false, 'meldt het antwoord als afgerond')

  // Een verzonnen soort aanpassing mag de client niet bereiken.
  reply = structuredClone(reply)
  reply.choices[0].message.tool_calls[0].function.arguments = JSON.stringify({
    kind: 'deload-overslaan',
    reason: 'Ik sla de deload over.',
  })
  const bogus = await ask([{ role: 'user', content: 'Mag ik de deload overslaan?' }])
  ok(bogus.body.proposals?.length === 0, 'een verzonnen soort aanpassing bereikt de client niet')

  // Onleesbare JSON van het model.
  reply = structuredClone(reply)
  reply.choices[0].message.tool_calls[0].function.arguments = '{kapot'
  const broken = await ask([{ role: 'user', content: 'test' }])
  ok(broken.status === 200 && broken.body.proposals?.length === 0, 'onleesbare JSON laat de server niet omvallen')

  // Grenzen op de invoer.
  const empty = await ask([])
  ok(empty.status === 400, 'een leeg gesprek wordt geweigerd')
  const long = await ask(Array.from({ length: 41 }, () => ({ role: 'user', content: 'x' })))
  ok(long.status === 400, 'een te lang gesprek wordt geweigerd')
} finally {
  server.kill()
  stub.close()
}

process.stdout.write(fails.length === 0 ? '\nALLE CONTROLES GESLAAGD\n' : `\n${fails.length} PROBLEMEN:\n${fails.join('\n')}\n`)
process.exit(fails.length === 0 ? 0 : 1)
