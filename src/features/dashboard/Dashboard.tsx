/**
 * Vandaag-scherm: wat moet er nu gebeuren, en wat is er opgevallen.
 * De gebruiker mag hier nooit hoeven nadenken over "wat nu" (slotinstructie, punt 2).
 */

import { motion } from 'motion/react'
import {
  ArrowRight,
  CalendarCheck,
  ChevronRight,
  Clock,
  Flame,
  Pause,
  ShieldAlert,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import type { Tab } from '@/App'
import { Badge, Button, Card, ProgressRing, SectionTitle, SourceNote } from '@/ui/primitives'
import { PainChart, VolumeChart } from '@/ui/charts'
import { useAppStore } from '@/store/useAppStore'
import {
  useAdherence,
  useAlerts,
  useCurrentPhase,
  useDeloadInfo,
  usePendingFollowUps,
  usePhaseWeek,
  useTemplates,
  useWeeklyCheckIn,
} from '@/store/selectors'
import { lastNDays, peakPain, weeklyVolume } from '@/domain/analytics'
import { AlertCard } from '@/features/coach/AlertCard'
import { BlockReviewCard } from '@/features/coach/BlockReviewCard'

export default function Dashboard({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  const name = useAppStore((s) => s.intake.name)
  const sessions = useAppStore((s) => s.sessions)
  const hold = useAppStore((s) => s.medicalHold)
  const sessionMinutes = useAppStore((s) => s.intake.training.sessionMinutes)
  const phase = useCurrentPhase()
  const week = usePhaseWeek()
  const deload = useDeloadInfo()
  const adherence = useAdherence()
  const alerts = useAlerts()
  const templates = useTemplates()
  const checkIn = useWeeklyCheckIn()
  const pending = usePendingFollowUps()

  const thisWeek = lastNDays(sessions, 7)
  const volumeData = weeklyVolume(sessions).slice(-10)
  const painData = sessions.slice(-24).map((s) => ({ date: s.date, pain: peakPain(s) }))

  const topAlert = alerts.find((a) => a.severity === 'kritiek') ?? alerts[0]

  return (
    <div className="space-y-4">
      <Hero name={name} phaseName={phase.name} week={week} deload={deload.isDeload} />

      {hold?.active && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="pulse-alert" >
            <div className="flex gap-3">
              <Pause className="mt-0.5 size-5 shrink-0" style={{ color: 'var(--status-serious)' }} />
              <div className="flex-1">
                <h3 className="text-[14.5px] font-semibold">Training staat gepauzeerd</h3>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{hold.reason}</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">
                  Neem contact op met je arts en vertel wat je gemeld hebt. Je kunt intussen gewoon voeding en metingen
                  bijhouden. Er komt geen programma tot je groen licht hebt.
                </p>
                <Button size="sm" className="mt-3" onClick={() => onNavigate('instellingen')}>
                  Pauze opheffen na groen licht
                </Button>
              </div>
            </div>
            <SourceNote>Sectie 9.1, automatische pauze bij medische rode vlaggen.</SourceNote>
          </Card>
        </motion.div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <NextSession
          templateName={templates[0]?.name ?? 'Geen programma'}
          subtitle={templates[0]?.subtitle ?? ''}
          exerciseCount={templates[0]?.main.length ?? 0}
          minutes={sessionMinutes}
          paused={Boolean(hold?.active)}
          deload={deload.isDeload}
          onStart={() => onNavigate('trainen')}
        />

        <Card delay={0.05}>
          <SectionTitle title="Deze week" subtitle={`Week ${week} van ${phase.name.toLowerCase()}`} />
          <div className="flex items-center gap-5">
            <ProgressRing value={adherence.ratio} tone={adherence.ratio >= 0.8 ? 'good' : adherence.ratio >= 0.65 ? 'warn' : 'serious'}>
              <div className="text-center">
                <div className="num text-[17px] font-bold leading-none">{Math.round(adherence.ratio * 100)}%</div>
                <div className="text-[10px] text-ink-3">opkomst</div>
              </div>
            </ProgressRing>
            <div className="min-w-0 flex-1 space-y-2">
              <Row icon={<CalendarCheck className="size-4" />} label="Sessies deze week" value={`${thisWeek.length} van ${phase.sessionsPerWeek}`} />
              <Row icon={<Flame className="size-4" />} label="Totaal gelogd" value={`${sessions.length}`} />
              <Row
                icon={<Clock className="size-4" />}
                label="Volgende deload"
                value={deload.isDeload ? 'deze week' : `over ${deload.weeksUntil} wk`}
              />
            </div>
          </div>
        </Card>
      </div>

      {pending.length > 0 && (
        <Card delay={0.08}>
          <div className="flex flex-wrap items-center gap-3">
            <ShieldAlert className="size-5 shrink-0" style={{ color: 'var(--status-warn)' }} />
            <div className="min-w-0 flex-1">
              <h3 className="text-[14px] font-semibold">
                {pending.length} {pending.length === 1 ? 'sessie wacht' : 'sessies wachten'} op je 24-uursreactie
              </h3>
              <p className="mt-0.5 text-[12.5px] text-ink-2">
                Die reactie bepaalt de volgende sessie, niet hoe het voelde tijdens het trainen.
              </p>
            </div>
            <Button size="sm" onClick={() => onNavigate('trainen')}>
              Invullen
            </Button>
          </div>
        </Card>
      )}

      <BlockReviewCard delay={0.09} />

      {topAlert && (
        <div>
          <AlertCard alert={topAlert} delay={0.1} />
          {alerts.length > 1 && (
            <button
              onClick={() => onNavigate('coach')}
              className="mt-2 flex items-center gap-1 text-[13px] font-medium"
              style={{ color: 'var(--brand-2)' }}
            >
              Nog {alerts.length - 1} {alerts.length - 1 === 1 ? 'signaal' : 'signalen'} bekijken
              <ChevronRight className="size-4" />
            </button>
          )}
        </div>
      )}

      {checkIn && (
        <Card delay={0.14}>
          <SectionTitle
            title={checkIn.headline}
            subtitle="Wekelijkse check-in"
            right={<Sparkles className="size-4 text-ink-3" />}
          />
          <ul className="space-y-1.5">
            {checkIn.observations.map((observation, i) => (
              <li key={i} className="flex gap-2 text-[13.5px] text-ink-2">
                <span className="mt-[7px] size-1 shrink-0 rounded-full" style={{ background: 'var(--text-muted)' }} />
                {observation}
              </li>
            ))}
          </ul>
          <div className="mt-3.5 rounded-xl px-3.5 py-3" style={{ background: 'var(--brand-soft)' }}>
            <div className="text-[11.5px] font-semibold uppercase tracking-wide" style={{ color: 'var(--brand-2)' }}>
              Eén ding voor deze week
            </div>
            <p className="mt-1 text-[13.5px] leading-relaxed text-ink">{checkIn.tip}</p>
          </div>
          <p className="mt-3 text-[13px] italic text-ink-3">{checkIn.question}</p>
          <SourceNote>Sectie 7.1, coachingmoment 1.</SourceNote>
        </Card>
      )}

      {sessions.length >= 2 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card delay={0.18}>
            <SectionTitle title="Weekvolume" subtitle="Werksets per week. Meer dan 10% sprong is geen vooruitgang maar risico." />
            <VolumeChart data={volumeData} />
          </Card>
          <Card delay={0.22}>
            <SectionTitle title="Pijnverloop" subtitle="Hoogste waarde per sessie. De groene band is waar doortrainen verantwoord is." />
            <PainChart data={painData} />
          </Card>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */

function Hero({ name, phaseName, week, deload }: { name: string; phaseName: string; week: number; deload: boolean }) {
  const hour = new Date().getHours()
  const greeting = hour < 6 ? 'Nog wakker' : hour < 12 ? 'Goedemorgen' : hour < 18 ? 'Goedemiddag' : 'Goedenavond'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-wrap items-end justify-between gap-3 pb-1"
    >
      <div>
        <p className="text-[13px] text-ink-3">
          {greeting}
          {name ? `, ${name}` : ''}
        </p>
        <h1 className="mt-0.5 text-[26px] font-bold tracking-tight md:text-[30px]">
          {deload ? 'Deloadweek' : phaseName.split('—')[1]?.trim() || phaseName}
        </h1>
      </div>
      <div className="flex items-center gap-2">
        <Badge tone="brand">Week {week}</Badge>
        {deload && <Badge tone="neutral">Helft van de sets</Badge>}
      </div>
    </motion.div>
  )
}

function NextSession({
  templateName,
  subtitle,
  exerciseCount,
  minutes,
  paused,
  deload,
  onStart,
}: {
  templateName: string
  subtitle: string
  exerciseCount: number
  minutes: number
  paused: boolean
  deload: boolean
  onStart: () => void
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-[18px] p-5 text-white"
      style={{ background: 'linear-gradient(135deg, var(--brand-1), var(--brand-2))' }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full"
        style={{ background: 'rgb(255 255 255 / 0.11)' }}
      />
      <div className="relative">
        <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide opacity-85">
          <TrendingUp className="size-4" />
          Volgende sessie
        </div>
        <h2 className="mt-2 text-[21px] font-bold leading-tight">{templateName}</h2>
        <p className="mt-1 max-w-md text-[13px] leading-relaxed opacity-90">{subtitle}</p>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12.5px] opacity-90">
          <span className="num">{exerciseCount} ankeroefeningen</span>
          <span className="num">± {minutes} min</span>
          {deload && <span>Helft van de sets, zelfde gewicht</span>}
        </div>

        <button
          onClick={onStart}
          disabled={paused}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-[14px] font-semibold transition-transform hover:scale-[1.02] active:scale-[0.99] disabled:opacity-50"
          style={{ color: 'var(--brand-1)' }}
        >
          {paused ? 'Gepauzeerd' : 'Sessie starten'}
          {!paused && <ArrowRight className="size-4" />}
        </button>
      </div>
    </motion.section>
  )
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 text-[13px]">
      <span className="text-ink-3">{icon}</span>
      <span className="text-ink-2">{label}</span>
      <span className="num ml-auto font-semibold">{value}</span>
    </div>
  )
}
