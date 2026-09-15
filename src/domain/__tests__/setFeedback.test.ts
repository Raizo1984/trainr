import { describe, expect, it } from 'vitest'
import { feedbackForSet, verdictTone } from '../setFeedback'
import { DEFAULT_SAFETY } from '../risk'
import type { SetEntry } from '../types'

function set(partial: Partial<SetEntry> & { reps: number }): SetEntry {
  return { setIndex: 0, load: 40, rir: 3, pain: 0, painRegion: null, formQuality: 5, ...partial }
}

const planned = { sets: 3, repMin: 8, repMax: 12, targetRir: 2 }

function ask(s: SetEntry, extra: Partial<Parameters<typeof feedbackForSet>[0]> = {}) {
  return feedbackForSet({
    set: s,
    planned,
    setsDone: 1,
    isDeload: false,
    safety: DEFAULT_SAFETY,
    loadType: 'gewicht',
    ...extra,
  })
}

describe('feedbackForSet', () => {
  it('stopt de oefening bij pijn vanaf 5', () => {
    const f = ask(set({ reps: 10, pain: 5 }))
    expect(f.verdict).toBe('stop')
    expect(f.headline).toMatch(/Stop deze oefening/)
  })

  it('pijn gaat voor techniek en RIR', () => {
    const f = ask(set({ reps: 10, pain: 6, formQuality: 1, rir: 0 }))
    expect(f.verdict).toBe('stop')
  })

  it('verlaagt 30 procent op de pijngrens', () => {
    const f = ask(set({ reps: 10, pain: DEFAULT_SAFETY.painCeiling, load: 40 }))
    expect(f.verdict).toBe('lichter')
    // 40 * 0.7 = 28, afgerond omlaag op een bestaande stap
    expect(f.nextLoad).toBe(28)
  })

  it('rondt de verlaging altijd naar beneden af', () => {
    const f = ask(set({ reps: 10, formQuality: 3, load: 40 }))
    // 40 * 0.85 = 34 -> 32.5, nooit 35
    expect(f.nextLoad).toBe(32.5)
    expect(f.nextLoad!).toBeLessThan(40 * 0.85 + 0.01)
  })

  it('techniek onder de 4 weegt zwaarder dan een prima RIR', () => {
    const f = ask(set({ reps: 12, rir: 3, formQuality: 2 }))
    expect(f.verdict).toBe('lichter')
    expect(f.headline).toMatch(/Techniek/)
  })

  it('grijpt in bij RIR onder de 2', () => {
    const f = ask(set({ reps: 11, rir: 1, load: 40 }))
    expect(f.verdict).toBe('lichter')
    // 40 * 0.92 = 36.8, en 36.5 bestaat niet als schijvenstap: naar beneden is 35
    expect(f.nextLoad).toBe(35)
  })

  it('gaat een stap zwaarder als de set duidelijk te licht was', () => {
    const makkelijk = ask(set({ reps: 12, rir: 5, load: 40 }))
    expect(makkelijk.verdict).toBe('zwaarder')
    // 40 + 2.5% = 41, naar boven op een bestaande stap is 42.5
    expect(makkelijk.nextLoad).toBe(42.5)
  })

  it('rondt een verhoging naar boven af, anders verandert er niets', () => {
    const f = ask(set({ reps: 12, rir: 5, load: 100 }))
    expect(f.nextLoad).toBeGreaterThan(100)
  })

  it('doet hoogstens één stap omhoog per oefening', () => {
    const f = ask(set({ reps: 12, rir: 5, load: 40 }), { alVerhoogd: true })
    expect(f.verdict).toBe('let-op')
    expect(f.nextLoad).toBeNull()
    expect(f.action).toMatch(/al een keer omhoog/)
  })

  it('verhoogt niet op de laatste set, want dan is de oefening klaar', () => {
    const f = ask(set({ reps: 12, rir: 5, load: 40 }), { setsDone: 3 })
    expect(f.verdict).toBe('let-op')
    expect(f.action).toMatch(/na afloop/)
  })

  it('laat pijn en techniek altijd voorgaan op een verhoging', () => {
    expect(ask(set({ reps: 12, rir: 5, pain: 6 })).verdict).toBe('stop')
    expect(ask(set({ reps: 12, rir: 5, formQuality: 2 })).verdict).toBe('lichter')
  })

  it('verhoogt niet in een deloadweek', () => {
    expect(ask(set({ reps: 12, rir: 5 }), { isDeload: true }).verdict).toBe('goed')
  })

  it('laat een deloadweek met rust', () => {
    const f = ask(set({ reps: 12, rir: 4 }), { isDeload: true })
    expect(f.verdict).toBe('goed')
    expect(f.nextLoad).toBeNull()
  })

  it('laat vaste onderdelen niet meeklimmen', () => {
    const f = ask(set({ reps: 12, rir: 5 }), { fixed: true })
    expect(f.verdict).toBe('goed')
    expect(f.action).toMatch(/blijven gelijk/)
  })

  it('maar pijn overrulet ook een vast onderdeel', () => {
    const f = ask(set({ reps: 12, pain: 7 }), { fixed: true })
    expect(f.verdict).toBe('stop')
  })

  it('meldt reps onder het voorgeschreven bereik', () => {
    const f = ask(set({ reps: 5, rir: 4 }))
    expect(f.verdict).toBe('let-op')
    expect(f.headline).toMatch(/onder je bereik/)
  })

  it('zegt bij de laatste set dat de oefening klaar is', () => {
    const f = ask(set({ reps: 10, rir: 3 }), { setsDone: 3 })
    expect(f.action).toMatch(/klaar/)
  })

  it('geeft bij lichaamsgewicht zonder belasting geen kilo-advies', () => {
    const f = ask(set({ reps: 10, formQuality: 2, load: 0 }), { loadType: 'trede' })
    expect(f.nextLoad).toBeNull()
    expect(f.action).toMatch(/bereik van de beweging/)
  })

  it('vertaalt het oordeel naar een toon', () => {
    expect(verdictTone('stop')).toBe('serious')
    expect(verdictTone('lichter')).toBe('warn')
    expect(verdictTone('let-op')).toBe('warn')
    expect(verdictTone('goed')).toBe('good')
    expect(verdictTone('zwaarder')).toBe('brand')
  })
})
