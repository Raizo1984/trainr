import { describe, expect, it } from 'vitest'
import { outcomeForComplaint } from '../complaint'
import { DEFAULT_SAFETY } from '../risk'
import type { ComplaintContext } from '../complaint'

function ctx(over: Partial<ComplaintContext['reading']> & { painLevel?: number }, safety = DEFAULT_SAFETY): ComplaintContext {
  return {
    reading: {
      region: 'knie-rechts',
      ladderIds: ['squat'],
      summary: 'Zeurende knie rechts bij diepe squats.',
      ...over,
    },
    safety,
    stepByLadder: { squat: 'squat-3' },
    today: '2026-09-14',
  }
}

describe('outcomeForComplaint', () => {
  it('pauzeert de oefening bij pijn vanaf 5', () => {
    const uit = outcomeForComplaint(ctx({ painLevel: 6 }))
    expect(uit.proposals).toHaveLength(1)
    expect(uit.proposals[0].kind).toBe('oefening-pauzeren')
    expect(uit.proposals[0].ladderId).toBe('squat')
  })

  it('gaat een trede terug op de pijngrens', () => {
    const uit = outcomeForComplaint(ctx({ painLevel: DEFAULT_SAFETY.painCeiling }))
    expect(uit.proposals[0].kind).toBe('trede-omlaag')
    expect(uit.proposals[0].reason).toMatch(/Terug naar/)
  })

  it('pauzeert als er geen lagere trede is', () => {
    const c = ctx({ painLevel: DEFAULT_SAFETY.painCeiling })
    c.stepByLadder = { squat: 'squat-1' }
    expect(outcomeForComplaint(c).proposals[0].kind).toBe('oefening-pauzeren')
  })

  it('verandert niets onder de grens', () => {
    const uit = outcomeForComplaint(ctx({ painLevel: 1 }))
    expect(uit.proposals).toHaveLength(0)
    expect(uit.uitleg).toMatch(/blijft onder je grens/)
  })

  it('volgt de grens van deze gebruiker, niet een vaste', () => {
    // Pijn 3 raakt de standaardgrens en zou dan een trede terug opleveren.
    // Bij een hogere grens hoort er juist niets te gebeuren.
    const ruim = { ...DEFAULT_SAFETY, painCeiling: 5 as const }
    expect(outcomeForComplaint(ctx({ painLevel: 3 })).proposals).toHaveLength(1)
    expect(outcomeForComplaint(ctx({ painLevel: 3 }, ruim)).proposals).toHaveLength(0)
  })

  it('grijpt niet in zonder pijncijfer, maar vraagt erom', () => {
    const uit = outcomeForComplaint(ctx({}))
    expect(uit.proposals).toHaveLength(0)
    expect(uit.uitleg).toMatch(/Vul de pijn/)
  })

  it('doet niets als geen enkele oefening het gebied belast', () => {
    const uit = outcomeForComplaint(ctx({ painLevel: 8, ladderIds: [] }))
    expect(uit.proposals).toHaveLength(0)
    expect(uit.uitleg).toMatch(/verandert niets/)
  })

  it('raakt elke betrokken oefening', () => {
    const c = ctx({ painLevel: 7, ladderIds: ['squat', 'hinge'] })
    const uit = outcomeForComplaint(c)
    expect(uit.proposals.map((p) => p.ladderId)).toEqual(['squat', 'hinge'])
  })

  it('levert voorstellen, geen doorgevoerde wijzigingen', () => {
    const uit = outcomeForComplaint(ctx({ painLevel: 8 }))
    expect(uit.proposals.every((p) => p.accepted === false)).toBe(true)
    expect(uit.proposals.every((p) => p.source === 'coach')).toBe(true)
  })

  it('zet de eigen woorden van de melding in de onderbouwing', () => {
    const uit = outcomeForComplaint(ctx({ painLevel: 8, summary: 'Stekende pijn bij het zakken.' }))
    expect(uit.proposals[0].reason).toMatch(/Stekende pijn bij het zakken/)
  })
})
