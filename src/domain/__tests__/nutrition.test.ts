import { describe, expect, it } from 'vitest'
import { buildNutritionPlan, detectRestrictiveLanguage, evaluateNutrition, proteinRange, weightTrendPerWeek } from '../nutrition'
import { intakeWith } from './factories'
import type { NutritionDay } from '../types'

const ctx = { strengthDeclining: false, phaseIsBuilding: true }

function days(values: Array<Partial<NutritionDay>>): NutritionDay[] {
  return values.map((v, i) => ({
    date: `2026-01-${String(i + 1).padStart(2, '0')}`,
    proteinG: 150,
    meals: 3,
    weightKg: null,
    energy: 4,
    ...v,
  }))
}

describe('voedingsmodel', () => {
  it('berekent het eiwitbereik volgens Helms', () => {
    expect(proteinRange(80)).toEqual({ min: 128, target: 160 })
    expect(proteinRange(null).min).toBeGreaterThan(0)
  })

  it('verbergt calorieën en verbiedt beperkende mechanismen bij hoog risico', () => {
    const plan = buildNutritionPlan(intakeWith((i) => { i.nutrition.weightCurrentKg = 80 }), 'hoog-risico')
    expect(plan.showCalories).toBe(false)
    expect(plan.dietitianRequired).toBe(true)
    expect(plan.prohibited.join(' ')).toMatch(/vasten/i)
    expect(plan.prohibited.join(' ')).toMatch(/calorie/i)
  })

  it('toont calorieën als informatie bij laag risico', () => {
    const plan = buildNutritionPlan(intakeWith((i) => { i.nutrition.weightCurrentKg = 80 }), 'laag-risico')
    expect(plan.showCalories).toBe(true)
    expect(plan.prohibited).toHaveLength(0)
  })
})

describe('voedingssignalering', () => {
  const plan = buildNutritionPlan(intakeWith((i) => { i.nutrition.weightCurrentKg = 80 }), 'laag-risico')

  it('meldt achterblijvend eiwit met een concrete oplossing', () => {
    const alerts = evaluateNutrition(plan, days(Array(7).fill({ proteinG: 90 })), ctx)
    const hit = alerts.find((a) => a.title.includes('Eiwit'))
    expect(hit).toBeDefined()
    expect(hit?.action).toMatch(/kwark|yoghurt|kip/i)
  })

  it('signaleert overgeslagen maaltijden', () => {
    const alerts = evaluateNutrition(plan, days([{ meals: 2 }, { meals: 1 }, {}, {}, {}, {}, {}]), ctx)
    expect(alerts.some((a) => a.title.includes('Maaltijden'))).toBe(true)
  })

  it('grijpt in bij te snel gewichtsverlies in een opbouwfase', () => {
    const list = days(
      Array.from({ length: 28 }, (_, i) => ({ weightKg: 85 - i * 0.15 })),
    )
    const alerts = evaluateNutrition(plan, list, ctx)
    expect(alerts.some((a) => a.title.includes('te snel'))).toBe(true)
  })

  it('escaleert naar niveau 4 als kracht zakt terwijl voeding krap is bij hoog risico', () => {
    const highRisk = buildNutritionPlan(intakeWith((i) => { i.nutrition.weightCurrentKg = 80 }), 'hoog-risico')
    const alerts = evaluateNutrition(highRisk, days(Array(7).fill({ proteinG: 130 })), {
      strengthDeclining: true,
      phaseIsBuilding: true,
    })
    expect(alerts[0].level).toBe(4)
  })

  it('herkent signaalwoorden alleen als interventie bij hoog risico', () => {
    expect(detectRestrictiveLanguage('Ik ga even vasten en calorieën tellen').length).toBeGreaterThan(1)
    const lowRisk = evaluateNutrition(plan, days([{ note: 'ga vasten' }]), ctx)
    expect(lowRisk.some((a) => a.title.includes('Signaalwoorden'))).toBe(false)
    const highRisk = buildNutritionPlan(intakeWith(() => {}), 'hoog-risico')
    const result = evaluateNutrition(highRisk, days([{ note: 'ik ga vasten en minder eten' }]), ctx)
    expect(result.some((a) => a.title.includes('Signaalwoorden'))).toBe(true)
  })

  it('geeft geen trend terug bij te weinig metingen', () => {
    expect(weightTrendPerWeek(days([{ weightKg: 80 }, { weightKg: 80 }]))).toBeNull()
  })
})
