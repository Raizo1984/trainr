/**
 * Accounts: registreren, inloggen, sessies en de staat per gebruiker.
 *
 * Alles wat met de database praat staat hier, los van Express. Dat maakt het
 * testbaar zonder een webserver op te tuigen, en het houdt de eindpunten dun.
 */

import type { PoolClient } from 'pg'
import { db, inTransactie } from './db.ts'
import {
  SESSIE_DAGEN,
  hashWachtwoord,
  klopt,
  nieuwToken,
  normaliseerEmail,
  tokenHash,
} from './auth.ts'

/** De tekst waar iemand mee akkoord gaat. Wijzigt de tekst, wijzig dan ook dit. */
export const TOESTEMMING_VERSIE = '2026-09-15'

export interface Gebruiker {
  id: string
  email: string
  toestemmingVersie: string | null
  toestemmingOp: Date | null
}

export class AccountFout extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
  ) {
    super(message)
  }
}

/* ------------------------------------------------------------------ */
/* Snelheidsbegrenzing                                                 */
/* ------------------------------------------------------------------ */

const POGINGEN_MAX = 10
const POGINGEN_VENSTER_MINUTEN = 15

/**
 * Hoeveel mislukte pogingen er recent waren voor deze sleutel.
 *
 * In de database en niet in het geheugen, want een publicatie die meeschaalt
 * draait meerdere kopieën. Een teller in het geheugen betekent dan dat je
 * gewoon tien keer per kopie mag proberen.
 */
export async function telPogingen(sleutel: string): Promise<number> {
  const { rows } = await db().query<{ aantal: string }>(
    `select count(*)::text as aantal from inlogpogingen
     where sleutel = $1 and op > now() - ($2 || ' minutes')::interval`,
    [sleutel, String(POGINGEN_VENSTER_MINUTEN)],
  )
  return Number(rows[0]?.aantal ?? 0)
}

export async function noteerPoging(sleutel: string): Promise<void> {
  await db().query('insert into inlogpogingen (sleutel) values ($1)', [sleutel])
}

async function wisPogingen(sleutel: string): Promise<void> {
  await db().query('delete from inlogpogingen where sleutel = $1', [sleutel])
}

/** Oude rijen weggooien; ze zeggen niets meer en groeien anders eindeloos door. */
export async function ruimPogingenOp(): Promise<void> {
  await db().query(`delete from inlogpogingen where op < now() - interval '1 day'`)
}

/* ------------------------------------------------------------------ */
/* Registreren                                                         */
/* ------------------------------------------------------------------ */

export async function registreer(
  emailRuw: string,
  wachtwoord: string,
  toestemming: boolean,
): Promise<Gebruiker> {
  if (!toestemming) {
    throw new AccountFout(
      'geen-toestemming',
      'Zonder toestemming kunnen we je gezondheidsgegevens niet bewaren. Je kunt de app wel zonder account blijven gebruiken; je gegevens blijven dan op dit toestel.',
    )
  }

  const email = normaliseerEmail(emailRuw)
  const hash = await hashWachtwoord(wachtwoord)

  try {
    const { rows } = await db().query<{
      id: string
      email: string
      toestemming_versie: string | null
      toestemming_op: Date | null
    }>(
      `insert into gebruikers (email, wachtwoord_hash, toestemming_versie, toestemming_op)
       values ($1, $2, $3, now())
       returning id, email, toestemming_versie, toestemming_op`,
      [email, hash, TOESTEMMING_VERSIE],
    )
    const rij = rows[0]
    return {
      id: rij.id,
      email: rij.email,
      toestemmingVersie: rij.toestemming_versie,
      toestemmingOp: rij.toestemming_op,
    }
  } catch (error) {
    // 23505 = unieke sleutel geschonden.
    if (typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505') {
      throw new AccountFout(
        'bestaat-al',
        'Er bestaat al een account met dit e-mailadres. Log in, of vraag een nieuw wachtwoord aan.',
        409,
      )
    }
    throw error
  }
}

/* ------------------------------------------------------------------ */
/* Inloggen                                                            */
/* ------------------------------------------------------------------ */

