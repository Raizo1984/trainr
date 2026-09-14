/**
 * Coach: alle signaleringen op één plek, plus het maandrapport.
 * Toon is direct en concreet; elk bericht eindigt in een handeling.
 */

import { AnimatePresence } from 'motion/react'
import { CalendarRange, CircleCheck, Sparkles } from 'lucide-react'
import { Button, Card, EmptyState, SectionTitle, SourceNote } from '@/ui/primitives'
import { AlertCard } from './AlertCard'
import { BlockReviewCard } from './BlockReviewCard'
import { CoachChat } from './CoachChat'
import { ProposalsCard } from '@/features/adapt/AdjustmentCards'
import { useAlerts, useMonthlyRecap, useNutritionAlerts, useWeeklyCheckIn } from '@/store/selectors'
import { useAppStore } from '@/store/useAppStore'

export default function CoachScreen() {
  const alerts = useAlerts()
  const nutritionAlerts = useNutritionAlerts()
  const checkIn = useWeeklyCheckIn()
  const recap = useMonthlyRecap()
  const acknowledged = useAppStore((s) => s.acknowledgedAlerts)
  const reset = useAppStore((s) => s.acknowledgeAlert)

  return (
    <div className="space-y-4">
      <header className="pb-1">
        <h1 className="text-[26px] font-bold tracking-tight">Coach</h1>
        <p className="mt-0.5 text-[13.5px] text-ink-3">
          Wat er opvalt in je data, en wat je eraan doet. Geen aanmoediging zonder aanleiding.
        </p>
      </header>

      <CoachChat />

      <ProposalsCard delay={0.06} />

      <BlockReviewCard delay={0.08} />

      {alerts.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CircleCheck className="size-8" style={{ color: 'var(--status-good)' }} />}
            title="Geen openstaande signalen"
            body="Pijn, techniek, volume en opkomst zitten binnen de marges. Dat is geen toeval als je de regel volgt."
            action={
              acknowledged.length > 0 ? (
                <Button size="sm" onClick={() => acknowledged.forEach((id) => reset(id))}>
                  {acknowledged.length} gesloten melding(en)
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {alerts.map((alert, i) => (
              <AlertCard key={alert.id} alert={alert} delay={i * 0.05} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {nutritionAlerts.length > 0 && (
        <Card delay={0.1}>
          <SectionTitle title="Voeding" subtitle="Ondergrenzen bewaken, niet beperken." />
          <div className="space-y-2.5">
            {nutritionAlerts.map((alert, i) => (
              <div
                key={i}
                className="rounded-xl border px-4 py-3"
                style={{
                  borderColor: alert.level >= 3 ? 'color-mix(in oklab, var(--status-serious) 35%, transparent)' : 'var(--border-subtle)',
                  background: alert.level >= 3 ? 'var(--status-serious-soft)' : 'var(--surface-2)',
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="num text-[11px] font-bold text-ink-3">Niveau {alert.level}</span>
                  <span className="text-[13.5px] font-semibold">{alert.title}</span>
                </div>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{alert.message}</p>
                <p className="mt-1.5 text-[13px] font-medium">{alert.action}</p>
              </div>
            ))}
          </div>
          <SourceNote>Secties 5.2 en 9.3.</SourceNote>
        </Card>
      )}

      {checkIn && (
        <Card delay={0.14}>
          <SectionTitle title="Wekelijkse check-in" subtitle={checkIn.headline} right={<Sparkles className="size-4 text-ink-3" />} />
          <ul className="space-y-1.5">
            {checkIn.observations.map((observation, i) => (
              <li key={i} className="flex gap-2 text-[13.5px] text-ink-2">
                <span className="mt-[7px] size-1 shrink-0 rounded-full" style={{ background: 'var(--text-muted)' }} />
                {observation}
              </li>
            ))}
          </ul>
          <div className="mt-3.5 rounded-xl px-3.5 py-3" style={{ background: 'var(--brand-soft)' }}>
            <p className="text-[13.5px] leading-relaxed text-ink">{checkIn.tip}</p>
          </div>
          <p className="mt-3 text-[13px] italic text-ink-3">{checkIn.question}</p>
        </Card>
      )}

      {recap && (
        <Card delay={0.18}>
          <SectionTitle title="Maandrapport" subtitle={recap.period} right={<CalendarRange className="size-4 text-ink-3" />} />
          <div className="grid gap-3 sm:grid-cols-3">
            <RecapBlock title="Prestatie" items={recap.performance} />
            <RecapBlock title="Structuur" items={recap.structure} />
            <RecapBlock title="Subjectief" items={recap.subjective} />
          </div>

          <div className="mt-4 space-y-3">
            <div className="rounded-xl px-4 py-3" style={{ background: 'var(--surface-3)' }}>
              <div className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-3">Interpretatie</div>
              <p className="mt-1 text-[13.5px] leading-relaxed">{recap.interpretation}</p>
            </div>
            <div className="rounded-xl px-4 py-3" style={{ background: 'var(--brand-soft)' }}>
              <div className="text-[11.5px] font-semibold uppercase tracking-wide" style={{ color: 'var(--brand-2)' }}>
                Focus volgende maand
              </div>
              <p className="mt-1 text-[13.5px] leading-relaxed text-ink">{recap.focus}</p>
            </div>
            <div>
              <div className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-ink-3">Wat goed ging</div>
              <ul className="space-y-1.5">
                {recap.wins.map((win, i) => (
                  <li key={i} className="flex gap-2.5 text-[13.5px] text-ink-2">
                    <CircleCheck className="mt-0.5 size-4 shrink-0" style={{ color: 'var(--status-good)' }} />
                    {win}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <SourceNote>Secties 6.2 en 7.1, coachingmoment 8.</SourceNote>
        </Card>
      )}
    </div>
  )
}

function RecapBlock({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <div className="card-quiet p-3.5">
      <div className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-3">{title}</div>
      <ul className="mt-1.5 space-y-1">
        {items.map((item, i) => (
          <li key={i} className="text-[13px] leading-snug text-ink-2">
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}
