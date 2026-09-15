/**
 * Wachtwoorden, sessies en de regels eromheen.
 *
 * Geen extra bibliotheek: `node:crypto` heeft scrypt aan boord, en dat is een
 * wachtwoordhash die bewust traag en geheugenintensief is. Een pakket als
 * bcrypt of argon2 zou hier niets toevoegen behalve een compileerstap die op
 * de ene hoster wel werkt en op de andere niet.
 *
 * Sessies zijn willekeurige tokens, geen JWT. Een token in de database kun je
 * intrekken; een ondertekend broodje dat zichzelf geldig verklaart niet. Bij
 * gezondheidsgegevens wil je kunnen zeggen: deze sessie is vanaf nu ongeldig.
 */

import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import type { ScryptOptions } from 'node:crypto'
import { promisify } from 'node:util'

/*
 * promisify verliest de overload met opties, dus die zetten we er hier weer op.
 * Zonder dit type zou een verkeerde parameter pas bij het draaien opvallen.
 */
const scrypt = promisify(scryptCb) as (
  wachtwoord: string,
  salt: Buffer,
  lengte: number,
  opties: ScryptOptions,
) => Promise<Buffer>

/*
 * Parameters van de hash. N=2^15 kost ongeveer 100 ms per poging op gewone
 * hardware: genoeg om raden onaantrekkelijk te maken, weinig genoeg om
 * inloggen niet te vertragen. Ze staan in de hash zelf, zodat ze later
 * verhoogd kunnen worden zonder bestaande wachtwoorden ongeldig te maken.
 */
const N = 32768
const r = 8
const p = 1
const SLEUTELLENGTE = 64

export async function hashWachtwoord(wachtwoord: string): Promise<string> {
  const salt = randomBytes(16)
  const sleutel = await scrypt(wachtwoord.normalize('NFKC'), salt, SLEUTELLENGTE, {
    N,
    r,
    p,
    maxmem: 256 * 1024 * 1024,
  })
  return `scrypt$${N}$${r}$${p}$${salt.toString('base64')}$${sleutel.toString('base64')}`
}

export async function klopt(wachtwoord: string, opgeslagen: string): Promise<boolean> {
  const delen = opgeslagen.split('$')
  if (delen.length !== 6 || delen[0] !== 'scrypt') return false
  const [, nTekst, rTekst, pTekst, saltB64, sleutelB64] = delen
  const salt = Buffer.from(saltB64, 'base64')
  const verwacht = Buffer.from(sleutelB64, 'base64')
  if (salt.length === 0 || verwacht.length === 0) return false

  let berekend: Buffer
  try {
    berekend = await scrypt(wachtwoord.normalize('NFKC'), salt, verwacht.length, {
      N: Number(nTekst),
      r: Number(rTekst),
      p: Number(pTekst),
      maxmem: 256 * 1024 * 1024,
    })
  } catch {
    return false
  }
  // Vergelijken in vaste tijd: anders verraadt de duur hoeveel er klopte.
  return berekend.length === verwacht.length && timingSafeEqual(berekend, verwacht)
}

/* ------------------------------------------------------------------ */
/* Sessies                                                             */
/* ------------------------------------------------------------------ */

export const SESSIE_COOKIE = 'trainr_sessie'
export const SESSIE_DAGEN = 30

export function nieuwToken(): string {
  return randomBytes(32).toString('base64url')
}

/** Alleen de hash gaat de database in; het token zelf staat nergens opgeslagen. */
export function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function cookieOpties(veilig: boolean) {
  return {
    httpOnly: true,
    // Zonder secure stuurt de browser hem ook over http. Bij het ontwikkelen op
    // localhost kan dat niet, dus daar staat hij uit.
    secure: veilig,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSIE_DAGEN * 24 * 60 * 60 * 1000,
  }
}

/* ------------------------------------------------------------------ */
/* Invoer nakijken                                                     */
/* ------------------------------------------------------------------ */

/**
 * De tien wachtwoorden die in elke lek-lijst bovenaan staan, plus wat er in
 * deze app voor de hand ligt. Geen volledige lijst, wel de gevallen die anders
 * daadwerkelijk gekozen worden.
 */
const TE_VOOR_DE_HAND = new Set([
  'wachtwoord', 'wachtwoord1', 'password', 'password1', '123456789012',
  'welkom123456', 'qwertyuiop12', 'trainr123456', 'geheimgeheim',
  'wachtwoord12', 'administrator',
])

export const WACHTWOORD_MINIMUM = 12

export function keurWachtwoord(wachtwoord: string): string | null {
  if (typeof wachtwoord !== 'string') return 'Geen wachtwoord ontvangen.'
  const schoon = wachtwoord.normalize('NFKC')
  if (schoon.length < WACHTWOORD_MINIMUM) {
    return `Je wachtwoord moet minstens ${WACHTWOORD_MINIMUM} tekens hebben. Lengte helpt meer dan hoofdletters en leestekens.`
  }
  if (schoon.length > 200) return 'Dit wachtwoord is te lang.'
  if (TE_VOOR_DE_HAND.has(schoon.toLowerCase())) {
    return 'Dit wachtwoord staat in elke lijst met gelekte wachtwoorden. Kies iets anders.'
  }
  if (/^(.)\1+$/.test(schoon)) return 'Eén teken herhalen is geen wachtwoord.'
  return null
}

/**
 * E-mail nakijken.
 *
 * Bewust ruim: een strak patroon weigert vroeg of laat een geldig adres, en
 * dat is vervelender dan een ongeldig adres doorlaten. Wat telt is dat er één
 * apenstaartje in zit met iets ervoor en een punt erachter.
 */
export function keurEmail(email: unknown): string | null {
  if (typeof email !== 'string') return 'Geen e-mailadres ontvangen.'
  const schoon = email.trim()
  if (schoon.length < 5 || schoon.length > 254) return 'Dit e-mailadres klopt niet.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(schoon)) return 'Dit e-mailadres klopt niet.'
  return null
}

/** Adressen zijn hoofdletterongevoelig; anders maakt iemand twee accounts. */
export function normaliseerEmail(email: string): string {
  return email.trim().toLowerCase()
}
