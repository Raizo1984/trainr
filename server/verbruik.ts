/**
 * Een grens op wat het model mag kosten.
 *
 * De sleutel staat op de server en niet in de browser, dus niemand kan hem
 * stelen. Maar de eindpunten die hem gebruiken staan wel open, en een open
 * eindpunt zonder teller is een rekening die iemand anders voor je invult. Eén
 * bezoeker met een script haalt er in een nacht meer doorheen dan een jaar
 * normaal gebruik.
 *
 * Drie grenzen, elk voor een ander soort misbruik:
 *
 *   per minuut  tegen een script dat in één ruk duizend verzoeken doet;
 *   per dag     tegen iemand die het rustig aan doet maar de hele dag doorgaat;
 *   tokens      tegen weinig verzoeken die elk enorm zijn.
 *
 * De eerste twee tellen verzoeken, de derde telt wat er werkelijk verbruikt is.
 * Dat laatste is het enige dat één op één staat met wat je betaalt.
 *
 * Daarboven staat een grens voor alles bij elkaar. Die beschermt niet tegen één
 * bezoeker maar tegen duizend, en dat is het geval waar je 's nachts wakker van
 * ligt: niet één account dat te veel doet, maar een adres dat ergens gedeeld
 * wordt.
 */

import { beschikbaar, db } from './db.ts'

export interface Grens {
  verzoekenPerMinuut: number
  verzoekenPerDag: number
  tokensPerDag: number
}

/**
 * Een getal uit de omgeving, of de standaard.
 *
 * Elke grens is te verzetten zonder de code aan te raken. Dat is geen luxe:
 * wat een redelijke grens is hangt af van je tegoed en van hoe mensen de app
 * werkelijk gebruiken, en dat weet je pas als ze hem gebruiken.
 */
function uitOmgeving(naam: string, standaard: number): number {
  const waarde = Number(process.env[naam])
  return Number.isFinite(waarde) && waarde >= 0 ? waarde : standaard
}

/**
 * De grens voor deze bezoeker.
 *
 * Wie is ingelogd heeft een account aangemaakt, toestemming gegeven en is terug
 * te vinden. Wie dat niet heeft is op dit moment niet meer dan een IP-adres, en
 * een IP-adres kost niets om te vervangen.
 *
 * De getallen zijn zo gekozen dat je er bij normaal gebruik niet tegenaan
 * loopt. Een zware dag is een sessie met een paar klachten duiden, een gesprek
 * met de coach en een weekrapport: ruim onder de helft van wat een account mag.
 */
export function grensVoor(ingelogd: boolean): Grens {
  if (ingelogd) {
    return {
      verzoekenPerMinuut: uitOmgeving('AI_INGELOGD_PER_MINUUT', 10),
      verzoekenPerDag: uitOmgeving('AI_INGELOGD_PER_DAG', 80),
      tokensPerDag: uitOmgeving('AI_INGELOGD_TOKENS', 300_000),
    }
  }
  return {
    verzoekenPerMinuut: uitOmgeving('AI_ANONIEM_PER_MINUUT', 5),
    verzoekenPerDag: uitOmgeving('AI_ANONIEM_PER_DAG', 20),
    tokensPerDag: uitOmgeving('AI_ANONIEM_TOKENS', 80_000),
  }
}

/**
 * Alles bij elkaar, per dag.
 *
 * Deze grens beschermt niet tegen één bezoeker maar tegen duizend, en dat is
 * het geval waar je 's nachts wakker van ligt: niet één account dat te veel
 * doet, maar een adres dat ergens gedeeld wordt. Met de standaardwaarde kost
 * een volle dag bij gpt-4o grofweg een paar euro. Op nul zetten schakelt hem
 * uit; doe dat alleen als je ergens anders een plafond hebt staan.
 */
export function tokensPerDagTotaal(): number {
  return uitOmgeving('AI_TOKENS_PER_DAG', 1_000_000)
}

export type Oordeel =
  | { mag: true }
  | { mag: false; reden: 'per-minuut' | 'per-dag' | 'tokens' | 'totaal'; wachtSeconden: number }

interface Regel {
  sleutel: string
  route: string
  op: number
  tokens: number
}

/**
 * De teller als er geen database is.
 *
 * Een publicatie die meeschaalt draait meerdere kopieën, en elke kopie telt dan
 * apart: tien keer zoveel kopieën is tien keer zoveel ruimte. Daarom is de
 * database de plek waar dit hoort. Maar de app draait ook zonder database, en
 * dan is een grens per kopie nog altijd oneindig veel beter dan geen grens.
 */
const geheugen: Regel[] = []

function opschonenGeheugen(nu: number): void {
  const grens = nu - 24 * 60 * 60 * 1000
  let i = 0
  while (i < geheugen.length && geheugen[i].op < grens) i++
  if (i > 0) geheugen.splice(0, i)
}

/* ------------------------------------------------------------------ */
/* Tellen                                                              */
/* ------------------------------------------------------------------ */

interface Stand {
  minuut: number
  dag: number
  tokensDag: number
}

/**
 * Of de database het op dit moment doet.
 *
 * Gaat er iets mis met tellen, dan is doorlaten zonder grens het slechtste van
 * twee: precies op het moment dat je niet meer weet wat er verbruikt wordt,
 * staat de deur open. Weigeren is ook fout, want dan legt een hikje in de
 * database de coach plat. We vallen daarom terug op de teller in het geheugen,
 * en zetten hem even opzij zodat een kapotte database niet bij elk verzoek
 * opnieuw bevraagd wordt.
 */