export interface Inlog {
  gebruiker: Gebruiker
  token: string
  verlooptOp: Date
}

export async function login(emailRuw: string, wachtwoord: string): Promise<Inlog> {
  const email = normaliseerEmail(emailRuw)

  if ((await telPogingen(email)) >= POGINGEN_MAX) {
    throw new AccountFout(
      'te-veel-pogingen',
      `Te veel mislukte pogingen. Probeer het over ${POGINGEN_VENSTER_MINUTEN} minuten opnieuw.`,
      429,
    )
  }

  const { rows } = await db().query<{
    id: string
    email: string
    wachtwoord_hash: string
    toestemming_versie: string | null
    toestemming_op: Date | null
  }>(
    'select id, email, wachtwoord_hash, toestemming_versie, toestemming_op from gebruikers where email = $1',
    [email],
  )
  const rij = rows[0]

  /*
   * Ook zonder gevonden gebruiker wordt er een hash berekend. Anders is een
   * bestaand account merkbaar sneller of trager dan een onbestaand, en kan
   * iemand daarmee uitvinden wie er een account heeft. Bij een app met
   * gezondheidsgegevens is dat op zichzelf al gevoelige informatie.
   */
  const hash = rij?.wachtwoord_hash ?? '$'.repeat(6)
  const goed = await klopt(wachtwoord, hash)

  if (!rij || !goed) {
    await noteerPoging(email)
    throw new AccountFout('onjuist', 'E-mailadres of wachtwoord klopt niet.', 401)
  }

  await wisPogingen(email)

  const token = nieuwToken()
  const verlooptOp = new Date(Date.now() + SESSIE_DAGEN * 24 * 60 * 60 * 1000)
  await db().query(
    'insert into sessies (token_hash, gebruiker_id, verloopt_op) values ($1, $2, $3)',
    [tokenHash(token), rij.id, verlooptOp],
  )
  await db().query('update gebruikers set laatst_actief_op = now() where id = $1', [rij.id])

  return {
    gebruiker: {
      id: rij.id,
      email: rij.email,
      toestemmingVersie: rij.toestemming_versie,
      toestemmingOp: rij.toestemming_op,
    },
    token,
    verlooptOp,
  }
}

/** De gebruiker bij een sessietoken, of null. */
export async function gebruikerBijToken(token: string): Promise<Gebruiker | null> {
  if (!token) return null
  const { rows } = await db().query<{
    id: string
    email: string
    toestemming_versie: string | null
    toestemming_op: Date | null
  }>(
    `select g.id, g.email, g.toestemming_versie, g.toestemming_op
     from sessies s
     join gebruikers g on g.id = s.gebruiker_id
     where s.token_hash = $1 and s.verloopt_op > now()`,
    [tokenHash(token)],
  )
  const rij = rows[0]
  if (!rij) return null

  // Bijhouden wanneer een sessie voor het laatst gebruikt is, voor opruimen.
  await db().query('update sessies set laatst_gezien_op = now() where token_hash = $1', [
    tokenHash(token),
  ])

  return {
    id: rij.id,
    email: rij.email,
    toestemmingVersie: rij.toestemming_versie,
    toestemmingOp: rij.toestemming_op,
  }
}

export async function logUit(token: string): Promise<void> {
  await db().query('delete from sessies where token_hash = $1', [tokenHash(token)])
}

/** Overal uitloggen. Hoort bij een wachtwoordwijziging en bij verdenking. */
export async function logOveralUit(gebruikerId: string, behalveToken?: string): Promise<number> {
  const { rowCount } = behalveToken
    ? await db().query('delete from sessies where gebruiker_id = $1 and token_hash <> $2', [
        gebruikerId,
        tokenHash(behalveToken),
      ])
    : await db().query('delete from sessies where gebruiker_id = $1', [gebruikerId])
  return rowCount ?? 0
}

export async function ruimSessiesOp(): Promise<void> {
  await db().query('delete from sessies where verloopt_op < now()')
}

