import { describe, expect, it } from 'vitest'
import { formatteerTijd, rusttijdSeconden } from '@/features/session/rust'

describe('rusttijd', () => {
  it('geeft zware samengestelde oefeningen de meeste rust', () => {
    expect(rusttijdSeconden('squat', false)).toBeGreaterThan(rusttijdSeconden('isolatie', false))
    expect(rusttijdSeconden('hinge', false)).toBeGreaterThan(rusttijdSeconden('conditie', false))
  })

  it('houdt warming-up en cooldown kort', () => {
    expect(rusttijdSeconden('squat', true)).toBeLessThan(rusttijdSeconden('squat', false))
  })

  it('kent een redelijke standaard voor een onbekend patroon', () => {
    const standaard = rusttijdSeconden('bestaat-niet', false)
    expect(standaard).toBeGreaterThanOrEqual(60)
    expect(standaard).toBeLessThanOrEqual(240)
  })
})

describe('formatteerTijd', () => {
  it('toont minuten en seconden', () => {
    expect(formatteerTijd(90)).toBe('1:30')
    expect(formatteerTijd(60)).toBe('1:00')
    expect(formatteerTijd(5)).toBe('0:05')
  })

  it('gaat nooit onder nul', () => {
    expect(formatteerTijd(-10)).toBe('0:00')
  })
})
