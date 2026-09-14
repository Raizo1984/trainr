import { describe, expect, it } from 'vitest'
import type Anthropic from '@anthropic-ai/sdk'
import { parseCoachResponse } from '../parse'
import { ADJUSTMENT_TOOL } from '../tools'
import { COACH_SYSTEM } from '../prompt'

function message(content: Anthropic.ContentBlock[], stop: Anthropic.Message['stop_reason'] = 'end_turn'): Anthropic.Message {
  return {
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    model: 'claude-opus-5',
    content,
    stop_reason: stop,
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 20 } as Anthropic.Usage,
  } as Anthropic.Message
}

const text = (t: string): Anthropic.ContentBlock => ({ type: 'text', text: t, citations: null }) as Anthropic.ContentBlock
const tool = (input: unknown, name = ADJUSTMENT_TOOL.name): Anthropic.ContentBlock =>
  ({ type: 'tool_use', id: 'tu_1', name, input }) as Anthropic.ContentBlock

describe('antwoord van de coach uitpakken', () => {
  it('haalt tekst en voorstel uit elkaar', () => {
    const parsed = parseCoachResponse(
      message([
        text('Je knie gaf twee sessies op rij een 4. Dat is geen toeval meer.'),
        tool({ kind: 'trede-omlaag', ladderId: 'squat', reason: 'Pijn 4 van 10, twee sessies op rij.' }),
      ]),
      ADJUSTMENT_TOOL.name,
    )
    expect(parsed.text).toMatch(/geen toeval/)
    expect(parsed.proposals).toHaveLength(1)
    expect(parsed.refused).toBe(false)
  })

  it('laat hooguit één voorstel door, ook als het model er twee stuurt', () => {
    const parsed = parseCoachResponse(
      message([
        text('Twee dingen.'),
        tool({ kind: 'sets-omhoog', ladderId: 'squat', reason: 'a' }),
        tool({ kind: 'sets-omhoog', ladderId: 'hinge', reason: 'b' }),
      ]),
      ADJUSTMENT_TOOL.name,
    )
    expect(parsed.proposals).toHaveLength(1)
  })

  it('negeert gereedschap dat niet van ons is', () => {
    const parsed = parseCoachResponse(message([text('hoi'), tool({ x: 1 }, 'iets_anders')]), ADJUSTMENT_TOOL.name)
    expect(parsed.proposals).toHaveLength(0)
  })

  it('meldt een weigering apart', () => {
    const parsed = parseCoachResponse(message([], 'refusal'), ADJUSTMENT_TOOL.name)
    expect(parsed.refused).toBe(true)
    expect(parsed.text).toBe('')
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
    const schema = ADJUSTMENT_TOOL.input_schema as { properties: Record<string, { enum?: string[] }> }
    expect(schema.properties.kind.enum).toContain('trede-omlaag')
    expect(schema.properties.kind.enum).not.toContain('fase-overslaan')
    expect(schema.properties.kind.enum).not.toContain('deload-overslaan')
    expect(ADJUSTMENT_TOOL.strict).toBe(true)
  })

  it('zegt in de beschrijving dat het model niets zelf toepast', () => {
    expect(ADJUSTMENT_TOOL.description).toMatch(/veiligheidsregels/)
    expect(ADJUSTMENT_TOOL.description).toMatch(/gebruiker/)
  })
})
