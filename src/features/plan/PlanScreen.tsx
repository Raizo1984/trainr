/**
 * Plan: waar je staat in de fasearchitectuur, wat de gate zegt, en hoe de
 * komende 48 maanden eruitzien. Fasen zijn criteria-gedreven, dus de tijdlijn
 * toont richting en nooit een belofte.
 */

import { motion } from 'motion/react'
import { Check, ChevronRight, CircleAlert, CircleDashed, Lock, Target } from 'lucide-react'
import { Badge, Button, Card, CheckRow, ProgressRing, SectionTitle, SourceNote } from '@/ui/primitives'
import { useAppStore } from '@/store/useAppStore'
import { useCurrentPhase, useDeloadInfo, useGate, usePhaseWeek, useTemplates } from '@/store/selectors'
import { PHASES } from '@/domain/phases'
import { getStep } from '@/domain/exercises'
import type { GateStatus } from '@/domain/types'

const STATUS_TONE: Record<GateStatus, 'good' | 'warn' | 'serious' | 'neutral'> = {
  groen: 'good',
  geel: 'warn',
  rood: 'serious',
  onbekend: 'neutral',
}

const STATUS_LABEL: Record<GateStatus, string> = {
  groen: 'Groen',
  geel: 'Geel',
  rood: 'Rood',
  onbekend: 'Onbekend',
}

