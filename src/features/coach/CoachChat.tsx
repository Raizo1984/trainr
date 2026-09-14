/**
 * Het gesprek met de coach.
 *
 * De coach leest je data en kan aanpassingen voorstellen. Hij past niets toe:
 * elk voorstel gaat langs dezelfde veiligheidsregels als de regelmotor, en
 * daarna beslis jij.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { AlertTriangle, ArrowUp, Bot, Check, Eraser, Info, User, X } from 'lucide-react'
import { Badge, Button, Card, SectionTitle, SourceNote, cx } from '@/ui/primitives'
import { useAppStore } from '@/store/useAppStore'
import { useCurrentPhase, useNutritionPlan, usePhaseWeek, useValidationContext } from '@/store/selectors'
import { buildCoachContext } from '@/domain/coachContext'
import { describeAdjustment, validateAdjustment } from '@/domain/adapt'
import { todayIso } from '@/domain/analytics'
import type { PlanAdjustment } from '@/domain/types'
import { CoachError, askCoach, coachStatus, type CoachMessage, type RawProposal } from './coachClient'

interface Turn extends CoachMessage {
  proposals?: PlanAdjustment[]
}

const SUGGESTIONS = [
  'Hoe ging mijn afgelopen week?',
  'Mijn knie zeurt na squatten, wat nu?',
  'Waarom staat mijn bankdrukken stil?',
  'Eet ik genoeg voor wat ik train?',
]

export function CoachChat({ delay = 0 }: { delay?: number }) {
  const state = useAppStore()
  const phase = useCurrentPhase()
  const week = usePhaseWeek()
  const plan = useNutritionPlan()
  const validation = useValidationContext()
  const propose = useAppStore((s) => s.proposeAdjustment)

  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [available, setAvailable] = useState<boolean | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    coachStatus().then((s) => setAvailable(s.available))
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [turns, busy])

  const context = useMemo(
    () => buildCoachContext(state, phase, week, plan.proteinMinG, plan.minMealsPerDay, plan.prohibited),
    [state, phase, week, plan],
  )

  const send = async (text: string) => {
    const question = text.trim()
    if (!question || busy) return

    const history: Turn[] = [...turns, { role: 'user', content: question }]
    setTurns(history)
    setInput('')
    setBusy(true)
    setError(null)

    try {
      const reply = await askCoach(
        history.map(({ role, content }) => ({ role, content })),
        context,
      )
      setTurns([
        ...history,
        {
          role: 'assistant',
          content: reply.text || 'Ik heb hier geen antwoord op kunnen formuleren.',
          proposals: reply.proposals.map(toAdjustment),
        },
      ])
    } catch (e) {
      setError(e instanceof CoachError ? e.message : 'Er ging iets mis.')
      setTurns(history)
    } finally {
      setBusy(false)
    }
  }

  if (available === false) {
    return (
      <Card delay={delay}>
        <SectionTitle title="Coach" subtitle="Nog niet geconfigureerd." right={<Bot className="size-4 text-ink-3" />} />
        <p className="text-[13.5px] leading-relaxed text-ink-2">
          De gesprekscoach heeft een API-sleutel van Anthropic nodig op de server. Zet <code className="num">ANTHROPIC_API_KEY</code>{' '}
          in de Replit Secrets en herstart. De sleutel komt nooit in de browser: alles loopt via de server.
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-3">
          Zonder sleutel werkt de rest van de app gewoon. De regelmotor stelt aanpassingen voor op basis van je logs; die heeft
          geen internet nodig.
        </p>
        <SourceNote>Sectie 8.2. De sleutel hoort op de server, niet bij de gebruiker.</SourceNote>
      </Card>
    )
  }

  return (
    <Card delay={delay}>
      <SectionTitle
        title="Coach"
        subtitle="Kijkt mee in je data. Stelt voor, past nooit zelf toe."
        right={
          turns.length > 0 ? (
            <button
              onClick={() => { setTurns([]); setError(null) }}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink"
            >
              <Eraser className="size-3.5" />
              Wissen
            </button>
          ) : (
            <Bot className="size-4 text-ink-3" />
          )
        }
      />

      {turns.length === 0 && (
        <div className="mb-4">
          <p className="mb-3 text-[13px] leading-relaxed text-ink-2">
            Ik zie je fase, je laatste sessies, je pijnwaarden, je herstel en je voeding. Vraag maar.
          </p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => send(suggestion)}
                className="rounded-full border border-line bg-surface-2 px-3 py-1.5 text-[12.5px] text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {turns.map((turn, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={cx('flex gap-2.5', turn.role === 'user' && 'justify-end')}
            >
              {turn.role === 'assistant' && (
                <span className="brand-gradient mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg text-white">
                  <Bot className="size-4" />
                </span>
              )}
              <div className={cx('min-w-0 max-w-[85%]', turn.role === 'user' && 'order-first')}>
                <div
                  className="rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed"
                  style={
                    turn.role === 'user'
                      ? { background: 'var(--brand-soft)', color: 'var(--text-primary)' }
                      : { background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }
                  }
                >
                  {turn.content.split('\n').filter(Boolean).map((line, j) => (
                    <p key={j} className={j > 0 ? 'mt-2' : undefined}>
                      {line}
                    </p>
                  ))}
                </div>

                {turn.proposals?.map((proposal) => (
                  <CoachProposal
                    key={proposal.id}
                    proposal={proposal}
                    check={validateAdjustment(proposal, validation)}
                    onAccept={() => {
                      const verdict = validateAdjustment(proposal, validation)
                      if (!verdict.allowed) return
                      propose({ ...(verdict.altered ?? proposal), accepted: true })
                    }}
                  />
                ))}
              </div>
              {turn.role === 'user' && (
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-surface-3 text-ink-3">
                  <User className="size-4" />
                </span>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {busy && (
          <div className="flex items-center gap-2.5 text-[13px] text-ink-3">
            <span className="brand-gradient grid size-7 shrink-0 place-items-center rounded-lg text-white">
              <Bot className="size-4" />
            </span>
            <span className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="size-1.5 rounded-full"
                  style={{ background: 'var(--text-muted)' }}
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.15 }}
                />
              ))}
            </span>
          </div>
        )}

        {error && (
          <div
            className="flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-[13px] leading-relaxed"
            style={{ background: 'var(--status-warn-soft)', color: 'var(--status-warn)' }}
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            {error}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send(input) }}
        className="mt-4 flex items-end gap-2"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) }
          }}
          rows={1}
          placeholder="Stel je vraag"
          className="input min-h-[44px] flex-1 resize-none"
        />
        <button
          type="submit"
          disabled={busy || input.trim().length === 0}
          aria-label="Versturen"
          className="brand-gradient grid size-11 shrink-0 place-items-center rounded-xl text-white transition-transform active:scale-95 disabled:opacity-40"
        >
          <ArrowUp className="size-5" />
        </button>
      </form>

      <p className="mt-2.5 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-ink-3">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        De coach krijgt een samenvatting van je trainings-, pijn- en voedingsdata. Geen naam, geen vrije notities. Hij stelt
        voor; de veiligheidsregels en jij beslissen.
      </p>
    </Card>
  )
}

function toAdjustment(raw: RawProposal): PlanAdjustment {
  return {
    id: `coach-${crypto.randomUUID()}`,
    kind: raw.kind,
    ladderId: raw.ladderId || undefined,
    amount: raw.amount,
    repMin: raw.repMin,
    repMax: raw.repMax,
    reason: raw.reason,
    source: 'coach',
    createdAt: todayIso(),
    expiresAfterWeeks: raw.expiresAfterWeeks,
    accepted: false,
  }
}

function CoachProposal({
  proposal,
  check,
  onAccept,
}: {
  proposal: PlanAdjustment
  check: { allowed: boolean; reason: string; altered?: PlanAdjustment }
  onAccept: () => void
}) {
  const [handled, setHandled] = useState<'toegepast' | 'afgewezen' | null>(null)
  const shown = check.altered ?? proposal

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-2 card-quiet p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="brand">Voorstel</Badge>
        <span className="text-[13px] font-semibold">{describeAdjustment(shown)}</span>
      </div>

      {check.altered && (
        <p className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: 'var(--status-warn)' }}>
          Bijgesteld door de veiligheidsregels: {check.reason}
        </p>
      )}
      {!check.allowed && (
        <p className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: 'var(--status-serious)' }}>
          Geblokkeerd: {check.reason}
        </p>
      )}

      {handled ? (
        <p className="mt-2 text-[12.5px] font-medium text-ink-3">
          {handled === 'toegepast' ? 'Toegepast. Je vindt het terug bij Plan.' : 'Niet toegepast.'}
        </p>
      ) : (
        <div className="mt-2.5 flex gap-2">
          <Button
            size="sm"
            variant="primary"
            disabled={!check.allowed}
            onClick={() => { onAccept(); setHandled('toegepast') }}
            icon={<Check className="size-4" />}
          >
            Toepassen
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setHandled('afgewezen')} icon={<X className="size-4" />}>
            Niet doen
          </Button>
        </div>
      )}
    </motion.div>
  )
}
