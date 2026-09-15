import { describe, expect, it } from 'vitest'
import { diepSamenvoegen } from '../useAppStore'
import { emptyState } from '@/domain/defaults'

/**
 * Wat er gebeurt met een opgeslagen staat die niet compleet is.
 *
 * Dit is geen bedacht geval. Voeg je later een veld toe aan de intake, dan
 * mist dat veld bij iedereen die de app al gebruikte. Zonder diep samenvoegen
 * leest de app dan iets op een object dat er niet is, en dat geeft een wit
 * scherm zonder weg terug.
 */
/* Zo roept de opslag hem aan: de standaard eerst, het bewaarde eroverheen. */
const samenvoegen = (bewaard: unknown, standaard: unknown) => diepSamenvoegen(standaard, bewaard)

describe('bewaarde staat terugzetten', () => {
  it('vult ontbrekende velden aan met de standaard', () => {
    const leeg = emptyState()
    const samen = samenvoegen(
      { intake: { name: 'Oude gebruiker', completedAt: '2026-01-01' } },
      leeg,
    ) as typeof leeg

    expect(samen.intake.name).toBe('Oude gebruiker')
    expect(samen.intake.completedAt).toBe('2026-01-01')
    // Deze velden stonden niet in de bewaarde staat en moeten er toch zijn.
    expect(samen.intake.training).toBeDefined()
    expect(typeof samen.intake.training.sessionMinutes).toBe('number')
    expect(samen.intake.medical).toBeDefined()
    expect(Array.isArray(samen.sessions)).toBe(true)
  })

  it('vervangt lijsten in plaats van ze te mengen', () => {
    const leeg = emptyState()
    const samen = samenvoegen(
      { acknowledgedAlerts: ['a', 'b'] },
      { ...leeg, acknowledgedAlerts: ['oud'] },
    ) as typeof leeg
    expect(samen.acknowledgedAlerts).toEqual(['a', 'b'])
  })

  it('laat een bewaarde null staan waar dat de bedoeling is', () => {
    const leeg = emptyState()
    const samen = samenvoegen(
      { medicalHold: null },
      { ...leeg, medicalHold: { active: true, since: '2026-01-01', reason: 'x' } },
    ) as typeof leeg
    expect(samen.medicalHold).toBeNull()
  })
})
