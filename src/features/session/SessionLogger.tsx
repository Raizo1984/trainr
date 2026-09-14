/**
 * Sessie loggen (sectie 4.1). Doel: onder de twee minuten per sessie.
 *
 * Daarom is alles voorgevuld met wat The Rule voorschrijft, is pijn alleen
 * zichtbaar als je hem opent, en hoeft de gebruiker per set hooguit reps en
 * RIR aan te tikken.
 */

import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  ChevronDown,
  CircleCheck,
  CircleDot,
  Info,
  Minus,
  Pause,
  Plus,
  Save,
  Trash2,
  Undo2,
} from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  ScalePicker,
  SectionTitle,
  Select,
  SourceNote,
  TextArea,
  cx,
} from '@/ui/primitives'
import { useAppStore } from '@/store/useAppStore'
import { useCurrentPhase, useDeloadInfo, usePendingFollowUps, useSafety, useTemplates } from '@/store/selectors'
import { prescribeSession, type Prescription } from '@/domain/prescribe'
import { getLadder, getStep } from '@/domain/exercises'
import { todayIso } from '@/domain/analytics'
import { BODY_REGIONS, REGION_LABEL } from '@/domain/types'
import type { BodyRegion, ExerciseLog, Pain, Scale5, SessionLog, SetEntry } from '@/domain/types'

type Draft = Record<string, SetEntry[]>

