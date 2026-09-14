/**
 * Het huidige blok: welk accent of welke focus, hoelang nog, en waarom.
 * Zichtbaar vanaf fase 4, want daarvoor is het blok simpelweg de deloadcyclus.
 */

import { motion } from 'motion/react'
import { Layers, Target } from 'lucide-react'
import { Badge, Card, SectionTitle, SourceNote, cx } from '@/ui/primitives'
import { useAppStore } from '@/store/useAppStore'
import { useBlockPlan, useCurrentPhase, useSkillProgress } from '@/store/selectors'
import { ACCENT_LABEL, ACCENT_LADDERS, FOCUS_LABEL, type SpecialisationFocus } from '@/domain/blocks'
import { getLadder } from '@/domain/exercises'
import { skillStepName } from '@/domain/skills'

export function BlockCard() {
  const phase = useCurrentPhase()
  const plan = useBlockPlan()
  const focus = useAppStore((s) => s.phase.blockFocus)
  const setBlockFocus = useAppStore((s) => s.setBlockFocus)

  if (phase.id < 4) return null

  return (
    <Card delay={0.04}>
      <SectionTitle
        title={plan.title}
        subtitle={`Week ${plan.weekInBlock} van ${plan.lengthWeeks}`}
        right={<Layers className="size-4 text-ink-3" />}
      />

      <div className="mb-4 flex gap-1">
        {Array.from({ length: plan.lengthWeeks }, (_, i) => (
          <motion.span
            key={i}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: i * 0.04, duration: 0.3 }}
            className="h-1.5 flex-1 rounded-full"
            style={{
              background:
                i < plan.weekInBlock ? 'linear-gradient(90deg, var(--brand-1), var(--brand-2))' : 'var(--surface-3)',
            }}
          />
        ))}
      </div>

      <p className="text-[13.5px] leading-relaxed text-ink-2">{plan.rationale}</p>

      {plan.accent && (
        <div className="mt-4">
          <div className="mb-2 text-[11.5px] font-semibold uppercase tracking-wide text-ink-3">
            Zwaar dit blok
          </div>
          <div className="flex flex-wrap gap-2">
            {ACCENT_LADDERS[plan.accent].map((ladderId) => (
              <span
                key={ladderId}
                className="rounded-full px-3 py-1.5 text-[12.5px] font-medium"
                style={{ background: 'var(--brand-soft)', color: 'var(--brand-2)' }}
              >
                {getLadder(ladderId).name}
              </span>
            ))}
          </div>
          <p className="mt-2.5 text-[12.5px] text-ink-3">
            Alles wat hier niet staat draait op onderhoud: één set minder, zelfde bereik, niet zwaarder maken.
          </p>
        </div>
      )}

      {phase.id === 5 && (
        <div className="mt-4">
          <div className="mb-2 text-[11.5px] font-semibold uppercase tracking-wide text-ink-3">
            Focus van deze cyclus
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {(['massa', 'kracht', 'skill'] as SpecialisationFocus[]).map((option) => {
              const active = (focus ?? plan.focus) === option
              return (
                <button
                  key={option}
                  onClick={() => setBlockFocus(focus === option ? undefined : option)}
                  className={cx(
                    'rounded-xl border px-3 py-2.5 text-left transition-all duration-150',
                    active ? 'border-transparent' : 'border-line bg-surface-2 text-ink-2 hover:border-line-strong',
                  )}
                  style={active ? { background: 'var(--brand-soft)', boxShadow: 'inset 0 0 0 1.5px var(--brand-2)' } : undefined}
                >
                  <span className="block text-[13.5px] font-semibold">{FOCUS_LABEL[option]}</span>
                  <span className="mt-0.5 block text-[12px] text-ink-3">
                    {option === 'massa' ? '8-12 reps, meer volume' : option === 'kracht' ? '4-6 reps, zwaarder' : 'Skillwerk voorop'}
                  </span>
                </button>
              )
            })}
          </div>
          <p className="mt-2.5 text-[12.5px] text-ink-3">
            {focus
              ? 'Eigen keuze. Klik dezelfde knop nogmaals om terug te gaan naar de standaardrotatie.'
              : 'De app rouleert massa, kracht en skill. Klik een optie om zelf te kiezen.'}
          </p>
        </div>
      )}

      {plan.weeksLeft === 0 ? (
        <p className="mt-4 rounded-xl px-3.5 py-3 text-[13px] leading-relaxed" style={{ background: 'var(--surface-3)' }}>
          Laatste week van dit blok. Volgende week verschuift het accent
          {plan.accent ? ` naar ${ACCENT_LABEL[nextAccent(plan.accent)]}` : ''}.
        </p>
      ) : (
        <p className="mt-4 text-[12.5px] text-ink-3">
          Nog {plan.weeksLeft} {plan.weeksLeft === 1 ? 'week' : 'weken'} in dit blok.
        </p>
      )}

      <SourceNote>Sectie 3.2, blokperiodisering en specialisatiecycli.</SourceNote>
    </Card>
  )
}

