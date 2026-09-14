/**
 * Voedingsintelligentie (sectie 5).
 *
 * Kernonderscheid: bij laag risico mogen calorieën zichtbaar zijn als
 * informatie. Bij hoog risico stuurt de app uitsluitend op ondergrenzen en
 * blokkeert het elk beperkend mechanisme. Dat verschil zit in `NutritionPlan`,
 * niet in losse UI-checks, zodat het niet per ongeluk omzeild kan worden.
 */

import type { IntakeData, NutritionAlert, NutritionDay, NutritionPlan } from './types'
import { average, movingAverage, round1 } from './analytics'

/** Signaalwoorden uit sectie 9.3. Bewust breed, met een vriendelijke eerste reactie. */
const RESTRICTIVE_TERMS = [
  'calorie',
  'kcal',
  'vasten',
  'fasten',
  'omad',
  'keto',
  'crash',
  'deficit',
  'cut',
  'droog',
  'strenger',
  'minder eten',
  'overslaan',
  'skip',
  'detox',
  'eetvenster',
]

export function detectRestrictiveLanguage(text: string): string[] {
  const lower = text.toLowerCase()
  return RESTRICTIVE_TERMS.filter((term) => lower.includes(term))
}

/**
 * Eiwitdoel volgens Helms: 1,6 tot 2,2 gram per kilo lichaamsgewicht.
 * Zonder bekend gewicht valt de app terug op een veilige ondergrens.
 */
export function proteinRange(bodyweightKg: number | null): { min: number; target: number } {
  if (!bodyweightKg || bodyweightKg <= 0) return { min: 100, target: 130 }
  return { min: Math.round(bodyweightKg * 1.6), target: Math.round(bodyweightKg * 2.0) }
}

export function buildNutritionPlan(intake: IntakeData, model: NutritionPlan['model']): NutritionPlan {
  const bodyweight = intake.nutrition.weightCurrentKg
  const { min, target } = proteinRange(bodyweight)
  const highRisk = model === 'hoog-risico'

  return {
    model,
    proteinMinG: min,
    proteinTargetG: target,
    minMealsPerDay: 3,
    showCalories: !highRisk,
    prohibited: highRisk
      ? [
          'Calorieën tellen of een caloriedoel stellen',
          'Eetvensters en intermittent fasting',
          'Vastenexperimenten, ook één dag',
          'Caloriedeficiet als experiment',
          'Keto, IF of OMAD tijdens een opbouwfase',
          'Op eigen initiatief strenger worden',
        ]
      : [],
    guardrails: highRisk
      ? [
          'Minimaal drie maaltijden per dag, dat is geen richtlijn maar een ondergrens',
          `Eiwit exact meten: minimaal ${min} gram per dag`,
          'Eten rond de training is verplicht, niet optioneel',
          'Weekplanning vooraf, bij voorkeur samen met het huishouden',
          'Gewicht wordt op een gemiddelde van vier weken beoordeeld, nooit per dag',
        ]
      : [
          `Eiwit ${min} tot ${target} gram per dag, verdeeld over 30 tot 50 gram per moment`,
          'Minimaal drie maaltijden per dag',
          'Koolhydraten en eiwit rond de training',
          'Calorieën zijn informatie, geen limiet',
          'Gewichtstrend beoordelen op vier weken, niet per dag',
        ],
    dietitianRequired: highRisk,
  }
}

/** Gewichtstrend over de laatste vier weken, in kilo per week. */
export function weightTrendPerWeek(days: NutritionDay[]): number | null {
  const points = days
    .filter((d) => d.weightKg !== null)
    .slice(-28)
    .map((d) => ({ date: Date.parse(d.date), kg: d.weightKg as number }))
  if (points.length < 4) return null

  const smoothed = movingAverage(points.map((p) => p.kg), 7)
  const first = smoothed[0]
  const last = smoothed[smoothed.length - 1]
  const weeks = (points[points.length - 1].date - points[0].date) / (7 * 86_400_000)
  if (weeks <= 0) return null
  return round1((last - first) / weeks)
}

