/**
 * Metingen (secties 6.1 en 6.2). Baselines zijn referentie voor programmaontwerp,
 * geen doel om te verslaan. Maandmetingen gaan steeds onder dezelfde condities.
 */

import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { Ruler, Trash2, TrendingUp } from 'lucide-react'
import { Badge, Button, Card, EmptyState, Field, NumberInput, SectionTitle, SourceNote, TextArea } from '@/ui/primitives'
import { LoadChart, Sparkline } from '@/ui/charts'
import { useAppStore } from '@/store/useAppStore'
import { BASELINE_TESTS, emptyMeasurement } from '@/domain/defaults'
import { historyFor, round1, todayIso } from '@/domain/analytics'
import { heaviestLoad, workingSets } from '@/domain/rule'
import { getLadder } from '@/domain/exercises'
import type { Measurement } from '@/domain/types'
import { MovementScreenCard } from './MovementScreenCard'

export default function MeasurementsScreen() {
  const measurements = useAppStore((s) => s.measurements)
  const addMeasurement = useAppStore((s) => s.addMeasurement)
  const removeMeasurement = useAppStore((s) => s.removeMeasurement)
  const sessions = useAppStore((s) => s.sessions)

  const [draft, setDraft] = useState<Measurement>(() => emptyMeasurement(measurements.length === 0))
  const sorted = useMemo(() => measurements.slice().sort((a, b) => a.date.localeCompare(b.date)), [measurements])
  const latest = sorted[sorted.length - 1]
  const previous = sorted[sorted.length - 2]

  const loadSeries = useLoadSeries(sessions)

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3 pb-1">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight">Metingen</h1>
          <p className="mt-0.5 text-[13.5px] text-ink-3">
            Submaximaal en herhaalbaar. Geen 1RM, geen maximale inspanning.
          </p>
        </div>
        {measurements.length === 0 && <Badge tone="brand">Nulmeting</Badge>}
      </header>

      {sorted.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <TrendStat label="Push-ups" unit="reps" current={latest?.pushUpMax} before={previous?.pushUpMax} series={sorted.map((m) => m.pushUpMax)} higherIsBetter />
          <TrendStat label="Pull-ups" unit="reps" current={latest?.pullUpMax} before={previous?.pullUpMax} series={sorted.map((m) => m.pullUpMax)} higherIsBetter delay={0.05} />
          <TrendStat label="Gewicht" unit="kg" current={latest?.weightKg} before={previous?.weightKg} series={sorted.map((m) => m.weightKg)} delay={0.1} />
          <TrendStat label="Taille" unit="cm" current={latest?.waistCm} before={previous?.waistCm} series={sorted.map((m) => m.waistCm)} delay={0.15} />
        </div>
      )}

      {loadSeries.series.length > 0 && (
        <Card delay={0.18}>
          <SectionTitle title="Belastingverloop" subtitle="Zwaarste werkset per sessie, voor je drie grootste oefeningen." right={<TrendingUp className="size-4 text-ink-3" />} />
          <LoadChart data={loadSeries.data} series={loadSeries.series} />
        </Card>
      )}

      <MovementScreenCard delay={0.2} />

      <Card delay={0.22}>
        <SectionTitle
          title={measurements.length === 0 ? 'Nulmeting vastleggen' : 'Nieuwe maandmeting'}
          subtitle={
            measurements.length === 0
              ? 'Deze waarden dienen als referentie voor je programma, niet als doel om te verslaan.'
              : 'Zelfde dag van de maand, zelfde omstandigheden, zelfde moment van de dag.'
          }
          right={<Ruler className="size-4 text-ink-3" />}
        />

        <div className="space-y-5">
          {(['prestatie', 'structuur', 'vitaal'] as const).map((category) => (
            <div key={category}>
              <div className="mb-2 text-[11.5px] font-semibold uppercase tracking-wide text-ink-3">
                {category === 'prestatie' ? 'Prestatie' : category === 'structuur' ? 'Structuur' : 'Vitaal'}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {BASELINE_TESTS.filter((t) => t.category === category).map((test) => (
                  <Field key={String(test.key)} label={test.label} hint={test.instruction}>
                    <NumberInput
                      value={draft[test.key] as number | null}
                      onChange={(value) => setDraft((d) => ({ ...d, [test.key]: value }))}
                      suffix={test.unit}
                    />
                  </Field>
                ))}
              </div>
            </div>
          ))}

          <Field label="Notitie">
            <TextArea value={draft.note ?? ''} onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))} placeholder="Omstandigheden, hoe het voelde, bijzonderheden" />
          </Field>
        </div>

        <Button
          variant="primary"
          className="mt-4 w-full"
          onClick={() => {
            addMeasurement({ ...draft, date: todayIso() })
            setDraft(emptyMeasurement(false))
          }}
        >
          Meting opslaan
        </Button>
        <SourceNote>Secties 6.1 en 6.2.</SourceNote>
      </Card>

      <Card delay={0.26}>
        <SectionTitle title="Geschiedenis" subtitle="Alles wat je hebt vastgelegd, nieuwste eerst." />
        {sorted.length === 0 ? (
          <EmptyState title="Nog geen metingen" body="Leg eerst een nulmeting vast. Zonder referentie is elke latere meting een los getal." />
        ) : (
          <div className="space-y-2">
            {sorted
              .slice()
              .reverse()
              .map((measurement) => (
                <motion.div key={measurement.id} layout className="card-quiet flex items-start gap-3 px-3.5 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="num text-[13px] font-semibold">{measurement.date}</span>
                      {measurement.isBaseline && <Badge tone="brand">Nulmeting</Badge>}
                    </div>
                    <div className="num mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[12.5px] text-ink-2">
                      {measurement.weightKg != null && <span>{measurement.weightKg} kg</span>}
                      {measurement.waistCm != null && <span>taille {measurement.waistCm} cm</span>}
                      {measurement.pushUpMax != null && <span>{measurement.pushUpMax} push-ups</span>}
                      {measurement.pullUpMax != null && <span>{measurement.pullUpMax} pull-ups</span>}
                      {measurement.restingHr != null && <span>rust-HR {measurement.restingHr}</span>}
                    </div>
                    {measurement.note && <p className="mt-1 text-[12.5px] italic text-ink-3">{measurement.note}</p>}
                  </div>
                  <button
                    onClick={() => removeMeasurement(measurement.id)}
                    aria-label="Meting verwijderen"
                    className="grid size-10 shrink-0 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </motion.div>
              ))}
          </div>
        )}
      </Card>
    </div>
  )
}

