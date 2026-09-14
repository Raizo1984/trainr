/**
 * Signaleringen en veiligheidssystemen.
 * Bron: sectie 4.3 (triggers 1-5), sectie 9.1 (rode vlaggen) en 9.2 (overbelasting).
 *
 * Alle regels leveren een `CoachAlert` met een concrete handeling. Een melding
 * zonder actie is ruis, en ruis kost vertrouwen (sectie 12, factor 5).
 */

import type {
  AppState,
  CoachAlert,
  PhaseDefinition,
  SafetySettings,
  SessionLog,
} from './types'
import { REGION_LABEL } from './types'
import {
  adherence,
  detectPlateau,
  formTrend,
  historyFor,
  JOINT_CAPS,
  lastNDays,
  painByRegion,
  painPerExercise,
  peakPain,
  todayIso,
  weeklyJointSets,
  weeklyVolume,
} from './analytics'
import { exerciseName, getLadder, regressStep } from './exercises'
import { heaviestLoad, workingSets } from './rule'

function alert(partial: Omit<CoachAlert, 'createdAt'> & { createdAt?: string }): CoachAlert {
  return { createdAt: todayIso(), ...partial }
}

/** Trigger 1: pijn loopt op. Pijn gaat altijd voor (principe 4). */
export function painAlerts(sessions: SessionLog[], safety: SafetySettings): CoachAlert[] {
  const alerts: CoachAlert[] = []
  const recent = sessions.slice().sort((a, b) => b.date.localeCompare(a.date))
  const latest = recent[0]
  if (!latest) return alerts

  const peak = peakPain(latest)
  if (peak >= 5) {
    const regions = Object.entries(painByRegion(latest))
      .filter(([, value]) => (value ?? 0) >= 5)
      .map(([region]) => REGION_LABEL[region as keyof typeof REGION_LABEL])
    alerts.push(
      alert({
        id: `pijn-${latest.id}`,
        code: 'pijn-toename',
        severity: 'kritiek',
        title: `Pijn ${peak}/10 gemeld`,
        body: `Gebied: ${regions.join(', ') || 'niet gespecificeerd'}. Dit ligt boven de grens waarop doortrainen nog verdedigbaar is.`,
        action:
          'De betreffende oefening staat gepauzeerd. Volgende sessie een trede terug met halve belasting. Is dit nieuw of neemt het toe: laat het beoordelen.',
        source: 'Sectie 4.3, trigger 1',
      }),
    )
  } else if (peak >= safety.painCeiling) {
    alerts.push(
      alert({
        id: `pijn-grens-${latest.id}`,
        code: 'pijn-toename',
        severity: 'let-op',
        title: `Pijn ${peak}/10 zit op je grens`,
        body: 'Je persoonlijke plafond is bereikt. Dat is nog geen alarm, wel een signaal om de belasting terug te nemen.',
        action: 'Belasting 30% omlaag op de betrokken oefening en de 24-uursreactie invullen.',
        source: 'Sectie 4.3, trigger 1',
      }),
    )
  }

  // Systeem E: zelfde oefening, zelfde pijn, drie sessies achter elkaar.
  const ladderIds = [...new Set(sessions.flatMap((s) => s.exercises.map((e) => e.ladderId)))]
  for (const ladderId of ladderIds) {
    const pains = painPerExercise(sessions, ladderId, 3)
    if (pains.length === 3 && pains.every((p) => p >= 3)) {
      const last = historyFor(sessions, ladderId).slice(-1)[0]
      const lower = last ? regressStep(ladderId, last.log.stepId) : null
      alerts.push(
        alert({
          id: `pijnpatroon-${ladderId}`,
          code: 'pijn-patroon',
          severity: 'kritiek',
          title: `${getLadder(ladderId).name} doet drie sessies op rij pijn`,
          body: `Pijnwaarden: ${pains.join(', ')}. Een patroon is geen toeval meer.`,
          action: lower
            ? `Regressie naar ${lower.name}, of vervangen door een variant uit dezelfde lader. Blijft het na twee weken: laat het beoordelen.`
            : 'Vervang deze oefening door een variant en laat de klacht beoordelen.',
          source: 'Sectie 9.2, systeem E',
          subject: ladderId,
        }),
      )
    }
    if (pains.length >= 3) {
      const [a, b, c] = pains.slice(-3)
      if (a < b && b < c && c >= 5) {
        alerts.push(
          alert({
            id: `pijn-escalatie-${ladderId}`,
            code: 'pijn-patroon',
            severity: 'kritiek',
            title: `Pijn loopt op in ${getLadder(ladderId).name}`,
            body: `Verloop ${a} naar ${b} naar ${c}. Dit is de curve die je niet wilt uitzitten.`,
            action: 'Oefening stoppen, klacht laten beoordelen voordat je hem weer opbouwt.',
            source: 'Sectie 9.2, systeem E',
            subject: ladderId,
          }),
        )
      }
    }
  }
  return alerts
}