export function proteinAverage(days: NutritionDay[], window = 7): number | null {
  const values = days.slice(-window).map((d) => d.proteinG)
  const avg = average(values)
  return avg === null ? null : Math.round(avg)
}

/**
 * Wekelijkse voedingsfeedback (sectie 5.2) plus de beschermingslagen uit
 * sectie 9.3. De niveaus 1-4 komen letterlijk uit dat alarmsysteem.
 */
export function evaluateNutrition(
  plan: NutritionPlan,
  days: NutritionDay[],
  context: { strengthDeclining: boolean; phaseIsBuilding: boolean },
): NutritionAlert[] {
  const alerts: NutritionAlert[] = []
  const protein = proteinAverage(days)
  const trend = weightTrendPerWeek(days)
  const highRisk = plan.model === 'hoog-risico'

  if (protein !== null) {
    if (protein < plan.proteinMinG * 0.9) {
      alerts.push({
        level: highRisk ? 2 : 1,
        title: 'Eiwit blijft achter',
        message: `Gemiddeld ${protein} gram per dag, tegen een ondergrens van ${plan.proteinMinG} gram. Dat remt herstel voordat het training remt.`,
        action: 'Voeg vanavond één portie toe: 150 gram kwark, 200 gram yoghurt met een scoop eiwit, of 120 gram kip.',
      })
    } else if (protein < plan.proteinMinG) {
      alerts.push({
        level: 1,
        title: 'Eiwit net onder de grens',
        message: `Gemiddeld ${protein} gram per dag. Je zit er dicht tegenaan, maar nog niet overheen.`,
        action: 'Eén extra eiwitmoment per dag is genoeg. Meestal is het ontbijt de makkelijkste plek.',
      })
    }
  }

  const lowMealDays = days.slice(-7).filter((d) => d.meals > 0 && d.meals < plan.minMealsPerDay)
  if (lowMealDays.length >= 2) {
    alerts.push({
      level: highRisk ? 3 : 2,
      title: 'Maaltijden overgeslagen',
      message: `${lowMealDays.length} van de laatste zeven dagen onder de ${plan.minMealsPerDay} maaltijden.`,
      action: highRisk
        ? 'Dit is een ondergrens, geen richtlijn. Plan de week vooruit en bespreek dit bij de eerstvolgende check met de diëtist.'
        : 'Zet de drie vaste momenten in je agenda. Structuur werkt beter dan wilskracht.',
    })
  }

  if (trend !== null) {
    if (trend <= -0.7 && context.phaseIsBuilding) {
      alerts.push({
        level: highRisk ? 3 : 2,
        title: 'Gewicht daalt te snel',
        message: `Trend ${trend} kg per week terwijl je in een opbouwfase zit. Dat gaat ten koste van spier en herstel.`,
        action: 'Voeg voeding toe, geen cardio. Bij hoog risico: neem dit binnen een week op met je diëtist.',
      })
    } else if (trend <= -0.5) {
      alerts.push({
        level: 2,
        title: 'Dalende gewichtstrend',
        message: `Trend ${trend} kg per week over vier weken.`,
        action: 'Controleer of dit bewust is. Zo niet, dan komt er voeding bij.',
      })
    } else if (trend >= 1) {
      alerts.push({
        level: 1,
        title: 'Gewicht stijgt snel',
        message: `Trend +${trend} kg per week. Boven ongeveer 0,5 kg per week komt er relatief veel vet bij.`,
        action: 'Houd de wandelingen erin en controleer of de portiegroottes kloppen. Niets drastisch.',
      })
    }
  }

  if (context.strengthDeclining && protein !== null && protein < plan.proteinTargetG) {
    alerts.push({
      level: highRisk ? 4 : 3,
      title: 'Prestatie zakt terwijl voeding krap is',
      message:
        'Kracht loopt terug en het eiwit zit onder het doel. Dit is de combinatie waarbij doortrainen het probleem groter maakt.',
      action:
        'Eerst voeding op orde, dan pas verder bouwen. Tot die tijd draait het programma op onderhoud.',
    })
  }

  const notes = days.slice(-14).map((d) => d.note ?? '').join(' ')
  const hits = detectRestrictiveLanguage(notes)
  if (highRisk && hits.length > 0) {
    alerts.push({
      level: hits.length >= 2 ? 3 : 1,
      title: 'Signaalwoorden in je notities',
      message: `Ik zie terugkomen: ${[...new Set(hits)].join(', ')}. Dat zijn de patronen waar we samen afspraken over hebben gemaakt.`,
      action:
        hits.length >= 2
          ? 'Plan deze week contact met je diëtist. De app past intussen niets aan naar beneden.'
          : 'Vriendelijke herinnering aan het plan: ondergrenzen, geen beperking.',
    })
  }

  return alerts.sort((a, b) => b.level - a.level)
}

