/**
 * Spraakherkenning van de browser, zonder server.
 *
 * Chrome en Android kunnen dit zelf. Safari op iOS kan het beperkt en oudere
 * browsers helemaal niet, dus `beschikbaar` bepaalt of de knop er überhaupt
 * komt. Een knop die niets doet is erger dan geen knop.
 *
 * Er gaat geen audio naar onze server en er is geen sleutel voor nodig. Dat
 * scheelt geld per set en het werkt in een zaal waar het bereik wegvalt.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

/* De Web Speech API staat niet in de standaard TypeScript-typen. */
interface HerkenningResultaat {
  0: { transcript: string }
  isFinal: boolean
  length: number
}
interface HerkenningEvent {
  resultIndex: number
  results: { length: number; [i: number]: HerkenningResultaat }
}
interface Herkenning {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: HerkenningEvent) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}
type HerkenningKlasse = new () => Herkenning

function klasse(): HerkenningKlasse | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: HerkenningKlasse
    webkitSpeechRecognition?: HerkenningKlasse
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export const spraakBeschikbaar = (): boolean => klasse() !== null

export interface SpeechState {
  beschikbaar: boolean
  luistert: boolean
  tekst: string
  fout: string | null
  start: () => void
  stop: () => void
}

const FOUTEN: Record<string, string> = {
  'not-allowed': 'Geen toegang tot de microfoon. Sta dat toe in je browser.',
  'service-not-allowed': 'Geen toegang tot de microfoon. Sta dat toe in je browser.',
  'no-speech': 'Niets gehoord.',
  'audio-capture': 'Geen microfoon gevonden.',
  network: 'Spraakherkenning heeft even verbinding nodig.',
}

export function useSpeech(onZin: (tekst: string) => void): SpeechState {
  const [luistert, setLuistert] = useState(false)
  const [tekst, setTekst] = useState('')
  const [fout, setFout] = useState<string | null>(null)
  const ref = useRef<Herkenning | null>(null)

  // In een ref, zodat het opnieuw opbouwen van de herkenner niet nodig is als
  // de component hertekent. Anders breekt hij middenin je zin af.
  const onZinRef = useRef(onZin)
  useEffect(() => {
    onZinRef.current = onZin
  }, [onZin])

  useEffect(() => {
    return () => ref.current?.abort()
  }, [])

  const start = useCallback(() => {
    const K = klasse()
    if (!K) return
    ref.current?.abort()
    setTekst('')
    setFout(null)

    const h = new K()
    h.lang = 'nl-NL'
    h.continuous = false
    h.interimResults = true
    h.maxAlternatives = 1

    h.onresult = (e) => {
      let zin = ''
      for (let i = 0; i < e.results.length; i++) zin += e.results[i][0].transcript
      setTekst(zin)
      const laatste = e.results[e.results.length - 1]
      if (laatste?.isFinal) onZinRef.current(zin)
    }
    h.onerror = (e) => {
      setFout(FOUTEN[e.error] ?? 'Spraakherkenning werkt hier niet.')
      setLuistert(false)
    }
    h.onend = () => setLuistert(false)

    ref.current = h
    try {
      h.start()
      setLuistert(true)
    } catch {
      setFout('Spraakherkenning kon niet starten.')
    }
  }, [])

  const stop = useCallback(() => {
    ref.current?.stop()
    setLuistert(false)
  }, [])

  return { beschikbaar: klasse() !== null, luistert, tekst, fout, start, stop }
}
