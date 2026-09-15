/**
 * Je gegevens gelijk houden tussen toestellen.
 *
 * De opslag op dit toestel blijft leidend voor het gebruik: de app werkt
 * zonder bereik, en dat mag niet verdwijnen doordat er nu een server is. De
 * server is een kopie die bijgewerkt wordt zodra dat kan.
 *
 * Bij een botsing wordt er niets stilzwijgend overschreven. Twee toestellen die
 * allebei iets hebben gelogd, is geen randgeval maar iets wat gebeurt zodra je
 * de app op je telefoon én je laptop gebruikt. De app zegt dan wat er aan beide
 * kanten staat en laat jou kiezen.
 */

import { create } from 'zustand'
import { useAppStore } from '@/store/useAppStore'
import * as api from './accountClient'

export type SyncStand =
  | 'uit'          // geen account, of geen server
  | 'gelijk'       // server en toestel zijn bij
  | 'bezig'
  | 'wachtend'     // wijziging gezien, nog niet verstuurd
  | 'conflict'
  | 'fout'

export interface SyncStatus {
  stand: SyncStand
  versie: number
  laatstGelukt: string | null
  melding: string | null
  /** Bij een conflict: wat er op de server staat, zodat je kunt kiezen. */
  serverStaat: api.ServerStaat | null
}

interface SyncStore extends SyncStatus {
  zet: (patch: Partial<SyncStatus>) => void
}

export const useSync = create<SyncStore>()((set) => ({
  stand: 'uit',
  versie: 0,
  laatstGelukt: null,
  melding: null,
  serverStaat: null,
  zet: (patch) => set(patch),
}))

/** Hoeveel er lokaal staat. Gebruikt om te bepalen wat een botsing waard is. */
function omvang(data: unknown): number {
  if (typeof data !== 'object' || data === null) return 0
  const d = data as { sessions?: unknown[]; measurements?: unknown[]; nutritionDays?: unknown[] }
  return (d.sessions?.length ?? 0) + (d.measurements?.length ?? 0) + (d.nutritionDays?.length ?? 0)
}

/**
 * Wat er gebeurt direct na inloggen.
 *
 * Drie gevallen, en alleen het derde vraagt iets aan de gebruiker:
 * 1. Server leeg: wat hier staat gaat erheen.
 * 2. Toestel leeg: wat daar staat komt hierheen.
 * 3. Allebei gevuld: kiezen, want samenvoegen zou stilletjes dubbele sessies
 *    of tegenstrijdige aanpassingen opleveren.
 */
export async function naInloggen(): Promise<void> {
  const sync = useSync.getState()
  sync.zet({ stand: 'bezig', melding: null, serverStaat: null })

  try {
    const server = await api.haalStaat()
    const lokaal = useAppStore.getState().momentopname()

    if (server.versie === 0 || server.data === null) {
      const uitkomst = await api.bewaarStaat(lokaal, 0)
      if (uitkomst.ok) {
        sync.zet({ stand: 'gelijk', versie: uitkomst.versie, laatstGelukt: new Date().toISOString() })
      }
      return
    }

    if (omvang(lokaal) === 0) {
      useAppStore.getState().zetMomentopname(server.data)
      sync.zet({ stand: 'gelijk', versie: server.versie, laatstGelukt: new Date().toISOString() })
      return
    }

    if (JSON.stringify(lokaal) === JSON.stringify(server.data)) {
      sync.zet({ stand: 'gelijk', versie: server.versie, laatstGelukt: new Date().toISOString() })
      return
    }

    sync.zet({
      stand: 'conflict',
      versie: server.versie,
      serverStaat: server,
      melding:
        'Op de server en op dit toestel staan verschillende gegevens. Kies welke je wilt houden; de andere gaat verloren.',
    })
  } catch (error) {
    sync.zet({
      stand: 'fout',
      melding: error instanceof Error ? error.message : 'Synchroniseren lukte niet.',
    })
  }
}

