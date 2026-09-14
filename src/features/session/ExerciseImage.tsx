/**
 * Beeld bij een oefening.
 *
 * Laadt pas wanneer je de oefening opent en in beeld scrolt, want honderd
 * afbeeldingen vooraf ophalen maakt precies de winst ongedaan die het eerste
 * scherm licht houdt.
 *
 * Is er geen bevestigd beeld, dan staat er niets. De aanwijzing in tekst blijft
 * dan het enige, en dat is beter dan een plaatje van een andere oefening.
 */

import { useState } from 'react'
import { bronvermelding, mediaVoorStap } from '@/domain/exerciseMedia'

export function ExerciseImage({ stepId }: { stepId: string }) {
  const media = mediaVoorStap(stepId)
  const [mislukt, setMislukt] = useState(false)

  if (!media || mislukt) return null

  return (
    <figure className="mt-3 overflow-hidden rounded-xl border" style={{ borderColor: 'var(--border-subtle)' }}>
      <img
        src={`/exercises/${media.bestand}`}
        alt={`Uitvoering van ${media.bron}`}
        loading="lazy"
        decoding="async"
        className="block max-h-56 w-full bg-white object-contain"
        onError={() => setMislukt(true)}
      />
      {/*
        Bronvermelding is bij CC-BY-SA geen nette geste maar een voorwaarde.
        Klein weergegeven, maar altijd zichtbaar bij het beeld zelf.
      */}
      <figcaption className="px-3 py-1.5 text-[11px] text-ink-3" style={{ background: 'var(--surface-2)' }}>
        {bronvermelding(media)}
      </figcaption>
    </figure>
  )
}
