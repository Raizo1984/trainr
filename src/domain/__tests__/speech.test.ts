import { describe, expect, it } from 'vitest'
import { parseSpokenSet } from '../speech'

const v = (zin: string) => parseSpokenSet(zin).velden

describe('parseSpokenSet', () => {
  it('leest de gewone zin met cijfers', () => {
    expect(v('10 reps 50 kilo RIR 3')).toEqual({ reps: 10, load: 50, rir: 3 })
  })

  it('leest dezelfde zin in telwoorden', () => {
    expect(v('tien reps vijftig kilo rir drie')).toEqual({ reps: 10, load: 50, rir: 3 })
  })

  it('begrijpt samengestelde telwoorden', () => {
    expect(v('vijfentwintig kilo')).toEqual({ load: 25 })
    expect(v('tweeentwintig reps')).toEqual({ reps: 22 })
    expect(v('honderdtwintig kilo')).toEqual({ load: 120 })
  })

  it('verwerkt trema en hoofdletters', () => {
    expect(v('Tweeëntwintig Reps')).toEqual({ reps: 22 })
  })

  it('kent halve kilo', () => {
    expect(v('twee en een half kilo')).toEqual({ load: 2.5 })
    expect(v('57,5 kilo')).toEqual({ load: 57.5 })
    expect(v('57.5 kg')).toEqual({ load: 57.5 })
  })

  it('maakt de volgorde niet uit', () => {
    expect(v('50 kilo 10 herhalingen')).toEqual({ reps: 10, load: 50 })
  })

  it('verstaat pijn, ook als die er niet is', () => {
    expect(v('pijn 4')).toEqual({ pain: 4 })
    expect(v('geen pijn')).toEqual({ pain: 0 })
    expect(v('acht reps geen pijn')).toEqual({ reps: 8, pain: 0 })
  })

  it('verstaat techniek', () => {
    expect(v('techniek 3')).toEqual({ formQuality: 3 })
    expect(v('vorm vier')).toEqual({ formQuality: 4 })
  })

  it('verstaat reps in reserve zonder het woord rir', () => {
    expect(v('twaalf keer nog twee in reserve')).toEqual({ reps: 12, rir: 2 })
  })

  it('gokt niet bij twee kale getallen', () => {
    const r = parseSpokenSet('tien vijftig')
    expect(r.velden).toEqual({})
    expect(r.probleem).toMatch(/Geen reps/)
  })

  it('weigert waarden buiten een geloofwaardig bereik', () => {
    expect(v('900 kilo')).toEqual({})
    expect(v('pijn 40')).toEqual({})
    expect(v('techniek 9')).toEqual({})
  })

  it('meldt het als er niets gezegd is', () => {
    expect(parseSpokenSet('   ').probleem).toMatch(/Niets verstaan/)
  })

  it('negeert wat er verder gezegd wordt', () => {
    expect(v('even kijken hoor, dat waren 8 reps op 60 kilo geloof ik')).toEqual({ reps: 8, load: 60 })
  })

  it('geeft terug wat het gehoord heeft', () => {
    expect(parseSpokenSet('10 REPS!').gehoord).toBe('10 reps')
  })
})