/** Bij een conflict: houd wat op dit toestel staat. */
export async function houdToestel(): Promise<void> {
  const sync = useSync.getState()
  const server = sync.serverStaat
  if (!server) return
  sync.zet({ stand: 'bezig' })
  try {
    const uitkomst = await api.bewaarStaat(useAppStore.getState().momentopname(), server.versie)
    if (uitkomst.ok) {
      sync.zet({
        stand: 'gelijk',
        versie: uitkomst.versie,
        serverStaat: null,
        melding: null,
        laatstGelukt: new Date().toISOString(),
      })
    } else {
      sync.zet({ stand: 'conflict', serverStaat: uitkomst.huidige, versie: uitkomst.huidige.versie })
    }
  } catch (error) {
    sync.zet({ stand: 'fout', melding: error instanceof Error ? error.message : 'Opslaan lukte niet.' })
  }
}

/** Bij een conflict: houd wat op de server staat. */
export function houdServer(): void {
  const sync = useSync.getState()
  const server = sync.serverStaat
  if (!server) return
  if (!useAppStore.getState().zetMomentopname(server.data)) {
    sync.zet({ stand: 'fout', melding: 'De gegevens van de server zijn niet leesbaar.' })
    return
  }
  sync.zet({
    stand: 'gelijk',
    versie: server.versie,
    serverStaat: null,
    melding: null,
    laatstGelukt: new Date().toISOString(),
  })
}

/* ------------------------------------------------------------------ */
/* Automatisch bijwerken                                               */
/* ------------------------------------------------------------------ */

let timer: ReturnType<typeof setTimeout> | null = null
let stopVolgen: (() => void) | null = null

const WACHTTIJD_MS = 2500

async function stuurOp(): Promise<void> {
  const sync = useSync.getState()
  if (sync.stand === 'conflict' || sync.stand === 'uit') return

  sync.zet({ stand: 'bezig' })
  try {
    const uitkomst = await api.bewaarStaat(useAppStore.getState().momentopname(), sync.versie)
    if (uitkomst.ok) {
      sync.zet({
        stand: 'gelijk',
        versie: uitkomst.versie,
        melding: null,
        laatstGelukt: new Date().toISOString(),
      })
      return
    }
    sync.zet({
      stand: 'conflict',
      serverStaat: uitkomst.huidige,
      versie: uitkomst.huidige.versie,
      melding:
        'Er is op een ander toestel iets gewijzigd. Kies welke gegevens je wilt houden.',
    })
  } catch (error) {
    // Geen bereik is geen fout om over te klagen: het lukt straks wel weer.
    const bericht = error instanceof api.AccountFout && error.status === 401
      ? 'Je bent uitgelogd. Log opnieuw in om te synchroniseren.'
      : 'Nog niet opgeslagen op de server. De app werkt gewoon door.'
    sync.zet({ stand: 'fout', melding: bericht })
  }
}

/** Begin met bijhouden. Stopt de vorige, zodat er nooit twee lopen. */
export function startSynchroniseren(versie: number): void {
  stopSynchroniseren()
  useSync.getState().zet({ stand: 'gelijk', versie, melding: null })

  stopVolgen = useAppStore.subscribe(() => {
    const stand = useSync.getState().stand
    if (stand === 'uit' || stand === 'conflict') return
    useSync.getState().zet({ stand: 'wachtend' })
    if (timer) clearTimeout(timer)
    // Even wachten: tijdens het loggen van een sessie verandert er van alles,
    // en elk tussenstadium naar de server sturen is zonde van de verbinding.
    timer = setTimeout(() => void stuurOp(), WACHTTIJD_MS)
  })
}

export function stopSynchroniseren(): void {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  if (stopVolgen) {
    stopVolgen()
    stopVolgen = null
  }
  useSync.getState().zet({ stand: 'uit', versie: 0, serverStaat: null, melding: null })
}

/** Meteen opsturen, bijvoorbeeld voordat je uitlogt. */
export async function nuOpsturen(): Promise<void> {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  await stuurOp()
}