function TrendStat({
  label,
  unit,
  current,
  before,
  series,
  higherIsBetter,
  delay = 0,
}: {
  label: string
  unit: string
  current: number | null | undefined
  before: number | null | undefined
  series: Array<number | null>
  higherIsBetter?: boolean
  delay?: number
}) {
  const values = series.filter((v): v is number => v !== null)
  const delta = current != null && before != null ? round1(current - before) : null
  const tone =
    delta === null || delta === 0
      ? 'neutral'
      : higherIsBetter
        ? delta > 0
          ? 'good'
          : 'warn'
        : 'neutral'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: [0.22, 1, 0.36, 1] }}
      className="card-quiet px-4 py-3.5"
    >
      <div className="text-[11.5px] font-medium uppercase tracking-wide text-ink-3">{label}</div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="num text-[24px] font-bold leading-none">{current ?? '—'}</span>
        <span className="text-[12px] text-ink-3">{unit}</span>
        {delta !== null && delta !== 0 && (
          <span
            className="num ml-auto text-[12.5px] font-semibold"
            style={{ color: tone === 'good' ? 'var(--status-good)' : tone === 'warn' ? 'var(--status-warn)' : 'var(--text-muted)' }}
          >
            {delta > 0 ? '+' : ''}
            {delta}
          </span>
        )}
      </div>
      <div className="mt-2">
        <Sparkline values={values} />
      </div>
    </motion.div>
  )
}

/** Belastingverloop van de drie meest gelogde oefeningen. */
function useLoadSeries(sessions: ReturnType<typeof useAppStore.getState>['sessions']) {
  return useMemo(() => {
    const counts = new Map<string, number>()
    for (const session of sessions) {
      for (const exercise of session.exercises) {
        counts.set(exercise.ladderId, (counts.get(exercise.ladderId) ?? 0) + 1)
      }
    }
    const top = [...counts.entries()]
      .filter(([id]) => {
        const history = historyFor(sessions, id)
        return history.some(({ log }) => heaviestLoad(log) > 0)
      })
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id]) => id)

    if (top.length === 0) return { data: [], series: [] }

    const names = top.map((id) => getLadder(id).name)
    const dates = [...new Set(sessions.map((s) => s.date))].sort()
    const data = dates.map((date) => {
      const row: Record<string, string | number | null> = { date }
      top.forEach((id, i) => {
        const session = sessions.find((s) => s.date === date)
        const log = session?.exercises.find((e) => e.ladderId === id)
        row[names[i]] = log && workingSets(log).length > 0 ? heaviestLoad(log) : null
      })
      return row
    })

    return { data, series: names }
  }, [sessions])
}
