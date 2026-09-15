/**
 * Je gegevens gelijk houden tussen toestellen, ook als je uren zonder bereik
 * traint.
 *
 * Het uitgangspunt is de sportschool: je logt daar je sets, er is geen
 * verbinding, je stopt je telefoon in je tas en pas thuis of de volgende dag
 * gaat de app weer open. Wat je daar hebt ingevoerd moet er dan nog zijn, en
 * vanzelf op de server komen zonder dat je ernaar hoeft te vragen.
 *
 * Daarvoor onthoudt de app twee dingen, die een herstart overleven:
 *
 * - met welke serverversie dit toestel voor het laatst gelijk stond;
 * - of er sindsdien iets gewijzigd is dat nog niet verstuurd is.
 *
 * Met die twee is het verschil te zien tussen "ik heb offline getraind en de
 * server weet er nog niets van" en "iemand anders heeft ondertussen ook iets
 * gewijzigd". Het eerste is gewoon versturen. Alleen het tweede is een echte
 * botsing waar jij een keuze in moet maken.
 *
 * Zonder die boekhouding lijkt elk verschil op een botsing, en dan krijg je na
 * elke offline sessie de vraag welke versie je wilt houden. Kies je dan de
 * verkeerde, dan is je training van die avond weg.
 */

import { create } from 'zustand'
import { useAppStore } from '@/store/useAppStore'
import * as api from './accountClient'

export type SyncStand =
  | 'uit'          // geen account, of accounts staan uit
  | 'gelijk'       // server en toestel staan gelijk
  | 'bezig'
  | 'wachtend'     // wijziging gezien, nog niet verstuurd
  | 'offline'      // wel wijzigingen, geen verbinding
  | 'conflict'
  | 'fout'

export interface SyncStatus {
  stand: SyncStand
  /** Serverversie waarmee dit toestel voor het laatst gelijk stond. */
  versie: number
  /** Er staan wijzigingen klaar die nog niet op de server staan. */
  vuil: boolean
  laatstGelukt: string | null
  melding: string | null
  /** Bij een botsing: wat er op de server staat, zodat je kunt kiezen. */
  serverStaat: api.ServerStaat | null
}

interface SyncStore extends SyncStatus {
  zet: (patch: Partial<SyncStatus>) => void
}

/* ------------------------------------------------------------------ */
/* Boekhouding die een herstart overleeft                              */
/* ------------------------------------------------------------------ */

const SLEUTEL = 'trainr-sync-v1'

interface Bewaard {
  versie: number
  vuil: boolean
  laatstGelukt: string | null
  /*
   * Of dit toestel een account heeft. Zonder bereik kun je de server niet
   * vragen wie je bent, en juist dan moet de app weten dat wat je invoert
   * straks verstuurd moet worden. Zonder dit bleef een training in de
   * sportschool ongemerkt liggen tot je toevallig iets anders deed.
   */
  account: boolean
}

function lees(): Bewaard {
  try {
    const ruw = localStorage.getItem(SLEUTEL)
    if (!ruw) return { versie: 0, vuil: false, laatstGelukt: null, account: false }
    const data = JSON.parse(ruw) as Partial<Bewaard>
    return {
      versie: typeof data.versie === 'number' ? data.versie : 0,
      vuil: data.vuil === true,
      laatstGelukt: typeof data.laatstGelukt === 'string' ? data.laatstGelukt : null,
      account: data.account === true,
    }
  } catch {
    return { versie: 0, vuil: false, laatstGelukt: null, account: false }
  }
}

function schrijf(b: Bewaard): void {
  try {
    localStorage.setItem(SLEUTEL, JSON.stringify(b))
  } catch {
    // Geen opslag beschikbaar. Dan werkt synchroniseren nog steeds zolang de
    // app open blijft; alleen het onthouden over een herstart heen valt weg.
  }
}

function vergeet(): void {
  try {
    localStorage.removeItem(SLEUTEL)
  } catch {
    // niets te doen
  }
}

const start = lees()