/** Trigger 2: techniek verslechtert. */
export function formAlerts(sessions: SessionLog[]): CoachAlert[] {
  const alerts: CoachAlert[] = []
  const ladderIds = [...new Set(sessions.flatMap((s) => s.exercises.map((e) => e.ladderId)))]
  for (const ladderId of ladderIds) {
    const scores = formTrend(sessions, ladderId, 2)
    if (scores.length === 2 && scores.every((s) => s <= 3)) {
      alerts.push(
        alert({
          id: `techniek-${ladderId}`,
          code: 'techniek-verval',
          severity: 'let-op',
          title: `Techniek zakt weg bij ${getLadder(ladderId).name}`,
          body: `Vormscores: ${scores.join(' en ')} uit 5, twee sessies achter elkaar.`,
          action:
            'Belasting 10 tot 20% omlaag tot de beweging weer schoon is. Film één set van opzij en kijk hem terug voordat je verder gaat.',
          source: 'Sectie 4.3, trigger 2',
          subject: ladderId,
        }),
      )
    }
  }
  return alerts
}

/** Trigger 3: stilstand. */
export function plateauAlerts(sessions: SessionLog[]): CoachAlert[] {
  const alerts: CoachAlert[] = []
  const ladderIds = [...new Set(sessions.flatMap((s) => s.exercises.map((e) => e.ladderId)))]
  for (const ladderId of ladderIds) {
    const check = detectPlateau(sessions, ladderId)
    if (!check.stalled) continue
    alerts.push(
      alert({
        id: `plateau-${ladderId}`,
        code: 'plateau',
        severity: 'info',
        title: `${getLadder(ladderId).name} staat stil`,
        body: `${check.stalledSessions} sessies op dezelfde belasting zonder extra reps. Vaak is dat herstel, niet het programma.`,
        action: 'Loop eerst slaap, stress en eiwit na. Klopt dat alles, kies dan één aanpassing.',
        source: 'Sectie 4.3, trigger 3',
        subject: ladderId,
        options: [
          'Eén set toevoegen aan deze oefening, maximaal één keer per week per spiergroep',
          'Variant kiezen: andere hoek, tempo of bereik',
          'Vervroegde deloadweek inlassen',
          'Accepteren dat dit een natuurlijk plateau is en de focus verleggen',
        ],
      }),
    )
  }
  return alerts
}

