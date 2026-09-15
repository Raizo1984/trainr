/**
 * De accountlaag tegen een echte Postgres.
 *
 * Niet tegen een namaakdatabase: juist de dingen die ertoe doen, zoals een
 * unieke sleutel die botst, een transactie die terugdraait en een
 * versieconflict tussen twee toestellen, gedragen zich in een namaak anders
 * dan in het echt.
 *
 *   DATABASE_URL=postgres://... node e2e/accounts.mjs
 */

import { pathToFileURL } from 'node:url'

const URL_DB = process.env.DATABASE_URL
if (!URL_DB) {
  console.error('Zet DATABASE_URL naar een lege testdatabase.')
  process.exit(1)
}
process.env.DATABASE_SSL = 'uit'

const fails = []
const ok = (cond, msg) => {
  process.stdout.write(`${cond ? 'PASS  ' : 'FAIL  '}${msg}\n`)
  if (!cond) fails.push(msg)
}

const laad = async (naam) => import(pathToFileURL(new URL(`../server/${naam}`, import.meta.url).pathname).href)

// tsx nodig om TypeScript te laden.
const { migreer, db, sluit } = await laad('db.ts')
const auth = await laad('auth.ts')
const acc = await laad('accounts.ts')

try {
  // Schoon beginnen.
  /*
   * Het hele schema weg in plaats van een lijst tabellen. Zo'n lijst raakt
   * achter zodra er een migratie bij komt, en dan faalt de test op een tabel
   * die nog van de vorige keer staat.
   */
  await db().query('drop schema public cascade; create schema public;')
  const gedraaid = await migreer()
  // Het aantal niet vastpinnen: dan moet deze regel bij elke migratie mee, en
  // dat is precies het soort onderhoud dat blijft liggen. Wat telt is dat ze
  // draaien en dat ze geen tweede keer draaien.
  ok(gedraaid.length > 0, `migraties draaien (${gedraaid.length})`)
  ok(gedraaid.includes('001-gebruikers'), 'de eerste migratie zit erbij')
  const nogmaals = await migreer()
  ok(nogmaals.length === 0, 'migraties draaien niet twee keer')

  /* ---- wachtwoorden ---- */
  const hash = await auth.hashWachtwoord('een lang genoeg wachtwoord')
  ok(hash.startsWith('scrypt$'), 'de hash zegt welk algoritme en welke instellingen')
  ok(!hash.includes('een lang genoeg'), 'het wachtwoord staat niet in de hash')
  ok(await auth.klopt('een lang genoeg wachtwoord', hash), 'het juiste wachtwoord klopt')
  ok(!(await auth.klopt('een lang genoeg wachtwoorD', hash)), 'een bijna goed wachtwoord klopt niet')
  ok(!(await auth.klopt('x', 'rommel')), 'een kapotte hash levert geen toegang op')
  const hash2 = await auth.hashWachtwoord('een lang genoeg wachtwoord')
  ok(hash !== hash2, 'twee keer hetzelfde wachtwoord geeft twee verschillende hashes')

  ok(auth.keurWachtwoord('kort') !== null, 'een kort wachtwoord wordt geweigerd')
  ok(auth.keurWachtwoord('wachtwoord12') !== null, 'een voor de hand liggend wachtwoord wordt geweigerd')
  ok(auth.keurWachtwoord('aaaaaaaaaaaa') !== null, 'een herhaald teken wordt geweigerd')
  ok(auth.keurWachtwoord('paarse olifant danst') === null, 'een lange zin wordt geaccepteerd')
  ok(auth.keurEmail('geen-adres') !== null, 'een ongeldig e-mailadres wordt geweigerd')
  ok(auth.keurEmail('a@b.nl') === null, 'een gewoon e-mailadres wordt geaccepteerd')

  /* ---- registreren ---- */
  let geweigerd = null
  try { await acc.registreer('a@b.nl', 'paarse olifant danst', false) } catch (e) { geweigerd = e }
  ok(geweigerd?.code === 'geen-toestemming', 'zonder toestemming geen account')

  const gebruiker = await acc.registreer('Test@Voorbeeld.NL', 'paarse olifant danst', true)
  ok(gebruiker.email === 'test@voorbeeld.nl', 'het e-mailadres wordt genormaliseerd')
  ok(gebruiker.toestemmingVersie === acc.TOESTEMMING_VERSIE, 'de toestemming wordt vastgelegd met versie')
  ok(gebruiker.toestemmingOp instanceof Date, 'en met datum')

  let dubbel = null
  try { await acc.registreer('test@voorbeeld.nl', 'ander lang wachtwoord', true) } catch (e) { dubbel = e }
  ok(dubbel?.code === 'bestaat-al', 'hetzelfde adres kan geen tweede account')
  let dubbelHoofdletters = null
  try { await acc.registreer('TEST@VOORBEELD.NL', 'ander lang wachtwoord', true) } catch (e) { dubbelHoofdletters = e }
  ok(dubbelHoofdletters?.code === 'bestaat-al', 'ook niet met andere hoofdletters')

  /* ---- inloggen ---- */
  let mis = null
  try { await acc.login('test@voorbeeld.nl', 'verkeerd wachtwoord') } catch (e) { mis = e }
  ok(mis?.code === 'onjuist', 'een verkeerd wachtwoord geeft geen sessie')
  let onbekend = null
  try { await acc.login('bestaat@niet.nl', 'wat dan ook maar lang') } catch (e) { onbekend = e }
  ok(onbekend?.code === 'onjuist', 'een onbekend adres geeft dezelfde melding als een fout wachtwoord')

  const inlog = await acc.login('test@voorbeeld.nl', 'paarse olifant danst')
  ok(typeof inlog.token === 'string' && inlog.token.length > 30, 'inloggen levert een token op')

  const { rows: sessieRijen } = await db().query('select token_hash from sessies')
  ok(!sessieRijen.some((r) => r.token_hash === inlog.token), 'het token zelf staat niet in de database')

  const bij = await acc.gebruikerBijToken(inlog.token)
  ok(bij?.id === inlog.gebruiker.id, 'het token wijst de gebruiker aan')
  ok((await acc.gebruikerBijToken('onzin')) === null, 'een onzintoken wijst niemand aan')

  /* ---- snelheidsbegrenzing ---- */
  for (let i = 0; i < 10; i++) {
    try { await acc.login('test@voorbeeld.nl', 'steeds fout hoor') } catch { /* verwacht */ }
  }
  let begrensd = null
  try { await acc.login('test@voorbeeld.nl', 'paarse olifant danst') } catch (e) { begrensd = e }
  ok(begrensd?.code === 'te-veel-pogingen', 'na tien mislukte pogingen gaat de deur dicht')
  ok(begrensd?.status === 429, 'en dat is een 429')

  await db().query('delete from inlogpogingen')
  const naReset = await acc.login('test@voorbeeld.nl', 'paarse olifant danst')
  ok(typeof naReset.token === 'string', 'na het venster kan het weer')

  /* ---- staat ---- */
  ok((await acc.haalStaat(gebruiker.id)) === null, 'een nieuw account heeft nog geen staat')
  const eerste = await acc.bewaarStaat(gebruiker.id, { sessies: [1] }, null)
  ok(eerste.ok && eerste.versie === 1, 'de eerste opslag krijgt versie 1')
  const tweede = await acc.bewaarStaat(gebruiker.id, { sessies: [1, 2] }, 1)
  ok(tweede.ok && tweede.versie === 2, 'de tweede opslag krijgt versie 2')

  const conflict = await acc.bewaarStaat(gebruiker.id, { sessies: ['oud'] }, 1)
  ok(conflict.ok === false, 'schrijven met een oude versie geeft een conflict')
  ok(conflict.huidige.versie === 2, 'en meldt welke versie er staat')
  const naConflict = await acc.haalStaat(gebruiker.id)
  ok(JSON.stringify(naConflict.data) === JSON.stringify({ sessies: [1, 2] }), 'het werk van het andere toestel blijft staan')

  /* ---- wachtwoord wijzigen en uitloggen ---- */
  let foutHuidig = null
  try { await acc.wijzigWachtwoord(gebruiker.id, 'klopt niet hoor', 'nieuw lang wachtwoord') } catch (e) { foutHuidig = e }
  ok(foutHuidig?.code === 'onjuist', 'wachtwoord wijzigen vraagt het huidige wachtwoord')

  await acc.wijzigWachtwoord(gebruiker.id, 'paarse olifant danst', 'nieuw lang wachtwoord hier')
  const metNieuw = await acc.login('test@voorbeeld.nl', 'nieuw lang wachtwoord hier')
  ok(typeof metNieuw.token === 'string', 'inloggen met het nieuwe wachtwoord lukt')

  const weg = await acc.logOveralUit(gebruiker.id, metNieuw.token)
  ok(weg >= 1, `overal uitloggen ruimt de andere sessies op (${weg})`)
  ok((await acc.gebruikerBijToken(inlog.token)) === null, 'de oude sessie werkt niet meer')
  ok((await acc.gebruikerBijToken(metNieuw.token)) !== null, 'de huidige sessie blijft werken')

  await acc.logUit(metNieuw.token)
  ok((await acc.gebruikerBijToken(metNieuw.token)) === null, 'uitloggen maakt het token ongeldig')

  /* ---- verwijderen ---- */
  const inlog2 = await acc.login('test@voorbeeld.nl', 'nieuw lang wachtwoord hier')
  await acc.bewaarStaat(gebruiker.id, { iets: 'gevoeligs' }, null)
  await acc.verwijderAccount(gebruiker.id)

  const { rows: over } = await db().query('select count(*)::int as n from gebruikers where id = $1', [gebruiker.id])
  ok(over[0].n === 0, 'het account is echt weg, niet gemarkeerd')
  const { rows: staatOver } = await db().query('select count(*)::int as n from staat where gebruiker_id = $1', [gebruiker.id])
  ok(staatOver[0].n === 0, 'de gezondheidsgegevens gaan mee')
  const { rows: sessiesOver } = await db().query('select count(*)::int as n from sessies where gebruiker_id = $1', [gebruiker.id])
  ok(sessiesOver[0].n === 0, 'de sessies gaan mee')
  ok((await acc.gebruikerBijToken(inlog2.token)) === null, 'een openstaande sessie werkt daarna niet meer')

  const opnieuw = await acc.registreer('test@voorbeeld.nl', 'weer een lang wachtwoord', true)
  ok(opnieuw.id !== gebruiker.id, 'hetzelfde adres kan daarna opnieuw registreren')
} finally {
  await sluit()
}

process.stdout.write(fails.length === 0 ? '\nACCOUNTS WERKEN\n' : `\n${fails.length} PROBLEMEN:\n${fails.join('\n')}\n`)
process.exit(fails.length === 0 ? 0 : 1)