export const useSync = create<SyncStore>()((set) => ({
  stand: 'uit',
  versie: start.versie,
  vuil: start.vuil,
  laatstGelukt: start.laatstGelukt,
  melding: null,
  serverStaat: null,
  zet: (patch) =>
    set((huidig) => {
      const nieuw = { ...huidig, ...patch }
      if (
        patch.versie !== undefined ||
        patch.vuil !== undefined ||
        patch.laatstGelukt !== undefined
      ) {
        schrijf({
          versie: nieuw.versie,
          vuil: nieuw.vuil,
          laatstGelukt: nieuw.laatstGelukt,
          account: lees().account,
        })
      }
      return nieuw
    }),
}))

/** Weet dit toestel dat er een account is, ook zonder verbinding? */
export function heeftAccount(): boolean {
  return lees().account
}

export function markeerAccount(aan: boolean): void {
  const b = lees()
  schrijf({ ...b, account: aan })
}

/** Hoeveel er lokaal staat. Gebruikt om te zien of dit toestel iets te melden heeft. */
function omvang(data: unknown): number {
  if (typeof data !== 'object' || data === null) return 0
  const d = data as { sessions?: unknown[]; measurements?: unknown[]; nutritionDays?: unknown[] }
  return (d.sessions?.length ?? 0) + (d.measurements?.length ?? 0) + (d.nutritionDays?.length ?? 0)
}

function online(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false
}

/* ------------------------------------------------------------------ */
/* Versturen                                                           */
/* ------------------------------------------------------------------ */

let timer: ReturnType<typeof setTimeout> | null = null
let stopVolgen: (() => void) | null = null
let herhaling: ReturnType<typeof setInterval> | null = null
let luisteraars: Array<() => void> = []
let bezig = false

const WACHTTIJD_MS = 2500
const HERPROBEER_MS = 60_000

async function stuurOp(): Promise<void> {
  const sync = useSync.getState()
  if (bezig || !draait || sync.stand === 'conflict') return
  if (!sync.vuil) return

  if (!online()) {
    sync.zet({ stand: 'offline', melding: 'Geen verbinding. Je invoer staat veilig op dit toestel en gaat mee zodra je weer online bent.' })
    return
  }

  bezig = true
  sync.zet({ stand: 'bezig' })
  try {
    const uitkomst = await api.bewaarStaat(useAppStore.getState().momentopname(), sync.versie)
    if (uitkomst.ok) {
      useSync.getState().zet({
        stand: 'gelijk',
        versie: uitkomst.versie,
        vuil: false,
        melding: null,
        laatstGelukt: new Date().toISOString(),
      })
      return
    }
    useSync.getState().zet({
      stand: 'conflict',
      serverStaat: uitkomst.huidige,
      melding: 'Er is op een ander toestel iets gewijzigd. Kies welke gegevens je wilt houden.',
    })
  } catch (error) {
    if (error instanceof api.AccountFout && error.status === 401) {
      useSync.getState().zet({
        stand: 'fout',
        melding: 'Je bent uitgelogd. Log opnieuw in; je invoer staat nog op dit toestel.',
      })
      return
    }
    // Geen bereik is geen fout om over te klagen: het gaat straks vanzelf mee.
    useSync.getState().zet({
      stand: 'offline',
      melding: 'Nog niet op de server. Je invoer staat veilig op dit toestel en gaat mee zodra er verbinding is.',
    })
  } finally {
    bezig = false
  }
}

/* ------------------------------------------------------------------ */
/* Opstarten                                                           */
/* ------------------------------------------------------------------ */

/**
 * Wat er gebeurt zodra de app opengaat, en na inloggen.
 *
 * De vier gevallen, en alleen het laatste vraagt iets aan de gebruiker:
 * 1. Server nog leeg: wat hier staat gaat erheen.
 * 2. Dit toestel leeg en de server niet: ophalen.
 * 3. Wij hebben wijzigingen en de server staat nog op de versie die wij kennen:
 *    gewoon versturen. Dit is de offline sessie van gisteravond.
 * 4. Wij hebben wijzigingen én de server is ondertussen veranderd: kiezen.
 */
