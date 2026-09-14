/**
 * Een klacht melden in je eigen woorden, tijdens het trainen.
 *
 * Het taalmodel doet hier één ding: begrijpen welk lichaamsgebied je bedoelt en
 * welke oefeningen dat belasten. Wat er met je programma gebeurt, rekent de app
 * daarna zelf uit met dezelfde regels als altijd, en het resultaat is een
 * voorstel dat je nog moet accepteren.
 *
 * Werkt de duiding niet, bijvoorbeeld zonder sleutel of zonder bereik, dan blijft
 * de gewone weg gewoon open: pijn invullen bij de set. Een klacht mag nooit
 * afhangen van of een model bereikbaar is.
 */

import { useState } from 'react'
import { motion } from 'motion/react'
import { MessageCircleWarning, Send } from 'lucide-react'
import { Button, Card, SectionTitle, SourceNote } from '@/ui/primitives'
import { useAppStore } from '@/store/useAppStore'
import { useSafety } from '@/store/selectors'
import { outcomeForComplaint } from '@/domain/complaint'
import { validateAdjustment } from '@/domain/adapt'
import { useValidationContext } from '@/store/selectors'
import type { Prescription } from '@/domain/prescribe'
import { getLadder } from '@/domain/exercises'
import { CoachProposal } from '@/features/coach/CoachChat'
import type { PlanAdjustment } from '@/domain/types'

type Stand =
  | { fase: 'leeg' }
  | { fase: 'bezig' }
  | { fase: 'klaar'; uitleg: string; voorstellen: PlanAdjustment[] }
  | { fase: 'fout'; bericht: string }

export function ComplaintCard({ prescriptions, delay = 0 }: { prescriptions: Prescription[]; delay?: number }) {
  const [tekst, setTekst] = useState('')
  const [stand, setStand] = useState<Stand>({ fase: 'leeg' })
  const safety = useSafety()
  const ctx = useValidationContext()
  const propose = useAppStore((s) => s.proposeAdjustment)

  if (prescriptions.length === 0) return null

  const versturen = async () => {
    const schoon = tekst.trim()
    if (schoon.length < 3) return
    setStand({ fase: 'bezig' })

    const ladders = prescriptions.map((p) => {
      const ladder = getLadder(p.ladderId)
      return { id: ladder.id, name: ladder.name, pattern: ladder.pattern }
    })

    try {
      const res = await fetch('/api/klacht', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: schoon, ladders }),
      })
      const body = await res.json()
      if (!res.ok) {
        setStand({ fase: 'fout', bericht: body?.message ?? 'Het duiden lukte niet.' })
        return
      }

      const stepByLadder: Record<string, string | undefined> = {}
      for (const p of prescriptions) stepByLadder[p.ladderId] = p.stepId

      const uitkomst = outcomeForComplaint({
        reading: body,
        safety,
        stepByLadder,
        today: new Date().toISOString().slice(0, 10),
      })

      // Elk voorstel gaat langs dezelfde poort als alle andere. Wat daar
      // sneuvelt, toon je niet: anders accepteert iemand iets dat de
      // veiligheidsregels net hebben afgekeurd.
      const toegestaan = uitkomst.proposals.filter((v) => validateAdjustment(v, ctx).allowed)

      setStand({ fase: 'klaar', uitleg: uitkomst.uitleg, voorstellen: toegestaan })
      setTekst('')
    } catch {
      setStand({
        fase: 'fout',
        bericht: 'Geen verbinding. Vul de pijn bij je set in; daar werkt alles zonder netwerk.',
      })
    }
  }

  return (
    <Card delay={delay}>
      <SectionTitle
        title="Iets voelt niet goed"
        subtitle="Zeg het in je eigen woorden. De app bepaalt zelf wat dat betekent voor je programma."
        right={<MessageCircleWarning className="size-4 text-ink-3" />}
      />

      <textarea
        value={tekst}
        onChange={(e) => setTekst(e.target.value)}
        rows={2}
        placeholder="Bijvoorbeeld: mijn rechterknie voelt raar vanaf rep 6 bij squats"
        className="w-full resize-none rounded-xl border px-3.5 py-2.5 text-[13.5px] outline-none transition-colors focus:border-line-strong"
        style={{ background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' }}
      />

      <div className="mt-2.5 flex items-center justify-between gap-3">
        <span className="text-[11.5px] text-ink-3">
          Noem de pijn van 0 tot 10 als je die weet. Zonder cijfer verandert er niets.
        </span>
        <Button
          size="sm"
          onClick={versturen}
          disabled={stand.fase === 'bezig' || tekst.trim().length < 3}
          icon={<Send className="size-4" />}
        >
          {stand.fase === 'bezig' ? 'Bezig' : 'Melden'}
        </Button>
      </div>

      {stand.fase === 'klaar' && (
        <motion.p
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 text-[13px] leading-snug text-ink-2"
          role="status"
        >
          {stand.uitleg}
        </motion.p>
      )}

      {stand.fase === 'klaar' && stand.voorstellen.length > 0 && (
        <div className="mt-3 space-y-2.5">
          {stand.voorstellen.map((voorstel) => (
            <CoachProposal
              key={voorstel.id}
              proposal={voorstel}
              check={validateAdjustment(voorstel, ctx)}
              onAccept={() => {
                const oordeel = validateAdjustment(voorstel, ctx)
                if (!oordeel.allowed) return
                propose({ ...(oordeel.altered ?? voorstel), accepted: true })
                setStand((s) =>
                  s.fase === 'klaar'
                    ? { ...s, voorstellen: s.voorstellen.filter((v) => v.id !== voorstel.id) }
                    : s,
                )
              }}
            />
          ))}
        </div>
      )}

      {stand.fase === 'fout' && (
        <p className="mt-3 text-[13px] leading-snug" style={{ color: 'var(--status-warn)' }} role="status">
          {stand.bericht}
        </p>
      )}

      <SourceNote>
        Het model duidt alleen de klacht. De ingreep volgt uit sectie 4.3 en wacht op je akkoord.
      </SourceNote>
    </Card>
  )
}
