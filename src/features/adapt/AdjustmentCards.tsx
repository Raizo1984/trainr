/**
 * Voorstellen en actieve planaanpassingen.
 *
 * Een voorstel verandert niets tot de gebruiker het accepteert, en een
 * geaccepteerde aanpassing is altijd zichtbaar en in te trekken. Een coach die
 * ongevraagd je plan herschrijft is geen coach maar een verrassing.
 */

import { AnimatePresence, motion } from 'motion/react'
import { Check, ShieldCheck, Sparkles, Undo2, X } from 'lucide-react'
import { Badge, Button, Card, SectionTitle, SourceNote } from '@/ui/primitives'
import { useAppStore } from '@/store/useAppStore'
import { useActiveAdjustments, usePendingProposals, useValidationContext } from '@/store/selectors'
import { describeAdjustment, validateAdjustment } from '@/domain/adapt'
import type { PlanAdjustment } from '@/domain/types'

export function ProposalsCard({ delay = 0 }: { delay?: number }) {
  const proposals = usePendingProposals()
  const propose = useAppStore((s) => s.proposeAdjustment)
  const accept = useAppStore((s) => s.acceptAdjustment)
  const reject = useAppStore((s) => s.rejectAdjustment)
  const ctx = useValidationContext()

  if (proposals.length === 0) return null

  return (
    <Card delay={delay}>
      <SectionTitle
        title="Voorgestelde aanpassingen"
        subtitle="Uit je logs afgeleid. Er verandert niets tot je op toepassen klikt."
        right={<Sparkles className="size-4 text-ink-3" />}
      />
      <div className="space-y-2.5">
        <AnimatePresence mode="popLayout">
          {proposals.map((proposal, i) => (
            <ProposalRow
              key={proposal.id}
              proposal={proposal}
              index={i}
              check={validateAdjustment(proposal, ctx)}
              onAccept={() => {
                const verdict = validateAdjustment(proposal, ctx)
                if (!verdict.allowed) return
                const final = verdict.altered ?? proposal
                propose({ ...final, accepted: true })
                accept(final.id)
              }}
              onReject={() => reject(proposal.id)}
            />
          ))}
        </AnimatePresence>
      </div>
      <SourceNote>Secties 4.3 en 6.3. Elke aanpassing gaat eerst langs de veiligheidsregels.</SourceNote>
    </Card>
  )
}

function ProposalRow({
  proposal,
  index,
  check,
  onAccept,
  onReject,
}: {
  proposal: PlanAdjustment
  index: number
  check: { allowed: boolean; reason: string; altered?: PlanAdjustment }
  onAccept: () => void
  onReject: () => void
}) {
  const shown = check.altered ?? proposal

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className="card-quiet p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13.5px] font-semibold">{describeAdjustment(shown)}</span>
        <Badge tone={proposal.source === 'coach' ? 'brand' : 'neutral'}>
          {proposal.source === 'coach' ? 'Coach' : 'Regel'}
        </Badge>
      </div>

      <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{proposal.reason}</p>

      {check.altered && (
        <p
          className="mt-2 rounded-lg px-3 py-2 text-[12.5px] leading-relaxed"
          style={{ background: 'var(--status-warn-soft)', color: 'var(--status-warn)' }}
        >
          Aangepast door de veiligheidsregels: {check.reason}
        </p>
      )}

      {!check.allowed && (
        <p
          className="mt-2 rounded-lg px-3 py-2 text-[12.5px] leading-relaxed"
          style={{ background: 'var(--status-serious-soft)', color: 'var(--status-serious)' }}
        >
          Geblokkeerd: {check.reason}
        </p>
      )}

      {proposal.expiresAfterWeeks !== undefined && check.allowed && (
        <p className="mt-2 text-[12px] text-ink-3">
          Vervalt vanzelf na {proposal.expiresAfterWeeks} weken.
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="primary" onClick={onAccept} disabled={!check.allowed} icon={<Check className="size-4" />}>
          Toepassen
        </Button>
        <Button size="sm" variant="ghost" onClick={onReject} icon={<X className="size-4" />}>
          Niet doen
        </Button>
      </div>
    </motion.div>
  )
}

export function ActiveAdjustmentsCard({ delay = 0 }: { delay?: number }) {
  const active = useActiveAdjustments()
  const revoke = useAppStore((s) => s.revokeAdjustment)

  if (active.length === 0) return null

  return (
    <Card delay={delay}>
      <SectionTitle
        title="Actieve aanpassingen"
        subtitle="Dit wijkt op dit moment af van het standaardprogramma."
        right={<ShieldCheck className="size-4 text-ink-3" />}
      />
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {active.map((adjustment) => (
            <motion.div
              key={adjustment.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -16 }}
              className="card-quiet flex items-start gap-3 px-3.5 py-3"
            >
              <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: 'var(--brand-2)' }} />
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-semibold">{describeAdjustment(adjustment)}</div>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-3">{adjustment.reason}</p>
                <p className="mt-1 text-[11.5px] text-ink-3">
                  Sinds {adjustment.createdAt}
                  {adjustment.expiresAfterWeeks !== undefined && ` · vervalt na ${adjustment.expiresAfterWeeks} weken`}
                </p>
              </div>
              <button
                onClick={() => revoke(adjustment.id)}
                aria-label="Aanpassing intrekken"
                className="grid size-10 shrink-0 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink"
              >
                <Undo2 className="size-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Card>
  )
}