function firstStepName(ladderId: string): string {
  return getLadder(ladderId).steps[0].name
}

const ORDER = ['squat', 'pull', 'hinge', 'push'] as const

function nextAccent(current: (typeof ORDER)[number]): (typeof ORDER)[number] {
  return ORDER[(ORDER.indexOf(current) + 1) % ORDER.length]
}

/** Droomdoelen met hun route: waar sta je, wat is de volgende trede, wat blokkeert. */
export function SkillPathsCard() {
  const progress = useSkillProgress()
  if (progress.length === 0) return null

  return (
    <Card delay={0.2}>
      <SectionTitle
        title="Droomdoelen"
        subtitle="Elke skill is een lader met treden, geen alles-of-niets."
        right={<Target className="size-4 text-ink-3" />}
      />
      <div className="space-y-3">
        {progress.map((item, i) => (
          <motion.div
            key={item.path.goal}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.3 }}
            className="card-quiet p-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[14px] font-semibold">{item.path.goal}</span>
              {item.active ? (
                <Badge tone="good">In je programma</Badge>
              ) : item.unlocked ? (
                <Badge tone="brand">Klaar om te starten</Badge>
              ) : (
                <Badge tone="neutral">Nog niet</Badge>
              )}
              <span className="num ml-auto text-[12px] text-ink-3">
                {item.currentRung === 0 ? `${item.totalRungs} treden` : `trede ${item.currentRung} / ${item.totalRungs}`}
              </span>
            </div>

            <div className="mt-2.5 flex gap-1">
              {Array.from({ length: item.totalRungs }, (_, i) => {
                // Segment i staat voor trede i + 1: de treden beginnen bij 1.
                const rung = i + 1
                return (
                  <span
                    key={rung}
                    className="h-1.5 flex-1 rounded-full"
                    style={{
                      background:
                        rung < item.currentRung
                          ? 'var(--status-good)'
                          : rung === item.currentRung
                            ? 'var(--brand-2)'
                            : 'var(--surface-3)',
                    }}
                  />
                )
              })}
            </div>

            {item.currentStepId ? (
              <>
                <p className="mt-2.5 text-[13px] text-ink-2">
                  Nu: <span className="font-medium text-ink">{skillStepName(item.currentStepId)}</span>
                  {item.best > 0 && <span className="num text-ink-3"> · beste {item.best}</span>}
                </p>
                {item.nextStepName && (
                  <p className="mt-1 text-[13px] text-ink-3">Volgende trede: {item.nextStepName}</p>
                )}
              </>
            ) : (
              <p className="mt-2.5 text-[13px] text-ink-3">
                Nog niet aan begonnen. Eerste trede: {firstStepName(item.path.ladderId)}
              </p>
            )}

            {!item.unlocked && (
              <div className="mt-2.5 rounded-lg px-3 py-2.5" style={{ background: 'var(--surface-3)' }}>
                <div className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-3">Eerst dit</div>
                <ul className="mt-1 space-y-0.5">
                  {item.blockedBy.map((reason) => (
                    <li key={reason} className="text-[12.5px] text-ink-2">
                      {reason}
                    </li>
                  ))}
                </ul>
                <p className="mt-1.5 text-[12px] italic text-ink-3">{item.path.gatekeeping}</p>
              </div>
            )}
          </motion.div>
        ))}
      </div>
      <SourceNote>Secties 2.1 en 3.2, droomdoelen geïntegreerd in het programma.</SourceNote>
    </Card>
  )
}