export async function afstemmen(): Promise<void> {
  const sync = useSync.getState()
  if (!online()) {
    if (sync.vuil) {
      sync.zet({ stand: 'offline', melding: 'Geen verbinding. Je invoer gaat mee zodra je weer online bent.' })
    }
    return
  }

  sync.zet({ stand: 'bezig', melding: null, serverStaat: null })

  try {
    const server = await api.haalStaat()
    const lokaal = useAppStore.getState().momentopname()
    const bekend = useSync.getState().versie
    const vuil = useSync.getState().vuil

    // 1. Server nog leeg.
    if (server.versie === 0 || server.data === null) {
      const uitkomst = await api.bewaarStaat(lokaal, 0)
      if (uitkomst.ok) {
        useSync.getState().zet({
          stand: 'gelijk',
          versie: uitkomst.versie,
          vuil: false,
          laatstGelukt: new Date().toISOString(),
        })
      }
      return
    }

    // 2. Niets op dit toestel: ophalen.
    if (omvang(lokaal) === 0 && !vuil) {
      useAppStore.getState().zetMomentopname(server.data)
      useSync.getState().zet({
        stand: 'gelijk',
        versie: server.versie,
        vuil: false,
        laatstGelukt: new Date().toISOString(),
      })
      return
    }

    // Al gelijk.
    if (JSON.stringify(lokaal) === JSON.stringify(server.data)) {
      useSync.getState().zet({
        stand: 'gelijk',
        versie: server.versie,
        vuil: false,
        laatstGelukt: new Date().toISOString(),
      })
      return
    }

    // 3. Alleen wij hebben iets gewijzigd. Dit is de offline sessie.
    if (vuil && server.versie === bekend) {
      const uitkomst = await api.bewaarStaat(lokaal, server.versie)
      if (uitkomst.ok) {
        useSync.getState().zet({
          stand: 'gelijk',
          versie: uitkomst.versie,
          vuil: false,
          melding: null,
          laatstGelukt: new Date().toISOString(),
        })
        return
      }
      useSync.getState().zet({
        stand: 'conflict',
        serverStaat: uitkomst.huidige,
        melding: 'Er is op een ander toestel iets gewijzigd. Kies welke gegevens je wilt houden.',
      })
      return
    }

    // Alleen de server is verder: ophalen.
    if (!vuil) {
      useAppStore.getState().zetMomentopname(server.data)
      useSync.getState().zet({
        stand: 'gelijk',
        versie: server.versie,
        vuil: false,
        laatstGelukt: new Date().toISOString(),
      })
      return
    }

    // 4. Allebei iets gewijzigd.
    useSync.getState().zet({
      stand: 'conflict',
      serverStaat: server,
      melding:
        'Op de server en op dit toestel staan verschillende gegevens. Kies welke je wilt houden; de andere gaat verloren.',
    })
  } catch (error) {
    if (error instanceof api.AccountFout && error.status === 401) {
      useSync.getState().zet({ stand: 'uit', melding: null })
      return
    }
    useSync.getState().zet({
      stand: useSync.getState().vuil ? 'offline' : 'fout',
      melding: 'Nog geen verbinding met de server. Je gegevens staan op dit toestel.',
    })
  }
}

/* ------------------------------------------------------------------ */
/* Botsing oplossen                                                    */
/* ------------------------------------------------------------------ */

export async function houdToestel(): Promise<void> {
  const sync = useSync.getState()
  const server = sync.serverStaat
  if (!server) return
  sync.zet({ stand: 'bezig' })
  try {
    const uitkomst = await api.bewaarStaat(useAppStore.getState().momentopname(), server.versie)
    if (uitkomst.ok) {
      useSync.getState().zet({
        stand: 'gelijk',
        versie: uitkomst.versie,
        vuil: false,
        serverStaat: null,
        melding: null,
        laatstGelukt: new Date().toISOString(),
      })
    } else {
      useSync.getState().zet({ stand: 'conflict', serverStaat: uitkomst.huidige })
    }
  } catch {
    useSync.getState().zet({ stand: 'offline', melding: 'Opslaan lukte niet. Je gegevens staan nog op dit toestel.' })
  }
}

