/**
 * De accounteindpunten over echte HTTP, tegen een echte database.
 *
 * Wat hier getest wordt en in e2e/accounts.mjs niet: cookies, de afscherming
 * tegen verzoeken van een andere website, en dat de app blijft werken als er
 * geen database is.
 *
 *   node e2e/account-http.mjs
 */

import { startServer, stopServer, wachtOpServer } from './serverproces.mjs'

const APP_PORT = 4391
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

let herstelToken = null

const start = (env) => {
  const proces = startServer({ PORT: String(APP_PORT), DATABASE_SSL: 'uit', MAIL_LOGBOEK: 'aan', ...env })
  // De herstelmail gaat bij MAIL_LOGBOEK naar het logboek. Daar plukken we de
  // link uit, zodat de test het token gebruikt dat de gebruiker ook zou krijgen
  // in plaats van er zelf een te verzinnen.
  proces.stdout.on('data', (d) => {
    const m = /wachtwoord-herstellen\?token=([^\s&"']+)/.exec(String(d))
    if (m) herstelToken = decodeURIComponent(m[1])
  })
  return proces
}
const wacht = () => wachtOpServer(`http://localhost:${APP_PORT}/api/account`)

let cookie = ''
async function roep(pad, opties = {}) {
  const headers = { 'Content-Type': 'application/json', 'X-Trainr-Client': '1', ...(opties.headers ?? {}) }
  if (cookie) headers.Cookie = cookie
  const res = await fetch(`http://localhost:${APP_PORT}${pad}`, {
    method: opties.method ?? 'GET',
    headers,
    body: opties.body ? JSON.stringify(opties.body) : undefined,
  })
  const set = res.headers.get('set-cookie')
  if (set) cookie = set.split(';')[0]
  const tekst = await res.text()
  let body = null
  try { body = tekst ? JSON.parse(tekst) : null } catch { body = tekst }
  return { status: res.status, body, setCookie: set }
}

// Schoon beginnen.
process.env.DATABASE_SSL = 'uit'
const { Client } = await import('pg')
const schoon = new Client({ connectionString: DB })
await schoon.connect()
/*
 * Het hele schema weg in plaats van een lijst tabellen. Zo'n lijst raakt
 * achter zodra er een migratie bij komt, en dan faalt de test op een tabel die
 * nog van de vorige keer staat. Dat is precies wat hier gebeurde toen de tabel
 * voor wachtwoordherstel erbij kwam.
 */
await schoon.query('drop schema public cascade; create schema public;')
await schoon.end()

let server = start({ DATABASE_URL: DB })
try {
  ok(await wacht(), 'de server komt op met een database')

  const begin = await roep('/api/account')
  ok(begin.body?.accountsMogelijk === true, 'de app hoort dat accounts kunnen')
  ok(begin.body?.gebruiker === null, 'er is nog niemand ingelogd')
  ok(typeof begin.body?.toestemmingVersie === 'string', 'de versie van de toestemmingstekst komt mee')

  /* ---- registreren ---- */
  const zonder = await roep('/api/account/registreren', {
    method: 'POST',
    body: { email: 'iemand@voorbeeld.nl', wachtwoord: 'paarse olifant danst', toestemming: false },
  })
  ok(zonder.status === 400 && zonder.body.error === 'geen-toestemming', 'zonder toestemming geen account')

  const zwak = await roep('/api/account/registreren', {
    method: 'POST',
    body: { email: 'iemand@voorbeeld.nl', wachtwoord: 'kort', toestemming: true },
  })
  ok(zwak.status === 400 && zwak.body.error === 'wachtwoord-zwak', 'een zwak wachtwoord wordt geweigerd')

  const raar = await roep('/api/account/registreren', {
    method: 'POST',
    body: { email: 'geen adres', wachtwoord: 'paarse olifant danst', toestemming: true },
  })
  ok(raar.status === 400 && raar.body.error === 'email-ongeldig', 'een ongeldig e-mailadres wordt geweigerd')

  const gemaakt = await roep('/api/account/registreren', {
    method: 'POST',
    body: { email: 'iemand@voorbeeld.nl', wachtwoord: 'paarse olifant danst', toestemming: true },
  })
  ok(gemaakt.status === 201, 'registreren lukt')
  ok(/HttpOnly/i.test(gemaakt.setCookie ?? ''), 'de sessiecookie is niet uit te lezen met javascript')
  ok(/SameSite=Lax/i.test(gemaakt.setCookie ?? ''), 'de cookie gaat niet mee bij verzoeken van andere sites')
  ok(!/wachtwoord/i.test(JSON.stringify(gemaakt.body)), 'het antwoord bevat geen wachtwoord')

  const naRegistratie = await roep('/api/account')
  ok(naRegistratie.body?.gebruiker?.email === 'iemand@voorbeeld.nl', 'je bent meteen ingelogd')

  /* ---- verzoeken van een andere website ---- */
  const zonderHeader = await fetch(`http://localhost:${APP_PORT}/api/account/uitloggen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
  })
  ok(zonderHeader.status === 403, 'een verzoek zonder eigen kopregel wordt geweigerd')
  const nogIngelogd = await roep('/api/account')
  ok(nogIngelogd.body?.gebruiker !== null, 'en je bent dus niet stiekem uitgelogd')

  /* ---- staat ---- */
  const leeg = await roep('/api/account/staat')
  ok(leeg.body?.versie === 0 && leeg.body?.data === null, 'een nieuw account heeft nog geen gegevens')

  const bewaard = await roep('/api/account/staat', { method: 'PUT', body: { data: { sessies: [1] }, versie: 0 } })
  ok(bewaard.status === 200 && bewaard.body.versie === 1, 'gegevens bewaren lukt')

  const conflict = await roep('/api/account/staat', { method: 'PUT', body: { data: { sessies: ['oud'] }, versie: 1 } })
  ok(conflict.status === 200, 'schrijven met de juiste versie lukt')
  const echtConflict = await roep('/api/account/staat', { method: 'PUT', body: { data: { sessies: ['ouder'] }, versie: 1 } })
  ok(echtConflict.status === 409 && echtConflict.body.error === 'conflict', 'schrijven met een oude versie geeft 409')
  ok(echtConflict.body.huidige?.versie === 2, 'en het antwoord zegt welke versie er staat')

  /* ---- uitloggen en weer in ---- */
  await roep('/api/account/uitloggen', { method: 'POST' })
  cookie = ''
  const uit = await roep('/api/account')
  ok(uit.body?.gebruiker === null, 'na uitloggen ben je eruit')
  const beschermd = await roep('/api/account/staat')
  ok(beschermd.status === 401, 'je gegevens zijn niet op te vragen zonder inloggen')

  const fout = await roep('/api/account/inloggen', { method: 'POST', body: { email: 'iemand@voorbeeld.nl', wachtwoord: 'verkeerd maar lang' } })
  ok(fout.status === 401, 'een verkeerd wachtwoord geeft 401')
  ok(!/bestaat|onbekend/i.test(fout.body.message), 'de melding verraadt niet of het account bestaat')

  const in2 = await roep('/api/account/inloggen', { method: 'POST', body: { email: 'iemand@voorbeeld.nl', wachtwoord: 'paarse olifant danst' } })
  ok(in2.status === 200, 'inloggen lukt')
  const terug = await roep('/api/account/staat')
  ok(terug.body?.data?.sessies?.[0] === 'oud', 'je gegevens staan er nog na opnieuw inloggen')

  /* ---- wachtwoord wijzigen ---- */
  const misWachtwoord = await roep('/api/account/wachtwoord', { method: 'POST', body: { huidig: 'fout maar lang', nieuw: 'nog een lang wachtwoord' } })
  ok(misWachtwoord.status === 401, 'wijzigen vraagt het huidige wachtwoord')
  const gewijzigd = await roep('/api/account/wachtwoord', { method: 'POST', body: { huidig: 'paarse olifant danst', nieuw: 'nog een lang wachtwoord' } })
  ok(gewijzigd.status === 200, 'wachtwoord wijzigen lukt')

  /* ---- verwijderen ---- */
  const zonderBevestiging = await roep('/api/account/verwijderen', { method: 'POST', body: {} })
  ok(zonderBevestiging.status === 400, 'verwijderen vraagt een bevestiging')
  const verwijderd = await roep('/api/account/verwijderen', { method: 'POST', body: { bevestiging: 'VERWIJDER' } })
  ok(verwijderd.status === 200, 'verwijderen lukt')
  cookie = ''
  const nietMeer = await roep('/api/account/inloggen', { method: 'POST', body: { email: 'iemand@voorbeeld.nl', wachtwoord: 'nog een lang wachtwoord' } })
  ok(nietMeer.status === 401, 'na verwijderen kun je niet meer inloggen')

  /* ---- Wachtwoord vergeten ---- */

  cookie = ''
  const HERSTEL_EMAIL = 'vergeten@voorbeeld.nl'
  await roep('/api/account/registreren', {
    method: 'POST',
    body: { email: HERSTEL_EMAIL, wachtwoord: 'eerste lange wachtwoord', toestemming: true },
  })
  cookie = ''

  const mogelijk = await roep('/api/account/herstel-mogelijk')
  ok(mogelijk.body?.mogelijk === true, 'de app hoort dat herstel aanstaat')

  const onbekend = await roep('/api/account/wachtwoord-vergeten', { method: 'POST', body: { email: 'niemand@voorbeeld.nl' } })
  ok(onbekend.status === 200, 'een onbekend adres levert hetzelfde antwoord op')
  ok(/Als er een account bij dit adres hoort/.test(onbekend.body?.message ?? ''), 'en de tekst verraadt niets')

  const gevraagd = await roep('/api/account/wachtwoord-vergeten', { method: 'POST', body: { email: HERSTEL_EMAIL } })
  ok(gevraagd.status === 200, 'een bestaand adres levert precies hetzelfde antwoord op')
  ok(gevraagd.body?.message === onbekend.body?.message, 'letterlijk dezelfde melding, dus niet te onderscheiden')

  // Het token staat alleen als hash in de database; de link stond in het logboek.
  const token = herstelToken
  ok(typeof token === 'string' && token.length > 20, 'er is een hersteltoken aangemaakt')

  const zwakHerstel = await roep('/api/account/wachtwoord-herstellen', { method: 'POST', body: { token, wachtwoord: 'kort' } })
  ok(zwakHerstel.status === 400 && zwakHerstel.body.error === 'wachtwoord-zwak', 'een zwak nieuw wachtwoord wordt geweigerd')

  const verzonnen = await roep('/api/account/wachtwoord-herstellen', { method: 'POST', body: { token: 'x'.repeat(40), wachtwoord: 'tweede lange wachtwoord' } })
  ok(verzonnen.status === 400, 'een verzonnen token werkt niet')

  const hersteld = await roep('/api/account/wachtwoord-herstellen', { method: 'POST', body: { token, wachtwoord: 'tweede lange wachtwoord' } })
  ok(hersteld.status === 200, 'herstellen lukt')

  const nogmaals = await roep('/api/account/wachtwoord-herstellen', { method: 'POST', body: { token, wachtwoord: 'derde lange wachtwoord' } })
  ok(nogmaals.status === 400 && nogmaals.body.error === 'token-gebruikt', 'dezelfde link werkt maar één keer')

  const oud = await roep('/api/account/inloggen', { method: 'POST', body: { email: HERSTEL_EMAIL, wachtwoord: 'eerste lange wachtwoord' } })
  ok(oud.status === 401, 'het oude wachtwoord werkt niet meer')
  const nieuw2 = await roep('/api/account/inloggen', { method: 'POST', body: { email: HERSTEL_EMAIL, wachtwoord: 'tweede lange wachtwoord' } })
  ok(nieuw2.status === 200, 'het nieuwe wachtwoord werkt')

  // Grens op het aanvragen.
  cookie = ''
  let laatste = null
  for (let i = 0; i < 4; i++) {
    laatste = await roep('/api/account/wachtwoord-vergeten', { method: 'POST', body: { email: HERSTEL_EMAIL } })
  }
  ok(laatste.status === 429, 'meer dan drie aanvragen achter elkaar wordt geweigerd')

  await stopServer(server)

  /* ---- zonder database ---- */
  server = start({ DATABASE_URL: '' })
  ok(await wacht(), 'de server komt ook op zonder database')
  const zonderDb = await roep('/api/account')
  ok(zonderDb.body?.accountsMogelijk === false, 'de app hoort dat accounts uitstaan')
  const poging = await roep('/api/account/registreren', { method: 'POST', body: { email: 'a@b.nl', wachtwoord: 'paarse olifant danst', toestemming: true } })
  ok(poging.status === 503, 'registreren meldt netjes dat het uitstaat')
  const pagina = await fetch(`http://localhost:${APP_PORT}/`)
  ok(pagina.status === 200, 'en de app zelf werkt gewoon door')
} finally {
  await stopServer(server)
}

process.stdout.write(fails.length === 0 ? '\nACCOUNT-EINDPUNTEN WERKEN\n' : `\n${fails.length} PROBLEMEN:\n${fails.join('\n')}\n`)
process.exit(fails.length === 0 ? 0 : 1)
