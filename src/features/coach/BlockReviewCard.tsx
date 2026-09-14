/**
 * Blokevaluatie in de deloadweek (sectie 6.3).
 * De beslisboom levert precies één aanpassing op, want twee tegelijk maakt
 * onvindbaar wat werkte.
 */

import { motion } from 'motion/react'
import { ClipboardCheck, Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { Badge, Card, SectionTitle, SourceNote } from '@/ui/primitives'
import { useBlockReview } from '@/store/selectors'
import type { BlockDecision, BlockMetric } from '@/domain/blockReview'

const DECISION_TONE: Record<BlockDecision, 'good' | 'warn' | 'serious' | 'neutral'> = {
  doorgaan: 'good',
  'oefening-vervangen': 'warn',
  'plateau-onderzoeken': 'neutral',
  regressie: 'serious',
  'planning-aanpassen': 'warn',
}

const DECISION_LABEL: Record<BlockDecision, string> = {
  doorgaan: 'Doorgaan',
  'oefening-vervangen': 'Oefening vervangen',
  'plateau-onderzoeken': 'Plateau',
  regressie: 'Regressie',
  'planning-aanpassen': 'Planning aanpassen',
}

export function BlockReviewCard({ delay = 0 }: { delay?: number }) {
  const review = useBlockReview()
  if (!review) return null

  return (
    <Card delay={delay}>
      <SectionTitle
        title="Blokevaluatie"
        subtitle={`${review.sessionCount} sessies over ${review.weeks} weken`}
        right={<ClipboardCheck className="size-4 text-ink-3" />}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h3 className="text-[15px] font-semibold">{review.headline}</h3>
        <Badge tone={DECISION_TONE[review.decision]}>{DECISION_LABEL[review.decision]}</Badge>
      </div>

      <div className="space-y-2">
        {review.metrics.map((metric, i) => (
          <MetricRow key={metric.label} metric={metric} index={i} />
        ))}
      </div>

      <div className="mt-4 rounded-xl px-4 py-3" style={{ background: 'var(--surface-3)' }}>
        <div className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-3">Waarom</div>
        <p className="mt-1 text-[13.5px] leading-relaxed">{review.reasoning}</p>
      </div>

      <div className="mt-2.5 rounded-xl px-4 py-3" style={{ background: 'var(--brand-soft)' }}>
        <div className="text-[11.5px] font-semibold uppercase tracking-wide" style={{ color: 'var(--brand-2)' }}>
          Eén aanpassing voor het volgende blok
        </div>
        <p className="mt-1 text-[13.5px] leading-relaxed text-ink">{review.action}</p>
      </div>

      {review.problemExercises.length > 0 && (
        <div className="mt-3">
          <div className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-ink-3">
            Oefeningen die aandacht vragen
          </div>
          <ul className="space-y-1">
            {review.problemExercises.map((problem) => (
              <li key={problem.ladderId} className="flex flex-wrap gap-x-2 text-[13px]">
                <span className="font-medium">{problem.name}</span>
                <span className="text-ink-3">{problem.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <SourceNote>Sectie 6.3, blokevaluatie met beslisboom.</SourceNote>
    </Card>
  )
}

function MetricRow({ metric, index }: { metric: BlockMetric; index: number }) {
  const Icon = metric.trend === 'op' ? TrendingUp : metric.trend === 'af' ? TrendingDown : Minus
  const color =
    metric.trend === 'op'
      ? 'var(--status-good)'
      : metric.trend === 'af'
        ? 'var(--status-serious)'
        : 'var(--text-muted)'

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04, duration: 0.28 }}
      className="card-quiet flex items-start gap-3 px-3.5 py-2.5"
    >
      <Icon className="mt-0.5 size-4 shrink-0" style={{ color }} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-[13.5px] font-medium">{metric.label}</span>
          <span className="num text-[12.5px] text-ink-2">{metric.value}</span>
        </div>
        <p className="mt-0.5 text-[12.5px] leading-snug text-ink-3">{metric.comment}</p>
      </div>
    </motion.div>
  )
}