export function houdServer(): void {
  const sync = useSync.getState()
  const server = sync.serverStaat
  if (!server) return
  if (!useAppStore.getState().zetMomentopname(server.data)) {
    sync.zet({ stand: 'fout', melding: 'De gegevens van de server zijn niet leesbaar.' })
    return
  }
  // Direct na het terugzetten: wat er nu staat komt van de server, dus schoon.
  useSync.getState().zet({
    stand: 'gelijk',
    versie: server.versie,
    vuil: false,
    serverStaat: null,
    melding: null,
    laatstGelukt: new Date().toISOString(),
  })
}

/* ------------------------------------------------------------------ */
/* Aan- en uitzetten                                                   */
/* ------------------------------------------------------------------ */

let draait = false

/**
 * Begin met bijhouden. Veilig om vaker aan te roepen.
 *
 * Wordt bij het opstarten van de app aangeroepen, niet pas als je Instellingen
 * opent. Anders synchroniseert de app alleen als je toevallig op dat scherm
 * komt, en dat is precies wat je na een training in de sportschool niet doet.
 */
export function startSync(): void {
  if (draait) return
  draait = true
  markeerAccount(true)
  // Meteen uit 'uit', ook als de server onbereikbaar is: de app synchroniseert
  // vanaf nu, alleen nog niet nu meteen.
  useSync.getState().zet({
    stand: useSync.getState().vuil ? 'wachtend' : 'gelijk',
  })

  void afstemmen()

  stopVolgen = useAppStore.subscribe(() => {
    // Bewust niet kijken naar `stand`: zonder bereik blijft die op 'uit' staan,
    // en dan zou juist een training in de sportschool niet als te versturen
    // genoteerd worden. Of we moeten bijhouden hangt af van of dit toestel een
    // account heeft, niet van of de server nu bereikbaar is.
    const stand = useSync.getState().stand
    // Meteen vastleggen dat er iets te versturen is, nog voor het wachten.
    // Sluit je de app tijdens dat wachten, dan weet hij het straks nog.
    useSync.getState().zet({ vuil: true, stand: stand === 'conflict' ? 'conflict' : 'wachtend' })
    if (stand === 'conflict') return
    if (timer) clearTimeout(timer)
    // Tijdens het loggen van een sessie verandert er van alles; elk
    // tussenstadium versturen is zonde van de verbinding en de batterij.
    timer = setTimeout(() => void stuurOp(), WACHTTIJD_MS)
  })

  const opWeerOnline = () => {
    if (useSync.getState().vuil) void stuurOp()
    else void afstemmen()
  }
  const opZichtbaar = () => {
    if (document.visibilityState === 'visible') void afstemmen()
  }

  window.addEventListener('online', opWeerOnline)
  document.addEventListener('visibilitychange', opZichtbaar)
  luisteraars = [
    () => window.removeEventListener('online', opWeerOnline),
    () => document.removeEventListener('visibilitychange', opZichtbaar),
  ]

  // Een vangnet voor het geval de browser geen online-melding geeft. Dat
  // gebeurt vaker dan je denkt, bijvoorbeeld bij een verbinding die er wel is
  // maar niets doorlaat.
  herhaling = setInterval(() => {
    if (useSync.getState().vuil) void stuurOp()
  }, HERPROBEER_MS)
}

export function stopSync({ vergeetBoekhouding = false } = {}): void {
  draait = false
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  if (herhaling) {
    clearInterval(herhaling)
    herhaling = null
  }
  if (stopVolgen) {
    stopVolgen()
    stopVolgen = null
  }
  for (const af of luisteraars) af()
  luisteraars = []
  if (vergeetBoekhouding) {
    vergeet()
    markeerAccount(false)
  }
  useSync.getState().zet({
    stand: 'uit',
    versie: vergeetBoekhouding ? 0 : useSync.getState().versie,
    vuil: vergeetBoekhouding ? false : useSync.getState().vuil,
    serverStaat: null,
    melding: null,
  })
}

/** Meteen versturen, bijvoorbeeld voordat je uitlogt of op verzoek. */
export async function nuOpsturen(): Promise<void> {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  if (!useSync.getState().vuil) {
    await afstemmen()
    return
  }
  await stuurOp()
}