let databaseHapert = 0

function databaseBruikbaar(): boolean {
  return beschikbaar() && Date.now() > databaseHapert
}

function meldHapering(waar: string, error: unknown): void {
  databaseHapert = Date.now() + 30_000
  console.error(`Verbruik tellen mislukte (${waar}), even op het geheugen:`, error)
}

async function standUitDatabase(sleutel: string): Promise<Stand> {
  const { rows } = await db().query<{ minuut: string; dag: string; tokens: string }>(
    `select
       count(*) filter (where op > now() - interval '1 minute')::text as minuut,
       count(*)::text as dag,
       coalesce(sum(tokens), 0)::text as tokens
     from ai_verbruik
     where sleutel = $1 and op > now() - interval '1 day'`,
    [sleutel],
  )
  return {
    minuut: Number(rows[0]?.minuut ?? 0),
    dag: Number(rows[0]?.dag ?? 0),
    tokensDag: Number(rows[0]?.tokens ?? 0),
  }
}

function standUitGeheugen(sleutel: string): Stand {
  const nu = Date.now()
  opschonenGeheugen(nu)
  const eenMinuut = nu - 60 * 1000
  let minuut = 0
  let dag = 0
  let tokensDag = 0
  for (const regel of geheugen) {
    if (regel.sleutel !== sleutel) continue
    dag++
    tokensDag += regel.tokens
    if (regel.op > eenMinuut) minuut++
  }
  return { minuut, dag, tokensDag }
}

async function tokensVandaagTotaal(): Promise<number> {
  if (databaseBruikbaar()) {
    try {
      const { rows } = await db().query<{ tokens: string }>(
        `select coalesce(sum(tokens), 0)::text as tokens
         from ai_verbruik where op > now() - interval '1 day'`,
      )
      return Number(rows[0]?.tokens ?? 0)
    } catch (error) {
      meldHapering('totaal', error)
    }
  }
  const nu = Date.now()
  opschonenGeheugen(nu)
  return geheugen.reduce((som, regel) => som + regel.tokens, 0)
}

/* ------------------------------------------------------------------ */
/* Beslissen en noteren                                                */
/* ------------------------------------------------------------------ */

/** Mag dit verzoek erdoor, en zo niet: waarom en hoe lang niet. */
export async function magHet(sleutel: string, grens: Grens): Promise<Oordeel> {
  let stand: Stand | null = null
  if (databaseBruikbaar()) {
    try {
      stand = await standUitDatabase(sleutel)
    } catch (error) {
      meldHapering('stand', error)
    }
  }
  if (!stand) stand = standUitGeheugen(sleutel)

  if (stand.minuut >= grens.verzoekenPerMinuut) {
    return { mag: false, reden: 'per-minuut', wachtSeconden: 60 }
  }
  if (stand.dag >= grens.verzoekenPerDag) {
    return { mag: false, reden: 'per-dag', wachtSeconden: 3600 }
  }
  if (stand.tokensDag >= grens.tokensPerDag) {
    return { mag: false, reden: 'tokens', wachtSeconden: 3600 }
  }

  const totaal = tokensPerDagTotaal()
  if (totaal > 0 && (await tokensVandaagTotaal()) >= totaal) {
    return { mag: false, reden: 'totaal', wachtSeconden: 3600 }
  }

  return { mag: true }
}

/**
 * Een bon: het verzoek staat genoteerd, het bedrag komt later.
 *
 * Het aantal tokens weet je pas als het antwoord er is, maar het verzoek zelf
 * moet meteen meetellen. Anders telt een script dat honderd keer een fout
 * uitlokt als nul verzoeken, en dat is precies het gedrag dat je wilde stoppen.
 */
export type Bon = { rij: number } | { regel: Regel }

export async function noteerVerzoek(sleutel: string, route: string): Promise<Bon> {
  if (databaseBruikbaar()) {
    try {
      const { rows } = await db().query<{ id: string }>(
        'insert into ai_verbruik (sleutel, route, tokens) values ($1, $2, 0) returning id',
        [sleutel, route],
      )
      return { rij: Number(rows[0].id) }
    } catch (error) {
      meldHapering('noteren', error)
    }
  }
  const regel: Regel = { sleutel, route, op: Date.now(), tokens: 0 }
  geheugen.push(regel)
  return { regel }
}

/** Het bedrag bij de bon zetten zodra het antwoord binnen is. */
export async function boekTokens(bon: Bon, tokens: number): Promise<void> {
  const afgerond = Math.max(0, Math.round(tokens))
  if (afgerond === 0) return
  if ('regel' in bon) {
    bon.regel.tokens = afgerond
    return
  }
  try {
    await db().query('update ai_verbruik set tokens = $2 where id = $1', [bon.rij, afgerond])
  } catch (error) {
    // Het verzoek staat al geteld; alleen het bedrag mist. Dat is hinderlijk
    // maar niet gevaarlijk, dus hier stopt het.
    console.error('Tokens bijschrijven mislukte:', error)
  }
}

/** Rijen ouder dan een dag zeggen niets meer en groeien anders eindeloos door. */
export async function ruimVerbruikOp(): Promise<void> {
  if (!databaseBruikbaar()) {
    opschonenGeheugen(Date.now())
    return
  }
  await db().query(`delete from ai_verbruik where op < now() - interval '2 days'`)
}

/** Alleen voor tests: de teller in het geheugen leegmaken. */
export function wisGeheugen(): void {
  geheugen.length = 0
}
