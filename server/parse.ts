/**
 * Het antwoord van Claude uitpakken.
 *
 * Apart van de server zodat dit getest kan worden zonder een echte aanroep.
 * Tekst en voorstellen komen los terug: een voorstel is geen tekst maar een
 * handeling die in de client nog langs de veiligheidsregels moet.
 */

import type Anthropic from '@anthropic-ai/sdk'

export interface ParsedCoachReply {
  text: string
  proposals: unknown[]
  refused: boolean
}

export function parseCoachResponse(response: Anthropic.Message, toolName: string): ParsedCoachReply {
  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim()

  const proposals = response.content
    .filter((block): block is Anthropic.ToolUseBlock => block.type === 'tool_use')
    .filter((block) => block.name === toolName)
    // Hooguit één voorstel per antwoord: twee aanpassingen tegelijk is precies
    // wat de instructie verbiedt, en een model dat zich vergist mag dat niet
    // alsnog via de achterdeur doen.
    .slice(0, 1)
    .map((block) => block.input)

  return { text, proposals, refused: response.stop_reason === 'refusal' }
}