/** Trigger 4: opkomst. Nooit veroordelend formuleren (sectie 7.1, moment 4). */
export function adherenceAlerts(
  sessions: SessionLog[],
  phase: PhaseDefinition,
  weeksElapsed: number,
): CoachAlert[] {
  if (weeksElapsed < 2) return []
  const { done, planned, ratio } = adherence(sessions, phase.sessionsPerWeek, weeksElapsed)
  const alerts: CoachAlert[] = []

  if (ratio < 0.5) {
    alerts.push(
      alert({
        id: 'adherence-laag',
        code: 'adherence',
        severity: 'let-op',
        title: 'Minder dan de helft van de sessies gehaald',
        body: `${done} van ${planned} sessies. Dat is bijna nooit een motivatieprobleem, meestal een planningsprobleem.`,
        action:
          'We halveren het volume en plannen een vervroegde deload. Een programma dat je doet verslaat een programma dat klopt.',
        source: 'Sectie 4.3, trigger 4',
      }),
    )
  } else if (ratio < 0.7) {
    alerts.push(
      alert({
        id: 'adherence-matig',
        code: 'adherence',
        severity: 'info',
        title: 'Opkomst zakt onder 70%',
        body: `${done} van ${planned} sessies. Wat zit er in de weg?`,
        action:
          'Kies er één: sessies verplaatsen, korter maken, of het volume omlaag. Het programma past zich aan aan de werkelijkheid, niet andersom.',
        source: 'Sectie 4.3, trigger 4',
      }),
    )
  }

  return alerts
}

/** Trigger 5 en systeem C: verplichte deload. */
export function deloadAlerts(phaseWeek: number, safety: SafetySettings): CoachAlert[] {
  const remainder = phaseWeek % safety.deloadIntervalWeeks
  if (phaseWeek > 0 && remainder === 0) {
    return [
      alert({
        id: `deload-week-${phaseWeek}`,
        code: 'deload-due',
        severity: 'info',
        title: 'Deze week is een deloadweek',
        body:
          'Helft van de sets, zelfde gewicht. Dit hoort licht te voelen. Pezen passen zich trager aan dan spieren; dit is de week waarin dat inhaalt.',
        action: 'Volg het aangepaste schema. Deloads worden niet overgeslagen.',
        source: 'Sectie 9.2, systeem C',
      }),
    ]
  }
  if (phaseWeek > 0 && safety.deloadIntervalWeeks - remainder === 1) {
    return [
      alert({
        id: `deload-aankondiging-${phaseWeek}`,
        code: 'deload-due',
        severity: 'info',
        title: 'Volgende week is het deload',
        body: 'Laatste week van dit blok. Maak hem af zoals gepland, niet zwaarder.',
        action: 'Plan de maandmeting in het weekend, dan valt de evaluatie samen met de deload.',
        source: 'Sectie 6.3',
      }),
    ]
  }
  return []
}

/** Systeem A: volumesprong tussen weken. */
export function volumeAlerts(sessions: SessionLog[], safety: SafetySettings): CoachAlert[] {
  const weeks = weeklyVolume(sessions.filter((s) => !s.isDeload))
  if (weeks.length < 2) return []
  const previous = weeks[weeks.length - 2]
  const current = weeks[weeks.length - 1]
  if (previous.sets === 0) return []
  const increase = ((current.sets - previous.sets) / previous.sets) * 100
  if (increase <= safety.maxWeeklyVolumeIncreasePct) return []
  return [
    alert({
      id: `volume-${current.week}`,
      code: 'volume-sprong',
      severity: 'let-op',
      title: 'Volume stijgt te snel',
      body: `${previous.sets} naar ${current.sets} sets, een sprong van ${Math.round(increase)}%. Je grens staat op ${safety.maxWeeklyVolumeIncreasePct}%.`,
      action: 'Volgende week terug naar het niveau van de vorige week. Blessures komen zelden van één zware set, wel van te snelle opbouw.',
      source: 'Sectie 9.2, systeem A',
    }),
  ]
}

/** Systeem B: volumeplafond per gewricht. */
export function jointCapAlerts(sessions: SessionLog[]): CoachAlert[] {
  const totals = weeklyJointSets(sessions)
  return Object.entries(totals)
    .filter(([joint, count]) => count > JOINT_CAPS[joint as keyof typeof JOINT_CAPS])
    .map(([joint, count]) =>
      alert({
        id: `gewricht-${joint}`,
        code: 'gewricht-cap',
        severity: 'let-op',
        title: `Volumeplafond ${joint} bereikt`,
        body: `${count} sets deze week, tegen een plafond van ${JOINT_CAPS[joint as keyof typeof JOINT_CAPS]}.`,
        action: 'Hier niets meer bij deze week. Extra volume op dit gewricht levert nu meer risico op dan resultaat.',
        source: 'Sectie 9.2, systeem B',
        subject: joint,
      }),
    )
}

