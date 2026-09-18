/**
 * De grens op wat het model mag kosten, tegen een echte server.
 *
 * De eenheidstest kijkt naar de teller in het geheugen. Deze test kijkt naar
 * wat er werkelijk over de lijn gaat: komt er een 429 terug, staat er een
 * bruikbare melding in, telt een ingelogde gebruiker apart van een anonieme
 * bezoeker, en wordt een mislukt verzoek ook meegeteld.
 *
 * Met een database erbij, want daar hoort de teller te staan: een publicatie
 * die meeschaalt draait meerdere kopieën, en een teller in het geheugen
 * betekent dan tien keer zoveel ruimte per kopie.
 *
 *   DATABASE_URL=postgres://... node e2e/verbruik.mjs
 */

import http from 'node:http'
import { startServer, stopServer, wachtOpServer } from './serverproces.mjs'

const STUB_PORT = 4411
const APP_PORT = 4410
const BASE = `http://localhost:${APP_PORT}`
const DB = process.env.DATABASE_URL
if (!DB) {
  console.error('Zet DATABASE_URL naar een testdatabase.')
  process.exit(1)
}

const fails = []
const ok = (cond, msg) => {
  process.stdout.write(`${cond ? 'PASS  ' : 'FAIL  '}${msg}\n`)
  if (!cond) fails.push(msg)
}

const { Client } = await import('pg')
const schoon = new Client({ connectionString: DB })
await schoon.connect()
await schoon.query('drop schema public cascade; create schema public;')
await schoon.end()

/* ---- Een nep-OpenAI die altijd hetzelfde antwoord geeft ---------- */

let stubFaalt = false
const antwoord = {
  id: 'chatcmpl_stub',
  object: 'chat.completion',
  created: 0,
  model: 'gpt-4o',
  choices: [{ index: 0, message: { role: 'assistant', content: 'Prima.' }, finish_reason: 'stop', logprobs: null }],
  usage: { prompt_tokens: 1000, completion_tokens: 200, total_tokens: 1200 },
}

const stub = http.createServer((req, res) => {
  req.resume()
  req.on('end', () => {
    if (stubFaalt) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: { message: 'stuk' } }))
      return
    }
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(antwoord))
  })
})
await new Promise((r) => stub.listen(STUB_PORT, r))

/* ---- De server, met een grens die je in een test kunt raken ------ */

const server = startServer({
  PORT: String(APP_PORT),
  DATABASE_URL: DB,
  DATABASE_SSL: 'uit',
  OPENAI_API_KEY: 'sk-test-nepsleutel',
  OPENAI_BASE_URL: `http://localhost:${STUB_PORT}`,
  OPENAI_MODEL: 'gpt-4o-test',
  // Klein genoeg om te raken, groot genoeg om er eerst doorheen te komen.
  AI_ANONIEM_PER_MINUUT: '3',
  AI_ANONIEM_PER_DAG: '100',
  AI_ANONIEM_TOKENS: '100000',
  AI_INGELOGD_PER_MINUUT: '5',
  AI_INGELOGD_PER_DAG: '100',
  AI_INGELOGD_TOKENS: '100000',
  AI_TOKENS_PER_DAG: '0',
})
await wachtOpServer(`${BASE}/api/coach/status`)

async function vraag(cookie = null) {
  const headers = { 'Content-Type': 'application/json', 'X-Trainr-Client': '1' }
  if (cookie) headers.cookie = cookie
  const res = await fetch(`${BASE}/api/coach`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ messages: [{ role: 'user', content: 'Hoe gaat het?' }], context: {} }),
  })
  return { status: res.status, retry: res.headers.get('retry-after'), body: await res.json() }
}

try {
  /* ---- Anoniem: drie mogen, de vierde niet ---------------------- */
  for (let i = 1; i <= 3; i++) {
    const r = await vraag()
    ok(r.status === 200, `anonieme vraag ${i} van 3 mag erdoor`)
  }
  const vierde = await vraag()
  ok(vierde.status === 429, 'de vierde vraag binnen een minuut wordt geweigerd')
  ok(vierde.body.error === 'te-veel', 'met een code die de app kan lezen')
  ok(/minuut/i.test(vierde.body.message ?? ''), `met een melding die zegt wat er aan de hand is: "${vierde.body.message}"`)
  ok(/account/i.test(vierde.body.message ?? ''), 'en die een anonieme bezoeker op een account wijst')
  ok(Number(vierde.retry) > 0, 'met een Retry-After erbij')

  /* ---- Ingelogd telt apart ------------------------------------- */
  const email = `grens${Date.now()}@voorbeeld.nl`
  const registratie = await fetch(`${BASE}/api/account/registreren`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Trainr-Client': '1' },
    body: JSON.stringify({ email, wachtwoord: 'eenlangwachtwoord2026', toestemming: true }),
  })
  ok(registratie.ok, 'een account aanmaken lukt')
  const cookie = (registratie.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(';')[0])
    .join('; ')
  ok(cookie.length > 0, 'en levert een sessiecookie op')

  const ingelogd = await vraag(cookie)
  ok(
    ingelogd.status === 200,
    `een ingelogde gebruiker komt er nog door terwijl het adres op slot zit (${ingelogd.status})`,
  )

  /* ---- Een mislukt verzoek telt ook mee ------------------------- */
  stubFaalt = true
  const stuk = await vraag(cookie)
  ok(stuk.status === 502, 'een fout van de provider komt door als 502')
  stubFaalt = false
  for (let i = 0; i < 3; i++) await vraag(cookie)
  const naFouten = await vraag(cookie)
  ok(
    naFouten.status === 429,
    `het mislukte verzoek telde mee voor de grens (${naFouten.status} na 5 verzoeken waarvan één fout)`,
  )

  /* ---- Wat er in de database staat ------------------------------ */
  const client = new Client({ connectionString: DB })
  await client.connect()
  const { rows } = await client.query(
    `select sleutel, count(*)::int as aantal, sum(tokens)::int as tokens
     from ai_verbruik group by sleutel order by sleutel`,
  )
  await client.end()

  const adres = rows.find((r) => r.sleutel.startsWith('adres:'))
  const gebruiker = rows.find((r) => r.sleutel.startsWith('gebruiker:'))
  ok(rows.length === 2, `het verbruik staat per bezoeker apart in de database (${rows.length} sleutels)`)
  ok(adres?.aantal === 3, `het anonieme adres staat op drie verzoeken (${adres?.aantal})`)
  ok(adres?.tokens === 3600, `met de werkelijk verbruikte tokens erbij (${adres?.tokens})`)
  ok(gebruiker?.aantal === 5, `de ingelogde gebruiker staat op vijf verzoeken (${gebruiker?.aantal})`)
  ok(
    gebruiker?.tokens === 4 * 1200,
    `het mislukte verzoek kostte geen tokens en staat ook zo genoteerd (${gebruiker?.tokens})`,
  )
} catch (e) {
  ok(false, 'geen uitzondering: ' + e.message)
} finally {
  await stopServer(server)
  stub.close()
}

if (fails.length) {
  console.error(`\n${fails.length} FOUT\n` + fails.map((f) => ' - ' + f).join('\n'))
  process.exit(1)
}
console.log('\nDE GRENS OP HET MODEL WERKT')