/** Aanbevolen supplementen (sectie 5.3), gefilterd op de situatie van de gebruiker. */
export interface SupplementAdvice {
  tier: 1 | 2 | 3 | 4
  name: string
  dose: string
  rationale: string
  recommended: boolean
}

export const SUPPLEMENTS: SupplementAdvice[] = [
  { tier: 1, name: 'Creatine monohydraat', dose: '5 gram per dag, geen laadfase', rationale: 'Best onderbouwde supplement voor kracht en spiermassa. Reken op ongeveer 1 kg extra watergewicht in de spier, dat is geen vet.', recommended: true },
  { tier: 1, name: 'Vitamine D3', dose: '20-25 mcg per dag in het winterhalfjaar', rationale: 'In Nederland loopt de status van oktober tot april structureel terug.', recommended: true },
  { tier: 1, name: 'Basismultivitamine', dose: 'Alleen bij aantoonbare gaten in het eetpatroon', rationale: 'Vult tekorten, vervangt geen voeding.', recommended: true },
  { tier: 1, name: 'Hooggedoseerde antioxidanten', dose: 'Niet gebruiken rond training', rationale: 'Remt juist de aanpassing die je met trainen probeert op te wekken.', recommended: false },
  { tier: 2, name: 'Collageen of gelatine met vitamine C', dose: '15 gram, 45 minuten voor peesbelasting', rationale: 'Onbewezen maar veilig. Relevant bij peesklachten (Low).', recommended: true },
  { tier: 2, name: 'Eiwitpoeder', dose: 'Naar behoefte, als gemak', rationale: 'Handig, niet superieur aan gewoon eten.', recommended: true },
  { tier: 2, name: 'Elektrolyten', dose: 'Bij fors zweten', rationale: 'Alleen functioneel bij echt vochtverlies.', recommended: true },
  { tier: 3, name: 'Magnesium', dose: '200-400 mg voor het slapen', rationale: 'Kan slaapkwaliteit helpen, effect is bescheiden.', recommended: true },
  { tier: 3, name: 'Omega 3', dose: '1-2 gram EPA/DHA per dag', rationale: 'Alleen zinvol als je nauwelijks vis eet.', recommended: true },
  { tier: 4, name: 'Testosteronboosters', dose: 'Niet gebruiken', rationale: 'Geen effect bij een normale hormoonstatus.', recommended: false },
  { tier: 4, name: 'Vetverbranders', dose: 'Niet gebruiken', rationale: 'Marginaal effect, reëel risico, en precies het verkeerde signaal.', recommended: false },
  { tier: 4, name: 'Pre-workout met hoge dosis stimulantia', dose: 'Hooguit incidenteel en licht', rationale: 'Verstoort slaap, en slaap is waar herstel vandaan komt.', recommended: false },
]

export function supplementsFor(plan: NutritionPlan): SupplementAdvice[] {
  if (plan.model !== 'hoog-risico') return SUPPLEMENTS
  // Bij hoog risico verdwijnt alles wat op gewichtsmanipulatie lijkt volledig uit beeld.
  return SUPPLEMENTS.filter((s) => !s.name.toLowerCase().includes('vetverbrander'))
}
