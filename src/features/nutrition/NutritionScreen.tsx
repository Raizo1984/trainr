/**
 * Voeding (sectie 5). Het scherm verschilt wezenlijk per risicoprofiel:
 * bij hoog risico zijn calorieën, eetvensters en gewichtsdoelen volledig
 * afwezig in de interface, niet alleen ontraden.
 */

import { useState } from 'react'
import { motion } from 'motion/react'
import { Ban, CircleCheck, Pill, ShieldCheck, TrendingUp, UtensilsCrossed } from 'lucide-react'
import { Badge, Button, Card, Field, NumberInput, ScalePicker, SectionTitle, SourceNote, Stat, TextArea } from '@/ui/primitives'
import { WeightChart } from '@/ui/charts'
import { useAppStore } from '@/store/useAppStore'
import { useNutritionAlerts, useNutritionPlan } from '@/store/selectors'
import { proteinAverage, supplementsFor, weightTrendPerWeek } from '@/domain/nutrition'
import { todayIso, trailingAverage } from '@/domain/analytics'
import type { Scale5 } from '@/domain/types'

export default function NutritionScreen() {
  const plan = useNutritionPlan()
  const days = useAppStore((s) => s.nutritionDays)
  const addDay = useAppStore((s) => s.addNutritionDay)
  const alerts = useNutritionAlerts()

  const today = days.find((d) => d.date === todayIso())
  const [protein, setProtein] = useState<number | null>(today?.proteinG ?? null)
  const [meals, setMeals] = useState<number | null>(today?.meals ?? plan.minMealsPerDay)
  const [weight, setWeight] = useState<number | null>(today?.weightKg ?? null)
  const [energy, setEnergy] = useState<Scale5>((today?.energy as Scale5) ?? 3)
  const [note, setNote] = useState(today?.note ?? '')

  const average = proteinAverage(days)
  const trend = weightTrendPerWeek(days)
  const highRisk = plan.model === 'hoog-risico'

  // Trend over zeven dagen, berekend over de hele reeks en daarna afgesneden,
  // zodat de eerste zichtbare dagen al een volledig venster achter zich hebben.
  const trendSeries = trailingAverage(days.map((d) => d.weightKg), 7)
  const chartData = days.slice(-42).map((day, i) => {
    const index = Math.max(0, days.length - Math.min(days.length, 42)) + i
    const trend = trendSeries[index]
    return {
      date: day.date,
      gewicht: day.weightKg,
      trend: trend === null ? null : Math.round(trend * 10) / 10,
    }
  })

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3 pb-1">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight">Voeding</h1>
          <p className="mt-0.5 text-[13.5px] text-ink-3">
            {highRisk
              ? 'Beschermend model: alleen ondergrenzen, geen beperking.'
              : 'Eiwit als doel, gewicht als trend, calorieën als informatie.'}
          </p>
        </div>
        <Badge tone={highRisk ? 'warn' : 'good'}>{highRisk ? 'Beschermend' : 'Standaard'}</Badge>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Eiwit, 7-daags"
          value={average ?? '—'}
          unit="g"
          tone={average === null ? 'neutral' : average >= plan.proteinMinG ? 'good' : 'warn'}
          hint={`Ondergrens ${plan.proteinMinG} g, doel ${plan.proteinTargetG} g`}
        />
        <Stat
          label="Gewichtstrend"
          value={trend === null ? '—' : `${trend > 0 ? '+' : ''}${trend}`}
          unit="kg/wk"
          tone={trend === null ? 'neutral' : trend <= -0.5 ? 'serious' : trend >= 1 ? 'warn' : 'good'}
          hint="Gemiddelde over vier weken, nooit per dag beoordeeld"
          delay={0.05}
        />
        <Stat
          label="Maaltijden"
          value={days.slice(-7).filter((d) => d.meals >= plan.minMealsPerDay).length}
          unit={`/ ${Math.min(7, days.slice(-7).length)} dagen op norm`}
          tone="neutral"
          hint={`Ondergrens ${plan.minMealsPerDay} per dag`}
          delay={0.1}
        />
      </div>

      {alerts.length > 0 && (
        <Card delay={0.12}>
          <SectionTitle title="Signalen" subtitle="Elk signaal eindigt in iets dat je vandaag kunt doen." />
          <div className="space-y-2.5">
            {alerts.map((alert, i) => (
              <div
                key={i}
                className="rounded-xl px-4 py-3"
                style={{ background: alert.level >= 3 ? 'var(--status-serious-soft)' : 'var(--surface-2)' }}
              >
                <div className="text-[13.5px] font-semibold">{alert.title}</div>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{alert.message}</p>
                <p className="mt-1.5 text-[13px] font-medium">{alert.action}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card delay={0.16}>
        <SectionTitle title="Vandaag loggen" subtitle="Eiwit exact, de rest op gevoel. Meer hoeft niet." right={<UtensilsCrossed className="size-4 text-ink-3" />} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Eiwit" hint={`Doel: ${plan.proteinMinG} tot ${plan.proteinTargetG} gram`}>
            <NumberInput value={protein} onChange={setProtein} suffix="g" placeholder="150" />
          </Field>
          <Field label="Maaltijden" hint={highRisk ? 'Dit is een ondergrens, geen richtlijn.' : undefined}>
            <NumberInput value={meals} onChange={setMeals} min={0} max={8} />
          </Field>
          <Field label="Gewicht" hint="Ochtend, na toiletbezoek, voor het eten. Eén keer.">
            <NumberInput value={weight} onChange={setWeight} suffix="kg" />
          </Field>
          <Field label={`Energie: ${energy}/5`}>
            <ScalePicker value={energy} min={1} max={5} onChange={(v) => setEnergy(v as Scale5)} labels={['leeg', 'vol']} />
          </Field>
        </div>
        <Field label="Notitie">
          <TextArea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Wat viel op vandaag?" />
        </Field>
        <Button
          variant="primary"
          className="mt-4 w-full"
          disabled={protein === null}
          onClick={() => {
            if (protein === null) return
            addDay({ date: todayIso(), proteinG: protein, meals: meals ?? 0, weightKg: weight, energy, note: note || undefined })
          }}
        >
          Dag opslaan
        </Button>
      </Card>

      {chartData.filter((d) => d.gewicht !== null).length >= 4 && (
        <Card delay={0.2}>
          <SectionTitle title="Gewichtsverloop" subtitle="De trendlijn telt, niet de dagwaarde." right={<TrendingUp className="size-4 text-ink-3" />} />
          <WeightChart data={chartData} />
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card delay={0.24}>
          <SectionTitle title="Jouw kaders" subtitle="Deze regels volgen uit je intake." right={<ShieldCheck className="size-4 text-ink-3" />} />
          <ul className="space-y-2">
            {plan.guardrails.map((rule, i) => (
              <li key={i} className="flex gap-2.5 text-[13.5px] leading-relaxed text-ink-2">
                <CircleCheck className="mt-0.5 size-4 shrink-0" style={{ color: 'var(--status-good)' }} />
                {rule}
              </li>
            ))}
          </ul>
          {plan.dietitianRequired && (
            <p className="mt-3.5 rounded-xl px-3.5 py-3 text-[13px] leading-relaxed" style={{ background: 'var(--status-warn-soft)', color: 'var(--status-warn)' }}>
              Samenwerking met een diëtist is bij jouw profiel geen optie maar onderdeel van het plan. Check elke twee tot
              vier weken, en laat het trainingsplan meelezen.
            </p>
          )}
          <SourceNote>Sectie 5.1.</SourceNote>
        </Card>

        {plan.prohibited.length > 0 && (
          <Card delay={0.28}>
            <SectionTitle title="Expliciet niet" subtitle="Niet ontraden, maar buiten de app gehouden." right={<Ban className="size-4" style={{ color: 'var(--status-serious)' }} />} />
            <ul className="space-y-2">
              {plan.prohibited.map((rule, i) => (
                <li key={i} className="flex gap-2.5 text-[13.5px] leading-relaxed text-ink-2">
                  <Ban className="mt-0.5 size-4 shrink-0" style={{ color: 'var(--status-serious)' }} />
                  {rule}
                </li>
              ))}
            </ul>
            <SourceNote>Sectie 5.1, hoog-risicoprotocol.</SourceNote>
          </Card>
        )}
      </div>

      <Supplements />
    </div>
  )
}

function Supplements() {
  const plan = useNutritionPlan()
  const list = supplementsFor(plan)
  const tiers = [1, 2, 3, 4] as const
  const TIER_LABEL: Record<number, string> = {
    1: 'Kern — zinvol voor bijna iedereen',
    2: 'Optioneel — in specifieke situaties',
    3: 'Voorwaardelijk — fase- of probleemgebonden',
    4: 'Uitdrukkelijk niet aangeraden',
  }

  return (
    <Card delay={0.32}>
      <SectionTitle title="Supplementen" subtitle="Evidence-based, in vier lagen. Wat er niet in staat, staat er bewust niet in." right={<Pill className="size-4 text-ink-3" />} />
      <div className="space-y-4">
        {tiers.map((tier) => {
          const items = list.filter((s) => s.tier === tier)
          if (items.length === 0) return null
          return (
            <div key={tier}>
              <div className="mb-2 text-[11.5px] font-semibold uppercase tracking-wide text-ink-3">{TIER_LABEL[tier]}</div>
              <div className="space-y-2">
                {items.map((item) => (
                  <motion.div key={item.name} layout className="card-quiet flex items-start gap-3 px-3.5 py-3">
                    <span
                      className="mt-1 size-2 shrink-0 rounded-full"
                      style={{ background: item.recommended ? 'var(--status-good)' : 'var(--status-serious)' }}
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-[13.5px] font-semibold">{item.name}</span>
                        <span className="num text-[12px] text-ink-3">{item.dose}</span>
                      </div>
                      <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-2">{item.rationale}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      <SourceNote>Sectie 5.3.</SourceNote>
    </Card>
  )
}
