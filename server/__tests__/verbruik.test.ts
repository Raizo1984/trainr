/**
 * De grens op wat het model mag kosten.
 *
 * Getest op de teller in het geheugen: zonder DATABASE_URL valt verbruik.ts
 * daarop terug, en dat is precies het pad dat ook in productie aan de beurt is
 * zodra de database hapert. De database-kant wordt in e2e/verbruik.mjs tegen
 * een echte PostgreSQL nagelopen.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { boekTokens, grensVoor, magHet, noteerVerzoek, tokensPerDagTotaal, wisGeheugen } from '../verbruik'

const KLEIN = { verzoekenPerMinuut: 2, verzoekenPerDag: 3, tokensPerDag: 1000 }

async function doe(sleutel: string, tokens = 0): Promise<void> {
  const bon = await noteerVerzoek(sleutel, 'coach')
  await boekTokens(bon, tokens)
}

beforeEach(() => {
  delete process.env.DATABASE_URL
  delete process.env.AI_TOKENS_PER_DAG
  wisGeheugen()
})

describe('grens per bezoeker', () => {
  it('laat het eerste verzoek gewoon door', async () => {
    expect(await magHet('gebruiker:a', KLEIN)).toEqual({ mag: true })
  })

  it('stopt bij te veel verzoeken achter elkaar', async () => {
    await doe('gebruiker:a')
    await doe('gebruiker:a')
    const oordeel = await magHet('gebruiker:a', KLEIN)
    expect(oordeel.mag).toBe(false)
    if (!oordeel.mag) expect(oordeel.reden).toBe('per-minuut')
  })

  it('stopt bij te veel verbruikte tokens, ook als het weinig verzoeken zijn', async () => {
    await doe('gebruiker:a', 1200)
    const oordeel = await magHet('gebruiker:a', { ...KLEIN, verzoekenPerMinuut: 99 })
    expect(oordeel.mag).toBe(false)
    if (!oordeel.mag) expect(oordeel.reden).toBe('tokens')
  })

  it('telt per bezoeker, niet over iedereen heen', async () => {
    await doe('gebruiker:a')
    await doe('gebruiker:a')
    expect((await magHet('gebruiker:a', KLEIN)).mag).toBe(false)
    expect((await magHet('gebruiker:b', KLEIN)).mag).toBe(true)
  })

  it('telt een mislukt verzoek net zo goed mee', async () => {
    // Nul tokens, want er kwam geen antwoord. Het verzoek was er wel.
    await doe('adres:1.2.3.4', 0)
    await doe('adres:1.2.3.4', 0)
    const oordeel = await magHet('adres:1.2.3.4', KLEIN)
    expect(oordeel.mag).toBe(false)
  })

  it('geeft mee hoe lang je moet wachten', async () => {
    await doe('gebruiker:a')
    await doe('gebruiker:a')
    const oordeel = await magHet('gebruiker:a', KLEIN)
    if (oordeel.mag) throw new Error('had geweigerd moeten worden')
    expect(oordeel.wachtSeconden).toBeGreaterThan(0)
  })
})

describe('grens over alles heen', () => {
  it('stopt iedereen zodra het dagtegoed op is', async () => {
    process.env.AI_TOKENS_PER_DAG = '500'
    await doe('gebruiker:a', 600)
    // Een andere bezoeker die zelf nog niets deed, komt er ook niet meer door.
    const oordeel = await magHet('gebruiker:nieuw', grensVoor(true))
    expect(oordeel.mag).toBe(false)
    if (!oordeel.mag) expect(oordeel.reden).toBe('totaal')
  })

  it('is uit te zetten op nul', async () => {
    process.env.AI_TOKENS_PER_DAG = '0'
    await doe('gebruiker:a', 10_000_000)
    expect((await magHet('gebruiker:nieuw', grensVoor(true))).mag).toBe(true)
  })

  it('valt terug op de standaard bij onzin in de omgeving', () => {
    process.env.AI_TOKENS_PER_DAG = 'veel'
    expect(tokensPerDagTotaal()).toBeGreaterThan(0)
    process.env.AI_TOKENS_PER_DAG = '-5'
    expect(tokensPerDagTotaal()).toBeGreaterThan(0)
  })
})

describe('de grenzen zelf', () => {
  it('is per grens te verzetten vanuit de omgeving', () => {
    process.env.AI_ANONIEM_PER_DAG = '2'
    expect(grensVoor(false).verzoekenPerDag).toBe(2)
    delete process.env.AI_ANONIEM_PER_DAG
    expect(grensVoor(false).verzoekenPerDag).toBeGreaterThan(2)
  })

  it('geeft een anoniem adres minder ruimte dan een account', () => {
    expect(grensVoor(false).verzoekenPerDag).toBeLessThan(grensVoor(true).verzoekenPerDag)
    expect(grensVoor(false).tokensPerDag).toBeLessThan(grensVoor(true).tokensPerDag)
    expect(grensVoor(false).verzoekenPerMinuut).toBeLessThanOrEqual(grensVoor(true).verzoekenPerMinuut)
  })

  it('laat een normale dag trainen ruim binnen de grens vallen', () => {
    // Een sessie: een paar klachten duiden en wat vragen aan de coach. Eén
    // weekrapport. Wie daar tegenaan loopt, gebruikt de app niet zoals bedoeld.
    const normaleDag = 3 + 10 + 1
    expect(grensVoor(true).verzoekenPerDag).toBeGreaterThan(normaleDag * 2)
  })
})