/* ------------------------------------------------------------------ */
/* Wachtwoord wijzigen                                                 */
/* ------------------------------------------------------------------ */

export async function wijzigWachtwoord(
  gebruikerId: string,
  huidig: string,
  nieuw: string,
): Promise<void> {
  const { rows } = await db().query<{ wachtwoord_hash: string }>(
    'select wachtwoord_hash from gebruikers where id = $1',
    [gebruikerId],
  )
  const rij = rows[0]
  if (!rij || !(await klopt(huidig, rij.wachtwoord_hash))) {
    throw new AccountFout('onjuist', 'Je huidige wachtwoord klopt niet.', 401)
  }
  await db().query('update gebruikers set wachtwoord_hash = $1 where id = $2', [
    await hashWachtwoord(nieuw),
    gebruikerId,
  ])
}

/* ------------------------------------------------------------------ */
/* Staat per gebruiker                                                 */
/* ------------------------------------------------------------------ */

export interface Staat {
  versie: number
  data: unknown
  bijgewerktOp: Date
}

export async function haalStaat(gebruikerId: string): Promise<Staat | null> {
  const { rows } = await db().query<{ versie: number; data: unknown; bijgewerkt_op: Date }>(
    'select versie, data, bijgewerkt_op from staat where gebruiker_id = $1',
    [gebruikerId],
  )
  const rij = rows[0]
  return rij ? { versie: rij.versie, data: rij.data, bijgewerktOp: rij.bijgewerkt_op } : null
}

/**
 * Staat opslaan, met versienummer tegen overschrijven.
 *
 * Wie schrijft met een oudere versie dan wat er staat, krijgt een conflict
 * terug in plaats van het werk van een ander toestel te wissen. Dat gebeurt
 * echt: je logt op je telefoon een sessie terwijl je laptop nog openstaat.
 */
export async function bewaarStaat(
  gebruikerId: string,
  data: unknown,
  verwachteVersie: number | null,
): Promise<{ ok: true; versie: number } | { ok: false; huidige: Staat }> {
  return inTransactie(async (client: PoolClient) => {
    const { rows } = await client.query<{ versie: number; data: unknown; bijgewerkt_op: Date }>(
      'select versie, data, bijgewerkt_op from staat where gebruiker_id = $1 for update',
      [gebruikerId],
    )
    const bestaand = rows[0]

    if (!bestaand) {
      await client.query('insert into staat (gebruiker_id, versie, data) values ($1, 1, $2)', [
        gebruikerId,
        JSON.stringify(data),
      ])
      return { ok: true as const, versie: 1 }
    }

    if (verwachteVersie !== null && verwachteVersie !== bestaand.versie) {
      return {
        ok: false as const,
        huidige: {
          versie: bestaand.versie,
          data: bestaand.data,
          bijgewerktOp: bestaand.bijgewerkt_op,
        },
      }
    }

    const nieuweVersie = bestaand.versie + 1
    await client.query(
      'update staat set versie = $1, data = $2, bijgewerkt_op = now() where gebruiker_id = $3',
      [nieuweVersie, JSON.stringify(data), gebruikerId],
    )
    return { ok: true as const, versie: nieuweVersie }
  })
}

/* ------------------------------------------------------------------ */
/* Verwijderen                                                         */
/* ------------------------------------------------------------------ */

/**
 * Account en alles eraan weg. Artikel 17 AVG, het recht op vergetelheid.
 *
 * Geen "gemarkeerd als verwijderd" maar echt weg. Sessies en staat gaan mee
 * via de vreemde sleutels, en de inlogpogingen ruimen we apart op omdat die
 * op e-mailadres staan en niet op id.
 */
export async function verwijderAccount(gebruikerId: string): Promise<void> {
  await inTransactie(async (client: PoolClient) => {
    const { rows } = await client.query<{ email: string }>(
      'select email from gebruikers where id = $1',
      [gebruikerId],
    )
    await client.query('delete from gebruikers where id = $1', [gebruikerId])
    if (rows[0]) {
      await client.query('delete from inlogpogingen where sleutel = $1', [rows[0].email])
    }
  })
}
