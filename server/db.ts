/**
 * Verbinding met de database en het schema.
 *
 * Twee uitgangspunten.
 *
 * Zonder `DATABASE_URL` start de app gewoon, maar zonder accounts. De app
 * bewaart je gegevens dan lokaal op je toestel, zoals hij dat altijd deed. Een
 * ontbrekende database mag geen kapotte app opleveren.
 *
 * De migraties staan hier als gewone SQL in volgorde, zonder extra gereedschap.
 * Bij een schema van vier tabellen kost een migratiebibliotheek meer dan hij
 * oplevert, en dit is te lezen zonder dat je die bibliotheek kent.
 */

import { Pool } from 'pg'
import type { PoolClient } from 'pg'

let pool: Pool | null = null

export function beschikbaar(): boolean {
  return Boolean(process.env.DATABASE_URL)
}

export function db(): Pool {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL ontbreekt; accounts staan uit.')
    }
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // Beheerde databases vragen vrijwel altijd TLS, en hun certificaat is
      // niet altijd door een bekende autoriteit ondertekend.
      ssl: process.env.DATABASE_SSL === 'uit' ? undefined : { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30_000,
    })
  }
  return pool
}

export async function sluit(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = null
  }
}

/**
 * Het schema, in volgorde. Elke stap draait één keer en wordt vastgelegd.
 *
 * Toevoegen doe je onderaan, nooit door een bestaande stap te wijzigen: die is
 * bij bestaande installaties al gedraaid en wordt niet opnieuw uitgevoerd.
 */
const MIGRATIES: Array<{ naam: string; sql: string }> = [
  {
    naam: '001-gebruikers',
    sql: `
      create table gebruikers (
        id uuid primary key default gen_random_uuid(),
        email text not null unique,
        wachtwoord_hash text not null,
        aangemaakt_op timestamptz not null default now(),
        laatst_actief_op timestamptz not null default now(),
        -- Toestemming voor het verwerken van gezondheidsgegevens, artikel 9
        -- AVG. De versie erbij, zodat een latere tekst een nieuwe toestemming
        -- vraagt in plaats van stilzwijgend op de oude te leunen.
        toestemming_versie text,
        toestemming_op timestamptz
      );
    `,
  },
  {
    naam: '002-sessies',
    sql: `
      create table sessies (
        -- Alleen de hash van het token. Wie de database leest, kan daarmee
        -- niet inloggen.
        token_hash text primary key,
        gebruiker_id uuid not null references gebruikers(id) on delete cascade,
        aangemaakt_op timestamptz not null default now(),
        verloopt_op timestamptz not null,
        laatst_gezien_op timestamptz not null default now()
      );
      create index sessies_gebruiker on sessies (gebruiker_id);
      create index sessies_verloop on sessies (verloopt_op);
    `,
  },
  {
    naam: '003-staat',
    sql: `
      create table staat (
        gebruiker_id uuid primary key references gebruikers(id) on delete cascade,
        -- Loopt op bij elke opslag. Wie met een oudere versie schrijft, krijgt
        -- een conflict in plaats van het werk van een ander toestel te wissen.
        versie integer not null default 1,
        data jsonb not null,
        bijgewerkt_op timestamptz not null default now()
      );
    `,
  },
  {
    naam: '004-inlogpogingen',
    sql: `
      create table inlogpogingen (
        id bigserial primary key,
        sleutel text not null,
        op timestamptz not null default now()
      );
      create index inlogpogingen_sleutel on inlogpogingen (sleutel, op);
    `,
  },
  {
    naam: '005-herstel',
    sql: `
      create table herstel (
        -- Alleen de hash van het token, net als bij sessies. Wie de database
        -- leest, kan daarmee geen wachtwoord van iemand anders instellen.
        token_hash text primary key,
        gebruiker_id uuid not null references gebruikers(id) on delete cascade,
        aangemaakt_op timestamptz not null default now(),
        verloopt_op timestamptz not null,
        -- Een gebruikt token blijft staan tot het verloopt, zodat een tweede
        -- poging een duidelijke melding kan geven in plaats van niets.
        gebruikt_op timestamptz
      );
      create index herstel_gebruiker on herstel (gebruiker_id);
      create index herstel_verloop on herstel (verloopt_op);
    `,
  },
  {
    naam: '006-ai-verbruik',
    sql: `
      -- Elk verzoek aan het model, met wat het gekost heeft. Niet om
      -- gebruikers te volgen maar om een rekening te begrenzen: zonder teller
      -- kan één bezoeker het hele tegoed opmaken.
      create table ai_verbruik (
        id bigserial primary key,
        -- 'gebruiker:<uuid>' of 'adres:<ip>'. Geen verwijzing naar gebruikers,
        -- zodat een verwijderd account de teller niet meesleept.
        sleutel text not null,
        route text not null,
        op timestamptz not null default now(),
        tokens integer not null default 0
      );
      create index ai_verbruik_sleutel on ai_verbruik (sleutel, op);
      create index ai_verbruik_op on ai_verbruik (op);
    `,
  },
]

export async function migreer(): Promise<string[]> {
  const client = await db().connect()
  const gedraaid: string[] = []
  try {
    await client.query(`
      create table if not exists migraties (
        naam text primary key,
        op timestamptz not null default now()
      );
    `)
    const { rows } = await client.query<{ naam: string }>('select naam from migraties')
    const gedaan = new Set(rows.map((r) => r.naam))

    for (const migratie of MIGRATIES) {
      if (gedaan.has(migratie.naam)) continue
      // Per migratie een transactie: half uitgevoerd schema is erger dan geen.
      await client.query('begin')
      try {
        await client.query(migratie.sql)
        await client.query('insert into migraties (naam) values ($1)', [migratie.naam])
        await client.query('commit')
        gedraaid.push(migratie.naam)
      } catch (error) {
        await client.query('rollback')
        throw error
      }
    }
  } finally {
    client.release()
  }
  return gedraaid
}

/** Een reeks vragen in één transactie. */
export async function inTransactie<T>(werk: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await db().connect()
  try {
    await client.query('begin')
    const uitkomst = await werk(client)
    await client.query('commit')
    return uitkomst
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}
