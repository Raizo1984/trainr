import { describe, expect, it } from 'vitest'
import { DOEL_LABEL, FASE_UITLEG, SPIERGROEP, rirUitleg } from './taal'
import { PHASES } from './phases'
import { LADDERS } from './exercises'

describe('vertaaltabel', () => {
  it('heeft uitleg voor elke fase die de app kent', () => {
    for (const fase of PHASES) {
      expect(FASE_UITLEG[fase.id], `fase ${fase.id} mist uitleg`).toBeTruthy()
    }
  })

  it('heeft een spiergroep voor elk bewegingspatroon dat in een ladder zit', () => {
    for (const ladder of LADDERS) {
      expect(SPIERGROEP[ladder.pattern], `${ladder.pattern} mist een spiergroep`).toBeTruthy()
    }
  })

  it('zegt bij elk doel wat het oplevert, zonder vakjargon', () => {
    for (const [waarde, { label, uitleg }] of Object.entries(DOEL_LABEL)) {
      expect(label.length, `${waarde} heeft een leeg label`).toBeGreaterThan(0)
      expect(uitleg.length, `${waarde} heeft geen uitleg`).toBeGreaterThan(10)
      expect(label).not.toMatch(/hypertrofie|RIR|patroon/i)
    }
  })

  it('legt RIR uit in gewone woorden', () => {
    expect(rirUitleg(0)).toBe('tot je er geen meer kunt')
    expect(rirUitleg(1)).toBe('nog één in reserve')
    expect(rirUitleg(3)).toBe('nog 3 in reserve')
  })
})
