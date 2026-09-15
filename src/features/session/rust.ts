/**
 * Rusttijd, scherm wakker houden en trillen.
 *
 * Drie kleine dingen die samen het verschil maken tussen een app die je in de
 * zaal gebruikt en een app die je thuis invult.
 *
 * De rusttijd loopt op een eindtijdstip en niet op een aftellende teller. Zet
 * je je telefoon weg, dan bevriezen tellers in de achtergrond, en dan sta je
 * na twee minuten nog steeds op 1:47 te kijken. Een eindtijdstip klopt altijd,
 * ook als de telefoon ondertussen sliep.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

/** Rust per patroon. Zware samengestelde oefeningen vragen meer. */
export function rusttijdSeconden(pattern: string, fixed: boolean): number {
  if (fixed) return 45
  if (pattern === 'squat' || pattern === 'hinge') return 180
  if (pattern === 'verticale-push' || pattern === 'horizontale-push') return 150
  if (pattern === 'verticale-pull' || pattern === 'horizontale-pull') return 150
  if (pattern === 'isolatie') return 90
  if (pattern === 'conditie' || pattern === 'skill') return 60
  return 120
}

export function formatteerTijd(seconden: number): string {
  const s = Math.max(0, Math.round(seconden))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export interface Rust {
  /** Loopt er een rustperiode? */
  actief: boolean
  resterend: number
  totaal: number
  start: (seconden: number) => void
  stop: () => void
  verleng: (seconden: number) => void
}

export function useRust(): Rust {
  const [eind, setEind] = useState<number | null>(null)
  const [totaal, setTotaal] = useState(0)
  const [resterend, setResterend] = useState(0)

  useEffect(() => {
    if (eind === null) return
    const tik = () => {
      const over = Math.max(0, (eind - Date.now()) / 1000)
      setResterend(over)
      if (over <= 0) setEind(null)
    }
    tik()
    const id = setInterval(tik, 250)
    return () => clearInterval(id)
  }, [eind])

  const start = useCallback((seconden: number) => {
    setTotaal(seconden)
    setEind(Date.now() + seconden * 1000)
  }, [])

  const stop = useCallback(() => {
    setEind(null)
    setResterend(0)
  }, [])

  const verleng = useCallback((seconden: number) => {
    setEind((huidig) => (huidig === null ? Date.now() + seconden * 1000 : huidig + seconden * 1000))
    setTotaal((t) => t + seconden)
  }, [])

  return { actief: eind !== null, resterend, totaal, start, stop, verleng }
}

/**
 * Het scherm wakker houden zolang je traint.
 *
 * Zonder dit valt je telefoon tussen twee sets in slaap en moet je hem elke
 * keer ontgrendelen met handen die dat niet fijn vinden. De browser trekt de
 * toestemming in zodra je van tabblad wisselt, dus die vragen we opnieuw aan
 * zodra je terugkomt.
 */
export function useSchermWakker(aan: boolean): void {
  const slot = useRef<{ release: () => Promise<void> } | null>(null)

  useEffect(() => {
    if (!aan) return
    let gestopt = false

    const vraagAan = async () => {
      const nav = navigator as Navigator & {
        wakeLock?: { request: (soort: 'screen') => Promise<{ release: () => Promise<void> }> }
      }
      if (!nav.wakeLock) return
      try {
        const nieuw = await nav.wakeLock.request('screen')
        if (gestopt) {
          void nieuw.release()
          return
        }
        slot.current = nieuw
      } catch {
        // Niet toegestaan of niet ondersteund. Dan valt het scherm gewoon in
        // slaap, wat vervelend is maar niets kapotmaakt.
      }
    }

    const opZichtbaar = () => {
      if (document.visibilityState === 'visible') void vraagAan()
    }

    void vraagAan()
    document.addEventListener('visibilitychange', opZichtbaar)

    return () => {
      gestopt = true
      document.removeEventListener('visibilitychange', opZichtbaar)
      void slot.current?.release().catch(() => {})
      slot.current = null
    }
  }, [aan])
}

/** Korte tril als bevestiging. Doet niets waar het niet kan. */
export function tril(ms = 25): void {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(ms)
  } catch {
    // Sommige browsers gooien hier in plaats van het te negeren.
  }
}