export default function SessionLogger() {
  const hold = useAppStore((s) => s.medicalHold)
  const pending = usePendingFollowUps()
  const [mode, setMode] = useState<'log' | 'followup'>(pending.length > 0 ? 'followup' : 'log')

  if (hold?.active) {
    return (
      <Card>
        <div className="flex gap-3">
          <Pause className="mt-0.5 size-5 shrink-0" style={{ color: 'var(--status-serious)' }} />
          <div>
            <h2 className="text-[15px] font-semibold">Training staat gepauzeerd</h2>
            <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">{hold.reason}</p>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">
              Dit is geen bug en geen straf. Zolang een symptoom niet beoordeeld is, is elk programma een gok.
            </p>
          </div>
        </div>
        <SourceNote>Sectie 9.1.</SourceNote>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {pending.length > 0 && (
        <div className="flex gap-2">
          <TabButton active={mode === 'log'} onClick={() => setMode('log')}>
            Sessie loggen
          </TabButton>
          <TabButton active={mode === 'followup'} onClick={() => setMode('followup')}>
            24-uursreactie ({pending.length})
          </TabButton>
        </div>
      )}
      {mode === 'followup' && pending.length > 0 ? <FollowUpPanel /> : <LogPanel />}
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        'rounded-xl px-3.5 py-2 text-[13px] font-semibold transition-colors',
        active ? 'text-ink' : 'text-ink-3 hover:text-ink-2',
      )}
      style={active ? { background: 'var(--surface-1)', boxShadow: 'var(--shadow-card)' } : undefined}
    >
      {children}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Sessie loggen                                                       */
/* ------------------------------------------------------------------ */

function LogPanel() {
  const sessions = useAppStore((s) => s.sessions)
  const logSession = useAppStore((s) => s.logSession)
  const phase = useCurrentPhase()
  const safety = useSafety()
  const templates = useTemplates()
  const deload = useDeloadInfo()

  const [templateIndex, setTemplateIndex] = useState(0)
  const template = templates[templateIndex]

  const [vitals, setVitals] = useState({ sleepQuality: 3 as Scale5, energy: 3 as Scale5, stress: 3 as Scale5 })
  const [started, setStarted] = useState(false)
  const [draft, setDraft] = useState<Draft>({})
  const [saved, setSaved] = useState(false)

  const prescriptions = useMemo(
    () => (template ? prescribeSession(sessions, template.main, safety) : []),
    [sessions, template, safety],
  )

  if (!template) {
    return <EmptyState title="Geen programma beschikbaar" body="Rond eerst de intake af, dan stelt de app een sessie samen." />
  }

  const loggedSets = Object.values(draft).flat().length
  const plannedSets = prescriptions.reduce((total, p) => total + p.sets, 0)

  const save = () => {
    const exercises: ExerciseLog[] = prescriptions
      .map((p) => ({
        ladderId: p.ladderId,
        stepId: p.stepId,
        planned: { sets: p.sets, repMin: p.repMin, repMax: p.repMax, targetRir: p.targetRir },
        sets: (draft[p.ladderId] ?? []).filter((s) => s.reps > 0),
      }))
      .filter((e) => e.sets.length > 0)

    if (exercises.length === 0) return

    const painByRegion: Partial<Record<BodyRegion, Pain>> = {}
    for (const exercise of exercises) {
      for (const set of exercise.sets) {
        if (set.painRegion && set.pain > (painByRegion[set.painRegion] ?? 0)) {
          painByRegion[set.painRegion] = set.pain
        }
      }
    }

    const session: SessionLog = {
      id: crypto.randomUUID(),
      date: todayIso(),
      templateId: template.id,
      phase: phase.id,
      phaseWeek: deload.week,
      isDeload: deload.isDeload,
      durationMinutes: 0,
      vitals,
      exercises,
      post: { painByRegion, fatigue: 3 },
      followUp: null,
      completedAt: new Date().toISOString(),
    }
    logSession(session)
    setDraft({})
    setStarted(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3200)
  }

  if (!started) {
    return (
      <div className="space-y-4">
        <AnimatePresence>
          {saved && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div
                className="flex items-center gap-2.5 rounded-2xl px-4 py-3 text-[13.5px] font-medium"
                style={{ background: 'var(--status-good-soft)', color: 'var(--status-good)' }}
              >
                <CircleCheck className="size-4.5" />
                Sessie opgeslagen. Vul morgen de 24-uursreactie in, die bepaalt de volgende sessie.
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <Card>
          <SectionTitle
            title="Voor je begint"
            subtitle="Drie vragen. Ze bepalen hoe de app je resultaten van vandaag leest."
            right={deload.isDeload ? <Badge tone="neutral">Deloadweek</Badge> : undefined}
          />
          <div className="grid gap-4">
            {templates.length > 1 && (
              <Field label="Welke sessie">
                <Select value={templateIndex} onChange={(e) => setTemplateIndex(Number(e.target.value))}>
                  {templates.map((t, i) => (
                    <option key={t.id} value={i}>{t.name}</option>
                  ))}
                </Select>
              </Field>
            )}
            <Field label={`Slaapkwaliteit vannacht: ${vitals.sleepQuality}/5`}>
              <ScalePicker value={vitals.sleepQuality} min={1} max={5} onChange={(v) => setVitals((s) => ({ ...s, sleepQuality: v as Scale5 }))} labels={['slecht', 'uitstekend']} />
            </Field>
            <Field label={`Energie nu: ${vitals.energy}/5`}>
              <ScalePicker value={vitals.energy} min={1} max={5} onChange={(v) => setVitals((s) => ({ ...s, energy: v as Scale5 }))} labels={['leeg', 'vol']} />
            </Field>
            <Field label={`Stress: ${vitals.stress}/5`}>
              <ScalePicker value={vitals.stress} min={1} max={5} onChange={(v) => setVitals((s) => ({ ...s, stress: v as Scale5 }))} labels={['rustig', 'overbelast']} tone={vitals.stress >= 4 ? 'warn' : 'brand'} />
            </Field>
          </div>
          <Button variant="primary" className="mt-5 w-full" onClick={() => setStarted(true)}>
            Beginnen met {template.name}
          </Button>
        </Card>

        <Card delay={0.06}>
          <SectionTitle title="Vaste warming-up" subtitle="Elke sessie identiek, 10 minuten. Dit deel verandert niet." />
          <FixedList items={template.warmup} />
        </Card>
        <Card delay={0.1}>
          <SectionTitle title="Vaste cool-down" subtitle="5 minuten, elke sessie gelijk." />
          <FixedList items={template.cooldown} />
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-[57px] z-20 -mx-4 px-4 pb-2 pt-1 backdrop-blur-xl md:top-0 md:-mx-2 md:px-2" style={{ background: 'color-mix(in oklab, var(--surface-base) 82%, transparent)' }}>
        <div className="card flex items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13.5px] font-semibold sm:text-[14px]">{template.name}</div>
            <div className="num text-[12px] text-ink-3">
              {loggedSets} van {plannedSets} sets gelogd
            </div>
          </div>
          <button
            onClick={() => setStarted(false)}
            aria-label="Terug naar het overzicht"
            className="grid size-10 shrink-0 place-items-center rounded-xl text-ink-2 transition-colors hover:bg-surface-3 hover:text-ink sm:hidden"
          >
            <Undo2 className="size-[18px]" />
          </button>
          <Button variant="ghost" size="sm" onClick={() => setStarted(false)} icon={<Undo2 className="size-4" />} className="hidden sm:inline-flex">
            Terug
          </Button>
          <Button variant="primary" size="sm" onClick={save} disabled={loggedSets === 0} icon={<Save className="size-4" />} className="shrink-0">
            Opslaan
          </Button>
        </div>
      </div>

      {prescriptions.map((prescription, index) => (
        <ExerciseCard
          key={prescription.ladderId}
          prescription={prescription}
          index={index}
          sets={draft[prescription.ladderId] ?? []}
          onChange={(sets) => setDraft((d) => ({ ...d, [prescription.ladderId]: sets }))}
        />
      ))}
    </div>
  )
}

/**
 * Dosering in gewone taal. "1 x 5" is nietszeggend bij een oefening die in
 * minuten of meters wordt gedaan.
 */
function formatDose(item: { stepId: string; sets: number; repMin: number; repMax: number }): string {
  const step = getStep(item.stepId)
  const range = item.repMin === item.repMax ? `${item.repMin}` : `${item.repMin}-${item.repMax}`
  if (step.loadType === 'tijd') return item.repMin === 1 ? `${item.sets} min` : `${range} min`
  if (step.loadType === 'afstand') return `${item.sets} × ${range} m`
  return `${item.sets} × ${range}`
}

function FixedList({ items }: { items: Array<{ ladderId: string; stepId: string; sets: number; repMin: number; repMax: number; note?: string }> }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.stepId} className="card-quiet flex items-start gap-3 px-3.5 py-2.5">
          <CircleDot className="mt-0.5 size-4 shrink-0 text-ink-3" />
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-medium">{getStep(item.stepId).name}</div>
            {item.note && <div className="text-[12px] text-ink-3">{item.note}</div>}
          </div>
          <span className="num shrink-0 text-[12.5px] text-ink-2">{formatDose(item)}</span>
        </li>
      ))}
    </ul>
  )
}

