import { describe, expect, it, vi, beforeEach } from 'vitest'

/**
 * Het register is een gegenereerd bestand. Voor deze test vervangen we het,
 * zodat de regels getest worden en niet de inhoud van dat bestand.
 */
vi.mock('../exerciseMedia.generated.json', () => ({
  default: {
    'squat-3': {
      bestand: 'squat-3.png',
      trede: 'Goblet squat',
      bron: 'Goblet Squat',
      licentie: 'CC-BY-SA 4.0',
      auteur: 'Iemand',
      bevestigd: true,
    },
    'squat-4': {
      bestand: 'squat-4.png',
      trede: 'Brede goblet squat',
      bron: 'Sumo Deadlift',
      licentie: 'CC-BY-SA 4.0',
      auteur: 'Iemand',
      bevestigd: false,
    },
    'squat-5': {
      bestand: 'squat-5.png',
      trede: 'Front squat',
      bron: 'Front Squat',
      licentie: '',
      auteur: 'Iemand',
      bevestigd: true,
    },
  },
}))

const { bronvermelding, mediaVoorStap } = await import('../exerciseMedia')

describe('mediaVoorStap', () => {
  beforeEach(() => vi.clearAllMocks())

  it('geeft bevestigd beeld terug', () => {
    expect(mediaVoorStap('squat-3')?.bestand).toBe('squat-3.png')
  })

  it('toont onbevestigd beeld niet', () => {
    // Deze koppeling is fout: een sumo deadlift bij een brede goblet squat.
    // Precies daarom staat er een mens tussen.
    expect(mediaVoorStap('squat-4')).toBeNull()
  })

  it('weigert beeld zonder licentie', () => {
    expect(mediaVoorStap('squat-5')).toBeNull()
  })

  it('geeft null voor een trede zonder beeld', () => {
    expect(mediaVoorStap('bestaat-niet')).toBeNull()
  })
})

describe('bronvermelding', () => {
  it('noemt bron, maker en licentie', () => {
    const media = mediaVoorStap('squat-3')!
    const tekst = bronvermelding(media)
    expect(tekst).toContain('Goblet Squat')
    expect(tekst).toContain('Iemand')
    expect(tekst).toContain('CC-BY-SA 4.0')
    expect(tekst).toContain('wger')
  })
})
