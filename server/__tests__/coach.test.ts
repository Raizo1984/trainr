import { describe, expect, it } from 'vitest'
import type OpenAI from 'openai'
import { parseCoachResponse } from '../parse'
import { ADJUSTMENT_KINDS, ADJUSTMENT_TOOL, ADJUSTMENT_TOOL_NAME, parseProposalArguments } from '../tools'
import { COACH_SYSTEM } from '../prompt'

type ToolCall = OpenAI.Chat.Completions.ChatCompletionMessageToolCall

function call(args: unknown, name = ADJUSTMENT_TOOL_NAME): ToolCall {
  return {
    id: 'call_1',
    type: 'function',
    function: { name, arguments: typeof args === 'string' ? args : JSON.stringify(args) },
  } as ToolCall
}

function completion(
  content: string | null,
  toolCalls: ToolCall[] = [],
  finish: OpenAI.Chat.Completions.ChatCompletion.Choice['finish_reason'] = 'stop',
): OpenAI.Chat.Completions.ChatCompletion {
  return {
    id: 'chatcmpl_1',
    object: 'chat.completion',
    created: 0,
    model: 'gpt-4o',
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content, refusal: null, tool_calls: toolCalls },
        finish_reason: finish,
        logprobs: null,
      },
    ],
  } as OpenAI.Chat.Completions.ChatCompletion
}

describe('antwoord van de coach uitpakken', () => {
  it('haalt tekst en voorstel uit elkaar', () => {
    const parsed = parseCoachResponse(
      completion('Je knie gaf twee sessies op rij een 4. Dat is geen toeval meer.', [
        call({ kind: 'trede-omlaag', ladderId: 'squat', reason: 'Pijn 4 van 10, twee sessies op rij.' }),
      ]),
    )
    expect(parsed.text).toMatch(/geen toeval/)
    expect(parsed.proposals).toHaveLength(1)
    expect(parsed.proposals[0].kind).toBe('trede-omlaag')
    expect(parsed.incomplete).toBe(false)
  })

  it('laat hooguit één voorstel door, ook als het model er twee stuurt', () => {
    const parsed = parseCoachResponse(
      completion('Twee dingen.', [
        call({ kind: 'sets-omhoog', ladderId: 'squat', reason: 'a' }),
        call({ kind: 'sets-omhoog', ladderId: 'hinge', reason: 'b' }),
      ]),
    )
    expect(parsed.proposals).toHaveLength(1)
  })

  it('negeert gereedschap dat niet van ons is', () => {
    const parsed = parseCoachResponse(completion('hoi', [call({ x: 1 }, 'iets_anders')]))
    expect(parsed.proposals).toHaveLength(0)
  })

  it('meldt een afgekapt antwoord', () => {
    expect(parseCoachResponse(completion('Halverwege', [], 'length')).incomplete).toBe(true)
    expect(parseCoachResponse(completion(null, [], 'content_filter')).incomplete).toBe(true)
  })

  it('valt niet om op een leeg antwoord', () => {
    const parsed = parseCoachResponse(completion(null))
    expect(parsed.text).toBe('')
    expect(parsed.proposals).toHaveLength(0)
  })
})

/**
 * Een taalmodel levert JSON als tekst, en die tekst hoeft nergens aan te
 * voldoen. Deze reeks gaat er expliciet van uit dat er onzin terugkomt.
 */
describe('controle op wat het model terugstuurt', () => {
  it('weigert onleesbare JSON', () => {
    expect(parseProposalArguments('{kapot')).toBeNull()
    expect(parseProposalArguments('null')).toBeNull()
    expect(parseProposalArguments('"tekst"')).toBeNull()
  })

  it('weigert een verzonnen soort aanpassing', () => {
    expect(parseProposalArguments(JSON.stringify({ kind: 'deload-overslaan', reason: 'mag niet' }))).toBeNull()
    expect(parseProposalArguments(JSON.stringify({ kind: 'fase-overslaan', reason: 'mag niet' }))).toBeNull()
  })

  it('weigert een voorstel zonder onderbouwing', () => {
    expect(parseProposalArguments(JSON.stringify({ kind: 'sets-omhoog' }))).toBeNull()
    expect(parseProposalArguments(JSON.stringify({ kind: 'sets-omhoog', reason: '   ' }))).toBeNull()
  })

  it('gooit getallen weg die geen getal zijn', () => {
    const parsed = parseProposalArguments(
      JSON.stringify({ kind: 'sets-omhoog', reason: 'ok', amount: 'twee', repMin: null, expiresAfterWeeks: 4 }),
    )
    expect(parsed?.amount).toBeUndefined()
    expect(parsed?.repMin).toBeUndefined()
    expect(parsed?.expiresAfterWeeks).toBe(4)
  })

  it('behandelt een lege lader als geen lader', () => {
    expect(parseProposalArguments(JSON.stringify({ kind: 'deload-vervroegen', reason: 'ok', ladderId: '' }))?.ladderId)
      .toBeUndefined()
  })

  it('accepteert elke soort die de app kent', () => {
    for (const kind of ADJUSTMENT_KINDS) {
      expect(parseProposalArguments(JSON.stringify({ kind, reason: 'ok' }))?.kind).toBe(kind)
    }
  })
})

describe('instructie en gereedschap', () => {
  it('legt de harde grenzen vast in de instructie', () => {
    expect(COACH_SYSTEM).toMatch(/Pijn gaat altijd voor/)
    expect(COACH_SYSTEM).toMatch(/Deloadweken worden niet overgeslagen/)
    expect(COACH_SYSTEM).toMatch(/nooit twee variabelen tegelijk/i)
    expect(COACH_SYSTEM).toMatch(/geen calorie/i)
    expect(COACH_SYSTEM).toMatch(/Ook niet als de gebruiker er zelf om vraagt/)
    expect(COACH_SYSTEM).toMatch(/stelt geen diagnose/i)
  })

  it('beperkt het gereedschap tot de soorten die de app kent', () => {
    const schema = ADJUSTMENT_TOOL.function.parameters as {
      properties: Record<string, { enum?: string[] }>
      additionalProperties?: boolean
    }
    expect(schema.properties.kind.enum).toEqual([...ADJUSTMENT_KINDS])
    expect(schema.additionalProperties).toBe(false)
  })

  it('zegt in de beschrijving dat het model niets zelf toepast', () => {
    expect(ADJUSTMENT_TOOL.function.description).toMatch(/veiligheidsregels/)
    expect(ADJUSTMENT_TOOL.function.description).toMatch(/gebruiker/)
  })
})
