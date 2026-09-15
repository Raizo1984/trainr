/**
 * Het geschreven weekrapport.
 *
 * De cijfers staan elders al in de app. Wat hier bij komt is het verband
 * ertussen, want "je opkomst zakt terwijl je volume stijgt" is iets wat een
 * tabel niet zegt en je wel moet weten.
 *
 * Elk getal in de tekst wordt teruggezocht in je eigen data. Staat het er niet
 * bij, dan komt het rapport niet in beeld. Liever geen rapport dan een rapport
 * met een cijfer dat nergens uit volgt: dat laatste is zonder de bron ernaast
 * niet van de waarheid te onderscheiden.
 */

import { useState } from 'react'
import { motion } from 'motion/react'
import { FileText, RefreshCw } from 'lucide-react'
import { Button, Card, Note, SectionTitle } from '@/ui/primitives'
import { useAppStore } from '@/store/useAppStore'
import { useCurrentPhase, useNutritionPlan, usePhaseWeek } from '@/store/selectors'
import { buildCoachContext } from '@/domain/coachContext'
import { controleerRapport } from '@/domain/report'
import { fetchWeekReport } from './coachClient'

type Stand =
  | { fase: 'leeg' }
  | { fase: 'bezig' }
  | { fase: 'klaar'; tekst: string }
  | { fase: 'fout'; bericht: string }

export function WeekReportCard({ delay = 0 }: { delay?: number }) {
  const state = useAppStore()
  const phase = useCurrentPhase()
  const week = usePhaseWeek()
  const plan = useNutritionPlan()
  const [stand, setStand] = useState<Stand>({ fase: 'leeg' })

  const maak = async () => {
    setStand({ fase: 'bezig' })
    const context = buildCoachContext(state, phase, week, plan.proteinMinG, plan.minMealsPerDay, plan.prohibited)
    try {
      const tekst = await fetchWeekReport(context)
      const controle = controleerRapport(tekst, context)
      if (!controle.ok) {
        console.warn('Weekrapport geweigerd, ongedekte getallen:', controle.ongedekt)
        setStand({
          fase: 'fout',
          bericht: `Het rapport noemde ${controle.ongedekt.length === 1 ? 'een getal' : 'getallen'} die niet in je data staan, dus het is weggegooid. Je cijfers hieronder kloppen gewoon. Probeer het opnieuw.`,
        })
        return
      }
      setStand({ fase: 'klaar', tekst })
    } catch (error) {
      setStand({ fase: 'fout', bericht: error instanceof Error ? error.message : 'Het lukte niet.' })
    }
  }

  return (
    <Card delay={delay}>
      <SectionTitle
        title="Weekrapport"
        subtitle="Wat de cijfers samen zeggen, in een paar zinnen."
        right={<FileText className="size-4 text-ink-3" />}
      />

      {stand.fase === 'klaar' ? (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          {stand.tekst
            .split('\n')
            .filter((r) => r.trim())
            .map((regel, i) => (
              <p key={i} className={cxMt(i)}>
                {regel}
              </p>
            ))}
          <Button
            size="sm"
            variant="ghost"
            onClick={maak}
            className="mt-3"
            icon={<RefreshCw className="size-4" />}
          >
            Opnieuw
          </Button>
        </motion.div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" onClick={maak} disabled={stand.fase === 'bezig'} icon={<FileText className="size-4" />}>
            {stand.fase === 'bezig' ? 'Bezig' : 'Maak het rapport'}
          </Button>
          {stand.fase === 'fout' && (
            <p className="basis-full text-[12.5px] leading-snug" style={{ color: 'var(--status-warn)' }} role="status">
              {stand.bericht}
            </p>
          )}
        </div>
      )}

      <Note>
        De cijfers komen uit je eigen log. Getallen in de tekst die daar niet in staan, worden geweigerd.
      </Note>
    </Card>
  )
}

function cxMt(i: number): string {
  return i === 0 ? 'text-[13.5px] leading-relaxed text-ink-2' : 'mt-2 text-[13.5px] leading-relaxed text-ink-2'
}