/* ------------------------------------------------------------------ */

function ExerciseCard({
  prescription,
  index,
  sets,
  onChange,
}: {
  prescription: Prescription
  index: number
  sets: SetEntry[]
  onChange: (sets: SetEntry[]) => void
}) {
  const step = getStep(prescription.stepId)
  const ladder = getLadder(prescription.ladderId)
  const [open, setOpen] = useState(index === 0)
  const bodyweight = step.loadType === 'trede'

  const addSet = () => {
    const last = sets[sets.length - 1]
    onChange([
      ...sets,
      {
        setIndex: sets.length,
        reps: last?.reps ?? prescription.repMin,
        load: last?.load ?? prescription.load,
        rir: last?.rir ?? prescription.targetRir,
        pain: 0,
        painRegion: null,
        formQuality: 5,
      },
    ])
  }

  const update = (i: number, patch: Partial<SetEntry>) =>
    onChange(sets.map((s, j) => (i === j ? { ...s, ...patch } : s)))

  const done = sets.length >= prescription.sets

  return (
    <motion.section layout className="card overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-start gap-3 p-5 text-left">
        <span
          className="num mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg text-[12.5px] font-bold"
          style={
            done
              ? { background: 'var(--status-good)', color: 'var(--surface-1)' }
              : { background: 'var(--surface-3)', color: 'var(--text-muted)' }
          }
        >
          {done ? '✓' : index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-semibold">{step.name}</h3>
            {prescription.decision?.flagged && <Badge tone="warn">Aangepast</Badge>}
          </div>
          <div className="num mt-0.5 text-[12.5px] text-ink-2">
            {prescription.sets} × {prescription.repMin}-{prescription.repMax}
            {!bodyweight && prescription.load > 0 && ` · ${prescription.load} kg`}
            {` · RIR ${prescription.targetRir}`}
          </div>
          {prescription.lastTime && <div className="mt-0.5 text-[12px] text-ink-3">{prescription.lastTime}</div>}
        </div>
        <ChevronDown className={cx('mt-1 size-4 shrink-0 text-ink-3 transition-transform', open && 'rotate-180')} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="space-y-3 px-5 pb-5">
              <div className="card-quiet flex gap-2.5 px-3.5 py-3">
                <Info className="mt-0.5 size-4 shrink-0 text-ink-3" />
                <div className="min-w-0 text-[12.5px] leading-relaxed text-ink-2">
                  <p><span className="font-semibold text-ink">Regel:</span> {ladder.rule}</p>
                  <p className="mt-1"><span className="font-semibold text-ink">Cue:</span> {step.cue}</p>
                  {prescription.decision && (
                    <p className="mt-1.5 border-t border-line pt-1.5">
                      <span className="font-semibold text-ink">Aanpassing:</span> {prescription.decision.reason}
                    </p>
                  )}
                  {prescription.note && !ladder.rule.startsWith(prescription.note) && (
                    <p className="mt-1.5 italic">{prescription.note}</p>
                  )}
                </div>
              </div>

              {sets.map((set, i) => (
                <SetRow
                  key={i}
                  index={i}
                  set={set}
                  bodyweight={bodyweight}
                  repMax={prescription.repMax}
                  onChange={(patch) => update(i, patch)}
                  onRemove={() => onChange(sets.filter((_, j) => j !== i))}
                />
              ))}

              <button
                onClick={addSet}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line py-2.5 text-[13px] font-medium text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
              >
                <Plus className="size-4" />
                Set {sets.length + 1} toevoegen
                {sets.length >= prescription.sets && ' (boven het voorschrift)'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  )
}

function SetRow({
  index,
  set,
  bodyweight,
  repMax,
  onChange,
  onRemove,
}: {
  index: number
  set: SetEntry
  bodyweight: boolean
  repMax: number
  onChange: (patch: Partial<SetEntry>) => void
  onRemove: () => void
}) {
  const [detail, setDetail] = useState(false)
  const hitTop = set.reps >= repMax

  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="card-quiet p-3.5">
      <div className="flex flex-wrap items-end gap-3">
        <span className="num w-6 shrink-0 pb-2 text-[12px] font-bold text-ink-3">#{index + 1}</span>

        <Stepper label="Reps" value={set.reps} onChange={(v) => onChange({ reps: Math.max(0, v) })} highlight={hitTop} />

        {!bodyweight && (
          <Stepper label="Kg" value={set.load} step={2.5} onChange={(v) => onChange({ load: Math.max(0, v) })} />
        )}

        <div className="min-w-[124px] flex-1">
          <div className="mb-1 text-[11.5px] font-medium text-ink-2">RIR {set.rir}</div>
          <ScalePicker
            value={set.rir}
            min={0}
            max={4}
            onChange={(v) => onChange({ rir: v })}
            tone={set.rir === 0 ? 'serious' : set.rir < 2 ? 'warn' : 'good'}
          />
        </div>

        <button
          onClick={() => setDetail((d) => !d)}
          className={cx('rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-colors', detail ? 'text-ink' : 'text-ink-3 hover:text-ink-2')}
          style={
            set.pain > 0 || set.formQuality < 4
              ? { background: 'var(--status-warn-soft)', color: 'var(--status-warn)' }
              : detail
                ? { background: 'var(--surface-3)' }
                : undefined
          }
        >
          {set.pain > 0 ? `Pijn ${set.pain}` : set.formQuality < 4 ? `Vorm ${set.formQuality}` : 'Pijn / vorm'}
        </button>

        <button
          onClick={onRemove}
          aria-label="Set verwijderen"
          className="grid size-10 shrink-0 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      <AnimatePresence>
        {detail && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mt-3 grid gap-3 border-t border-line pt-3">
              <Field label={`Pijn tijdens deze set: ${set.pain}/10`} hint="Alleen invullen als er pijn was. 3 of hoger past de volgende sessie aan.">
                <ScalePicker
                  value={set.pain}
                  onChange={(v) => onChange({ pain: v as Pain, painRegion: v > 0 ? (set.painRegion ?? 'knie-links') : null })}
                  tone={set.pain >= 5 ? 'serious' : set.pain >= 3 ? 'warn' : 'good'}
                  labels={['geen', 'ondraaglijk']}
                />
              </Field>
              {set.pain > 0 && (
                <Field label="Waar">
                  <Select value={set.painRegion ?? ''} onChange={(e) => onChange({ painRegion: e.target.value as BodyRegion })}>
                    {BODY_REGIONS.map((region) => (
                      <option key={region} value={region}>{REGION_LABEL[region]}</option>
                    ))}
                  </Select>
                </Field>
              )}
              <Field label={`Techniek: ${set.formQuality}/5`} hint="Onder de 4 gaat de belasting volgende sessie omlaag. Techniekverlies betekent: set over.">
                <ScalePicker
                  value={set.formQuality}
                  min={1}
                  max={5}
                  onChange={(v) => onChange({ formQuality: v as Scale5 })}
                  tone={set.formQuality < 4 ? 'warn' : 'good'}
                  labels={['viel uit elkaar', 'schoon']}
                />
              </Field>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function Stepper({
  label,
  value,
  onChange,
  step = 1,
  highlight,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  step?: number
  highlight?: boolean
}) {
  return (
    <div>
      <div className="mb-1 text-[11.5px] font-medium text-ink-2">{label}</div>
      <div
        className="flex items-center rounded-xl border"
        style={{
          borderColor: highlight ? 'var(--status-good)' : 'var(--border-subtle)',
          background: highlight ? 'var(--status-good-soft)' : 'var(--surface-1)',
        }}
      >
        <button onClick={() => onChange(value - step)} className="grid size-9 place-items-center text-ink-3 transition-colors hover:text-ink" aria-label={`${label} omlaag`}>
          <Minus className="size-3.5" />
        </button>
        <span className="num w-10 text-center text-[14px] font-bold">{value}</span>
        <button onClick={() => onChange(value + step)} className="grid size-9 place-items-center text-ink-3 transition-colors hover:text-ink" aria-label={`${label} omhoog`}>
          <Plus className="size-3.5" />
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 24-uursreactie                                                      */
/* ------------------------------------------------------------------ */

function FollowUpPanel() {
  const pending = usePendingFollowUps()
  const addFollowUp = useAppStore((s) => s.addFollowUp)
  const session = pending[0]

  const [soreness, setSoreness] = useState<Scale5>(2)
  const [sleep, setSleep] = useState<Scale5>(3)
  const [pain, setPain] = useState<Partial<Record<BodyRegion, Pain>>>({})
  const [note, setNote] = useState('')

  if (!session) {
    return <EmptyState title="Niets openstaand" body="Alle sessies hebben een 24-uursreactie. Dat is precies hoe de app moet werken." />
  }

  const regions = Object.keys(session.post?.painByRegion ?? {}) as BodyRegion[]

  return (
    <Card>
      <SectionTitle
        title={`Hoe voelt het nu, na ${session.date}?`}
        subtitle="Deze reactie weegt net zo zwaar als wat je tijdens de sessie voelde. Ze bepaalt je volgende voorschrift."
      />
      <div className="grid gap-4">
        <Field label={`Spierpijn: ${soreness}/5`}>
          <ScalePicker value={soreness} min={1} max={5} onChange={(v) => setSoreness(v as Scale5)} labels={['niets', 'fors']} tone={soreness >= 4 ? 'warn' : 'good'} />
        </Field>
        <Field label={`Slaapkwaliteit die nacht: ${sleep}/5`}>
          <ScalePicker value={sleep} min={1} max={5} onChange={(v) => setSleep(v as Scale5)} labels={['slecht', 'uitstekend']} />
        </Field>

        {regions.length > 0 ? (
          regions.map((region) => (
            <Field key={region} label={`${REGION_LABEL[region]}: ${pain[region] ?? 0}/10`} hint={`Tijdens de sessie was dit ${session.post?.painByRegion[region]}/10.`}>
              <ScalePicker
                value={pain[region] ?? 0}
                onChange={(v) => setPain((p) => ({ ...p, [region]: v as Pain }))}
                tone={(pain[region] ?? 0) >= 5 ? 'serious' : (pain[region] ?? 0) >= 3 ? 'warn' : 'good'}
              />
            </Field>
          ))
        ) : (
          <p className="text-[13px] text-ink-3">Je meldde geen pijn tijdens deze sessie. Is er sindsdien toch iets opgekomen, voeg het dan toe in de notitie.</p>
        )}

        <Field label="Notitie">
          <TextArea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Knie voelde de dag erna juist beter" />
        </Field>
      </div>

      <Button
        variant="primary"
        className="mt-5 w-full"
        onClick={() =>
          addFollowUp(session.id, {
            soreness,
            painByRegion: pain,
            sleepQuality: sleep,
            recordedAt: todayIso(),
          })
        }
      >
        Opslaan
      </Button>
      <SourceNote>Sectie 4.1, 24-uursreactie op belasting.</SourceNote>
    </Card>
  )
}
