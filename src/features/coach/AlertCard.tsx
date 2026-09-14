import { motion } from 'motion/react'
import { AlertTriangle, Info, OctagonAlert, X } from 'lucide-react'
import type { CoachAlert } from '@/domain/types'
import { Badge, SourceNote } from '@/ui/primitives'
import { useAppStore } from '@/store/useAppStore'

const SEVERITY = {
  kritiek: { tone: 'serious' as const, icon: OctagonAlert, label: 'Actie nodig' },
  'let-op': { tone: 'warn' as const, icon: AlertTriangle, label: 'Let op' },
  info: { tone: 'neutral' as const, icon: Info, label: 'Ter info' },
}

export function AlertCard({ alert, delay = 0 }: { alert: CoachAlert; delay?: number }) {
  const acknowledge = useAppStore((s) => s.acknowledgeAlert)
  const meta = SEVERITY[alert.severity]
  const Icon = meta.icon
  const accent =
    alert.severity === 'kritiek'
      ? 'var(--status-serious)'
      : alert.severity === 'let-op'
        ? 'var(--status-warn)'
        : 'var(--status-neutral)'

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.32, delay, ease: [0.22, 1, 0.36, 1] }}
      layout
      className="card relative overflow-hidden p-5 pl-6"
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-1.5" style={{ background: accent }} />

      <header className="mb-2 flex items-start gap-3">
        <Icon className="mt-0.5 size-[18px] shrink-0" style={{ color: accent }} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[14.5px] font-semibold">{alert.title}</h3>
            <Badge tone={meta.tone}>{meta.label}</Badge>
          </div>
        </div>
        <button
          onClick={() => acknowledge(alert.id)}
          aria-label="Melding sluiten"
          className="-mr-2 -mt-2 grid size-10 shrink-0 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink"
        >
          <X className="size-[18px]" />
        </button>
      </header>

      <p className="text-[13.5px] leading-relaxed text-ink-2">{alert.body}</p>

      <div className="mt-3 rounded-xl px-3.5 py-3" style={{ background: 'var(--surface-3)' }}>
        <div className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-3">Wat nu</div>
        <p className="mt-1 text-[13.5px] leading-relaxed text-ink">{alert.action}</p>
      </div>

      {alert.options && (
        <ul className="mt-3 space-y-1.5">
          {alert.options.map((option, i) => (
            <li key={i} className="flex gap-2.5 text-[13px] text-ink-2">
              <span className="num mt-px text-[11px] font-bold text-ink-3">{String.fromCharCode(65 + i)}</span>
              {option}
            </li>
          ))}
        </ul>
      )}

      <SourceNote>{alert.source}</SourceNote>
    </motion.article>
  )
}