export default function PlanScreen() {
  const phase = useCurrentPhase()
  const week = usePhaseWeek()
  const gate = useGate()
  const templates = useTemplates()
  const deload = useDeloadInfo()
  const confirmGate = useAppStore((s) => s.confirmGate)
  const confirmations = useAppStore((s) => s.phase.confirmations)
  const advancePhase = useAppStore((s) => s.advancePhase)

  const greens = gate.criteria.filter((c) => c.status === 'groen').length
  const manual = gate.criteria.filter((c) => c.status === 'onbekend' || c.id === 'bewegingsruimte' || c.id === 'voeding' || c.id === 'medisch')

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle
          title={phase.name}
          subtitle={phase.tagline}
          right={<Badge tone="brand">Week {week}</Badge>}
        />
        <p className="text-[13.5px] leading-relaxed text-ink-2">{phase.philosophy}</p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Mini label="Minimum" value={`${phase.minWeeks} wk`} />
          <Mini label="Typisch" value={`${phase.typicalWeeks} wk`} />
          <Mini label="Frequentie" value={`${phase.sessionsPerWeek}×/wk`} />
          <Mini label="Deload" value={deload.isDeload ? 'nu' : `over ${deload.weeksUntil} wk`} />
        </div>
        <p className="mt-3 text-[12px] text-ink-3">Fundament: {phase.sources.join(' · ')}</p>
      </Card>

      <Card delay={0.05}>
        <SectionTitle
          title="Gate naar de volgende fase"
          subtitle="Alle criteria groen betekent doorstromen. Eén geel betekent verlengen, niet forceren."
          right={
            <ProgressRing value={greens / gate.criteria.length} size={54} stroke={5} tone={gate.decision === 'doorstromen' ? 'good' : 'brand'}>
              <span className="num text-[12px] font-bold">
                {greens}/{gate.criteria.length}
              </span>
            </ProgressRing>
          }
        />

        <div className="space-y-2">
          {gate.criteria.map((criterion, i) => (
            <motion.div
              key={criterion.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04, duration: 0.3 }}
              className="card-quiet p-3.5"
            >
              <div className="flex items-start gap-3">
                <StatusDot status={criterion.status} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13.5px] font-semibold">{criterion.label}</span>
                    <Badge tone={STATUS_TONE[criterion.status]}>{STATUS_LABEL[criterion.status]}</Badge>
                    <span className="num text-[12px] text-ink-3">{criterion.value}</span>
                  </div>
                  <p className="mt-0.5 text-[12.5px] text-ink-3">{criterion.requirement}</p>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">{criterion.explanation}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div
          className="mt-4 rounded-xl px-4 py-3.5"
          style={{
            background:
              gate.decision === 'doorstromen'
                ? 'var(--status-good-soft)'
                : gate.decision === 'professionele-beoordeling'
                  ? 'var(--status-serious-soft)'
                  : 'var(--surface-3)',
          }}
        >
          <p className="text-[13.5px] leading-relaxed" style={{ color: gate.decision === 'doorstromen' ? 'var(--status-good)' : gate.decision === 'professionele-beoordeling' ? 'var(--status-serious)' : 'var(--text-primary)' }}>
            {gate.summary}
          </p>
          {gate.decision === 'doorstromen' && phase.id < 6 && (
            <Button variant="primary" size="sm" className="mt-3" onClick={advancePhase} icon={<ChevronRight className="size-4" />}>
              Door naar {PHASES[phase.id + 1].name}
            </Button>
          )}
        </div>
        <SourceNote>Secties 3.3 en 6.4, criteria-gedreven faseovergang.</SourceNote>
      </Card>

      {manual.length > 0 && (
        <Card delay={0.1}>
          <SectionTitle
            title="Wat de app niet zelf kan vaststellen"
            subtitle="Deze punten vragen om een oordeel van jou of een professional. De app doet niet alsof ze dat kan meten."
          />
          <div className="grid gap-2">
            <CheckRow
              checked={confirmations.bewegingsruimte === true}
              onChange={(v) => confirmGate('bewegingsruimte', v)}
              label="Mijn bewegingsruimte is voldoende voor de volgende fase"
              hint="Squatdiepte, heupscharnier, schouder boven het hoofd: allemaal pijnvrij uitvoerbaar."
              tone="good"
            />
            <CheckRow
              checked={confirmations.voeding === true}
              onChange={(v) => confirmGate('voeding', v)}
              label="Mijn voedingsplan staat en is besproken"
              hint="Bij verhoogd risico: de diëtistverwijzing is daadwerkelijk opgevolgd."
              tone="good"
            />
            <CheckRow
              checked={confirmations.medisch === true}
              onChange={(v) => confirmGate('medisch', v)}
              label="Mijn klachten zijn beoordeeld, of er zijn geen rode vlaggen"
              tone="good"
            />
          </div>
        </Card>
      )}

      <Card delay={0.14}>
        <SectionTitle title="Sessieopbouw nu" subtitle={templates[0]?.subtitle ?? ''} />
        <div className="space-y-3">
          {templates.map((template) => (
            <div key={template.id}>
              {templates.length > 1 && <div className="mb-1.5 text-[13px] font-semibold">{template.name}</div>}
              <ol className="space-y-1.5">
                {template.main.map((exercise, i) => (
                  <li key={exercise.stepId} className="flex items-center gap-3 rounded-lg px-3 py-2" style={{ background: 'var(--surface-2)' }}>
                    <span className="num w-4 text-[11.5px] font-bold text-ink-3">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-[13.5px]">{getStep(exercise.stepId).name}</span>
                    <span className="num shrink-0 text-[12.5px] text-ink-2">
                      {exercise.sets} × {exercise.repMin}-{exercise.repMax}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </Card>

      <Card delay={0.18}>
        <SectionTitle title="De hele route" subtitle="Maandvensters zijn richting. De criteria bepalen wanneer je doorgaat, niet de kalender." />
        <ol className="relative space-y-3 pl-6">
          <span aria-hidden className="absolute bottom-3 left-[7px] top-3 w-px" style={{ background: 'var(--border-subtle)' }} />
          {PHASES.map((p) => {
            const state = p.id < phase.id ? 'done' : p.id === phase.id ? 'current' : 'future'
            return (
              <li key={p.id} className="relative">
                <span
                  className="absolute -left-6 top-1 grid size-[15px] place-items-center rounded-full border-2"
                  style={{
                    background: state === 'future' ? 'var(--surface-1)' : state === 'current' ? 'var(--brand-2)' : 'var(--status-good)',
                    borderColor: state === 'future' ? 'var(--border-strong)' : 'transparent',
                  }}
                >
                  {state === 'done' && <Check className="size-2.5" style={{ color: 'var(--surface-1)' }} strokeWidth={3.5} />}
                </span>
                <div className={state === 'future' ? 'opacity-55' : undefined}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13.5px] font-semibold">{p.name}</span>
                    <span className="num text-[11.5px] text-ink-3">{p.monthWindow}</span>
                    {state === 'current' && <Badge tone="brand">Nu</Badge>}
                  </div>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-3">{p.tagline}</p>
                </div>
              </li>
            )
          })}
        </ol>
      </Card>

      <DreamGoals />
    </div>
  )
}

function DreamGoals() {
  const dreams = useAppStore((s) => s.intake.goals.dreamGoals)
  const vision = useAppStore((s) => s.intake.goals.vision48m)
  const phase = useCurrentPhase()
  if (dreams.length === 0 && !vision) return null

  return (
    <Card delay={0.22}>
      <SectionTitle title="Waar dit heen gaat" subtitle="Je eigen woorden uit de intake." right={<Target className="size-4 text-ink-3" />} />
      {vision && <p className="text-[14px] italic leading-relaxed text-ink-2">“{vision}”</p>}
      {dreams.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {dreams.map((dream) => (
            <span key={dream} className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[12.5px] font-medium text-ink-2">
              {phase.id >= 3 ? <CircleDashed className="size-3.5" style={{ color: 'var(--brand-2)' }} /> : <Lock className="size-3.5 text-ink-3" />}
              {dream}
            </span>
          ))}
        </div>
      )}
      <p className="mt-3 text-[12.5px] text-ink-3">
        {phase.id >= 3
          ? 'Deze doelen zitten nu in je programma verwerkt, niet als los kunstje ernaast.'
          : 'Skills komen vanaf fase 3 in het programma. Eerst een lichaam dat ze kan dragen.'}
      </p>
    </Card>
  )
}

function StatusDot({ status }: { status: GateStatus }) {
  if (status === 'groen') return <Check className="mt-0.5 size-4 shrink-0" style={{ color: 'var(--status-good)' }} strokeWidth={3} />
  if (status === 'rood') return <CircleAlert className="mt-0.5 size-4 shrink-0" style={{ color: 'var(--status-serious)' }} />
  if (status === 'geel') return <CircleAlert className="mt-0.5 size-4 shrink-0" style={{ color: 'var(--status-warn)' }} />
  return <CircleDashed className="mt-0.5 size-4 shrink-0 text-ink-3" />
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-quiet px-3 py-2.5 text-center">
      <div className="text-[11px] text-ink-3">{label}</div>
      <div className="num mt-0.5 text-[15px] font-bold">{value}</div>
    </div>
  )
}
