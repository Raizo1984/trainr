/**
 * Het antwoord van het model uitpakken.
 *
 * Apart van de server zodat dit getest kan worden zonder een echte aanroep.
 * Tekst en voorstellen komen los terug: een voorstel is geen tekst maar een
 * handeling die in de client nog langs de veiligheidsregels moet.
 */

import type OpenAI from 'openai'
import { ADJUSTMENT_TOOL_NAME, parseProposalArguments, type ProposalArguments } from './tools.ts'

export interface ParsedCoachReply {
  text: string
  proposals: ProposalArguments[]
  /** Het model stopte om een andere reden dan een afgerond antwoord. */
  incomplete: boolean
}

export function parseCoachResponse(completion: OpenAI.Chat.Completions.ChatCompletion): ParsedCoachReply {
  const choice = completion.choices[0]
  if (!choice) return { text: '', proposals: [], incomplete: true }

  const text = (choice.message.content ?? '').trim()

  const proposals = (choice.message.tool_calls ?? [])
    .filter(
      (call): call is OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall =>
        call.type === 'function' && call.function.name === ADJUSTMENT_TOOL_NAME,
    )
    .map((call) => parseProposalArguments(call.function.arguments))
    .filter((proposal): proposal is ProposalArguments => proposal !== null)
    // Hooguit één voorstel per antwoord: twee aanpassingen tegelijk is precies
    // wat de instructie verbiedt, en een model dat zich vergist mag dat niet
    // alsnog via de achterdeur doen.
    .slice(0, 1)

  return {
    text,
    proposals,
    incomplete: choice.finish_reason === 'length' || choice.finish_reason === 'content_filter',
  }
}
