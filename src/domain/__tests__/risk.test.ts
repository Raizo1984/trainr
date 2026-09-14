import { describe, expect, it } from 'vitest'
import { assessRisk, DEFAULT_SAFETY, qualifiesForDirectPhase2 } from '../risk'
import { intakeWith } from './factories'

describe('risicostratificatie', () => {
  it('laat een schone intake op laag risico staan met standaardinstellingen', () => {
    const result = assessRisk(intakeWith(() => {}))
    expect(result.level).toBe('laag')
    expect(result.safety).toEqual(DEFAULT_SAFETY)
    expect(result.trainingPaused).toBe(false)
    expect(result.nutritionModel).toBe('laag-risico')
  })

  it('schakelt het beschermende voedingsmodel in bij een extreme voedingshistorie', () => {
    const result = assessRisk(intakeWith((i) => { i.nutrition.extremePatterns = true }))
    expect(result.level).toBe('hoog')
    expect(result.nutritionModel).toBe('hoog-risico')
    expect(result.referrals.some((r) => r.kind === 'dietist')).toBe(true)
    expect(result.safety.painCeiling).toBe(2)
    expect(result.safety.loadStepPct).toBe(2.5)
  })

  it('pauzeert training bij een medische rode vlag', () => {
    const result = assessRisk(intakeWith((i) => { i.medical.redFlagSymptoms = ['uitstralende-pijn'] }))
    expect(result.trainingPaused).toBe(true)
    expect(result.referrals.some((r) => r.kind === 'medisch' && r.blocking)).toBe(true)
  })

  it('verwijst neurologische klachten door naar een arts, niet naar een programma', () => {
    const result = assessRisk(
      intakeWith((i) => {
        i.training.complaints = [
          { region: 'onderrug', intensity: 4, character: 'neurologisch', course: 'chronisch', worseWhen: 'zitten', reaction24h: 'erger' },
        ]
      }),
    )
    expect(result.trainingPaused).toBe(true)
    expect(result.factors.some((f) => f.code === 'neurologische-symptomen')).toBe(true)
  })

  it('verwijst aanhoudende klachten zonder diagnose naar de fysiotherapeut zonder te pauzeren', () => {
    const result = assessRisk(
      intakeWith((i) => {
        i.training.complaints = [
          { region: 'schouder-links', intensity: 4, character: 'mechanisch', course: 'chronisch', worseWhen: 'boven schouderhoogte', reaction24h: 'gelijk' },
        ]
      }),
    )
    expect(result.referrals.some((r) => r.kind === 'fysio')).toBe(true)
    expect(result.trainingPaused).toBe(false)
  })

  it('start iedereen in fase 0, ook de gevorderde gebruiker', () => {
    const advanced = intakeWith((i) => { i.training.level = 'advanced' })
    expect(assessRisk(advanced).startPhase).toBe(0)
    expect(qualifiesForDirectPhase2(advanced)).toBe(true)
  })

  it('stapelt twee let-op-factoren tot hoog risico', () => {
    const result = assessRisk(
      intakeWith((i) => {
        i.lifestyle.sleepHours = 5
        i.lifestyle.stress = 9
      }),
    )
    expect(result.level).toBe('hoog')
  })
})
