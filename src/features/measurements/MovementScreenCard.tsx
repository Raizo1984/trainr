/**
 * Bewegingskwaliteit beoordelen (secties 6.1 en 7.2).
 *
 * De app analyseert geen video. Ze geeft je de checklist die een coach ook
 * zou nalopen, en vertaalt het resultaat naar beperkingen in je programma.
 */

import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, ChevronDown, CircleAlert, CircleDashed, Video } from 'lucide-react'
import { Badge, Button, Card, SectionTitle, SourceNote, TextArea, cx } from '@/ui/primitives'
import { useAppStore } from '@/store/useAppStore'
import { MOVEMENT_SCREENS, gradeScreen, summarise } from '@/domain/movement'
import { todayIso } from '@/domain/analytics'
import type { Grade } from '@/domain/types'

const GRADE_TONE: Record<Grade, 'good' | 'warn' | 'serious'> = {
  groen: 'good',
  geel: 'warn',
  rood: 'serious',
}

const GRADE_COLOR: Record<Grade, string> = {
  groen: 'var(--status-good)',
  geel: 'var(--status-warn)',
  rood: 'var(--status-serious)',
}

const GRADE_LABEL: Record<Grade, string> = {
  groen: 'Goed',
  geel: 'Aandacht',
  rood: 'Probleem',
}

export function MovementScreenCard({ delay = 0 }: { delay?: number }) {
  const stored = useAppStore((s) => s.movementAssessments)
  const save = useAppStore((s) => s.saveMovementAssessment)
  const latest = stored[stored.length - 1] ?? null

  const [grades, setGrades] = useState<Record<string, Grade>>(latest?.grades ?? {})
  const [note, setNote] = useState(latest?.note ?? '')
  const [open, setOpen] = useState<string | null>(MOVEMENT_SCREENS[0].id)

  const summary = useMemo(() => summarise({ id: 'draft', date: todayIso(), grades }), [grades])
  const answered = summary.gradedItems
  const totalItems = MOVEMENT_SCREENS.reduce((t, s) => t + s.items.length, 0)

  return (
    <Card delay={delay}>
      <SectionTitle
        title="Bewegingskwaliteit"
        subtitle="Film jezelf en loop de punten na. Dit bepaalt welk bereik je programma voorschrijft."
        right={<Video className="size-4 text-ink-3" />}
      />

      <div
        className="mb-4 rounded-xl px-4 py-3"
        style={{
          background:
            summary.worst === 'rood'
              ? 'var(--status-serious-soft)'
              : summary.worst === 'geel' && answered > 0
                ? 'var(--status-warn-soft)'
                : 'var(--surface-3)',
        }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="num text-[12px] text-ink-3">
            {answered} van {totalItems} punten beoordeeld
          </span>
          {answered > 0 && <Badge tone={GRADE_TONE[summary.worst]}>{GRADE_LABEL[summary.worst]}</Badge>}
        </div>
        <p className="mt-1 text-[13.5px] leading-relaxed">{summary.verdict}</p>
      </div>

      {summary.limits.length > 0 && (
        <div className="mb-4">
          <div className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-ink-3">
            Wat dit betekent voor je programma
          </div>
          <ul className="space-y-1">
            {summary.limits.map((limit) => (
              <li key={limit} className="flex gap-2.5 text-[13px] leading-relaxed text-ink-2">
                <CircleAlert className="mt-0.5 size-4 shrink-0" style={{ color: 'var(--status-serious)' }} />
                {limit}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-2">
        {MOVEMENT_SCREENS.map((screen) => {
          const result = gradeScreen(screen, grades)
          const expanded = open === screen.id
          const scored = screen.items.filter((i) => grades[i.id]).length

          return (
            <motion.div key={screen.id} layout className="card-quiet overflow-hidden">
              <button
                onClick={() => setOpen(expanded ? null : screen.id)}
                className="flex w-full items-start gap-3 px-3.5 py-3 text-left"
              >
                {scored === 0 ? (
                  <CircleDashed className="mt-0.5 size-4 shrink-0 text-ink-3" />
                ) : result.grade === 'groen' ? (
                  <Check className="mt-0.5 size-4 shrink-0" strokeWidth={3} style={{ color: GRADE_COLOR.groen }} />
                ) : (
                  <CircleAlert className="mt-0.5 size-4 shrink-0" style={{ color: GRADE_COLOR[result.grade] }} />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-semibold">{screen.name}</div>
                  <div className="num text-[12px] text-ink-3">
                    {scored} van {screen.items.length} beoordeeld
                  </div>
                </div>
                <ChevronDown className={cx('mt-0.5 size-4 shrink-0 text-ink-3 transition-transform', expanded && 'rotate-180')} />
              </button>

              <AnimatePresence initial={false}>
                {expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <div className="space-y-3 px-3.5 pb-3.5">
                      <p className="rounded-lg px-3 py-2.5 text-[12.5px] leading-relaxed text-ink-2" style={{ background: 'var(--surface-1)' }}>
                        <span className="font-semibold text-ink">Opname:</span> {screen.setup}
                      </p>

                      {screen.items.map((item) => {
                        const value = grades[item.id]
                        return (
                          <div key={item.id}>
                            <p className="mb-1.5 text-[13px] leading-snug">{item.question}</p>
                            <div className="flex gap-1.5">
                              {(['groen', 'geel', 'rood'] as Grade[]).map((option) => {
                                const active = value === option
                                return (
                                  <button
                                    key={option}
                                    onClick={() =>
                                      setGrades((g) => {
                                        if (g[item.id] === option) {
                                          const { [item.id]: _removed, ...rest } = g
                                          return rest
                                        }
                                        return { ...g, [item.id]: option }
                                      })
                                    }
                                    className={cx(
                                      'h-9 flex-1 rounded-lg border text-[12.5px] font-semibold transition-all',
                                      active ? 'border-transparent' : 'border-line bg-surface-1 text-ink-3 hover:border-line-strong',
                                    )}
                                    style={active ? { background: GRADE_COLOR[option], color: 'var(--surface-1)' } : undefined}
                                  >
                                    {GRADE_LABEL[option]}
                                  </button>
                                )
                              })}
                            </div>
                            <AnimatePresence>
                              {value && value !== 'groen' && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="overflow-hidden"
                                >
                                  <div className="mt-2 rounded-lg px-3 py-2.5" style={{ background: 'var(--surface-1)' }}>
                                    <p className="text-[12.5px] leading-relaxed text-ink-3">{item.fault}</p>
                                    <p className="mt-1 text-[12.5px] font-medium leading-relaxed">{item.correction}</p>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </div>

      <div className="mt-4">
        <TextArea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Wat viel je op tijdens het terugkijken?" />
      </div>

      <Button
        variant="primary"
        className="mt-3 w-full"
        disabled={answered === 0}
        onClick={() =>
          save({ id: crypto.randomUUID(), date: todayIso(), grades, note: note || undefined })
        }
      >
        {stored.length === 0 ? 'Nulmeting vastleggen' : 'Beoordeling opslaan'}
      </Button>

      {stored.length > 0 && (
        <p className="mt-2 text-[12px] text-ink-3">
          Laatst beoordeeld op {stored[stored.length - 1].date}. Herhaal dit bij elke fase-overgang, of als een oefening
          blijft knellen.
        </p>
      )}

      <SourceNote>Secties 6.1 en 7.2. De app beoordeelt geen video en doet ook niet alsof.</SourceNote>
    </Card>
  )
}