/** Systeem D: RIR-handhaving. */
export function rirAlerts(sessions: SessionLog[]): CoachAlert[] {
  const recent = lastNDays(sessions, 21)
  const failures = recent.flatMap((s) =>
    s.exercises.flatMap((e) => workingSets(e).filter((set) => set.rir === 0).map(() => e)),
  )
  if (failures.length === 0) return []
  const severity = failures.length >= 4 ? 'let-op' : 'info'
  return [
    alert({
      id: 'rir-handhaving',
      code: 'rir-overtreding',
      severity,
      title: `${failures.length} keer tot falen getraind`,
      body:
        'Het doel is 2 tot 4 reps in reserve. Tot falen gaan levert nauwelijks extra groei op en kost herstel en techniek.',
      action:
        failures.length >= 4
          ? 'Kies lichtere belasting of stop een rep eerder. Bij herhaling passen we het voorschrift naar beneden aan.'
          : 'Stop de laatste set twee reps eerder. Dat is geen zwakte, dat is het plan.',
      source: 'Sectie 9.2, systeem D',
    }),
  ]
}

/** Rode vlaggen: training volledig pauzeren (sectie 9.1). */
export function redFlagAlert(state: AppState): CoachAlert | null {
  if (!state.medicalHold?.active) return null
  return alert({
    id: 'medische-hold',
    code: 'medische-rode-vlag',
    severity: 'kritiek',
    title: 'Training staat gepauzeerd',
    body: `${state.medicalHold.reason} Dit is precies hoe het hoort te werken. Geen schaamte, geen uitzondering.`,
    action:
      'Neem contact op met je arts en vertel wat je gemeld hebt. Zet de pauze pas uit als je groen licht hebt.',
    source: 'Sectie 9.1',
    createdAt: state.medicalHold.since,
  })
}

export interface TriggerContext {
  sessions: SessionLog[]
  phase: PhaseDefinition
  phaseWeek: number
  weeksElapsed: number
  safety: SafetySettings
  state: AppState
}

/** Alle signaleringen op één plek, gesorteerd op ernst. */
export function evaluateTriggers(ctx: TriggerContext): CoachAlert[] {
  const red = redFlagAlert(ctx.state)
  const alerts = [
    ...(red ? [red] : []),
    ...painAlerts(ctx.sessions, ctx.safety),
    ...formAlerts(ctx.sessions),
    ...plateauAlerts(ctx.sessions),
    ...adherenceAlerts(ctx.sessions, ctx.phase, ctx.weeksElapsed),
    ...deloadAlerts(ctx.phaseWeek, ctx.safety),
    ...volumeAlerts(ctx.sessions, ctx.safety),
    ...jointCapAlerts(ctx.sessions),
    ...rirAlerts(ctx.sessions),
  ]
  const rank = { kritiek: 0, 'let-op': 1, info: 2 } as const
  const seen = new Set<string>()
  return alerts
    .filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true)))
    .sort((a, b) => rank[a.severity] - rank[b.severity])
}

/** Kracht loopt terug: input voor de voedingsveiligheid (sectie 9.3). */
export function strengthDeclining(sessions: SessionLog[]): boolean {
  const ladderIds = [...new Set(sessions.flatMap((s) => s.exercises.map((e) => e.ladderId)))]
  let declining = 0
  let counted = 0
  for (const ladderId of ladderIds) {
    const history = historyFor(sessions, ladderId).filter(({ session }) => !session.isDeload)
    if (history.length < 4) continue
    counted++
    const older = heaviestLoad(history[history.length - 4].log)
    const latest = heaviestLoad(history[history.length - 1].log)
    if (older > 0 && latest < older * 0.95) declining++
  }
  return counted >= 2 && declining / counted >= 0.5
}

export function describeExercise(ladderId: string, stepId: string): string {
  return exerciseName(ladderId, stepId)
}
