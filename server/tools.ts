/**
 * Het gereedschap dat de coach mag gebruiken, plus de controle op wat er
 * terugkomt.
 *
 * Bewust één functie met een strak schema. Het schema beperkt de vórm van een
 * voorstel; de veiligheid ervan wordt in de client bepaald door
 * `validateAdjustment`. Dit is de bovenste van twee sloten, niet het enige.
 */

import type OpenAI from 'openai'

/** De soorten aanpassing die de app kent. Alles daarbuiten wordt geweigerd. */
export const ADJUSTMENT_KINDS = [
  'sets-omhoog',
  'sets-omlaag',
  'trede-omlaag',
  'trede-omhoog',
  'oefening-pauzeren',
  'repbereik-wijzigen',
  'deload-vervroegen',
  'frequentie-omlaag',
] as const

export type AdjustmentKind = (typeof ADJUSTMENT_KINDS)[number]

export const ADJUSTMENT_TOOL_NAME = 'stel_aanpassing_voor'

export const ADJUSTMENT_TOOL: OpenAI.Chat.Completions.ChatCompletionFunctionTool = {
  type: 'function',
  function: {
    name: ADJUSTMENT_TOOL_NAME,
    description:
      'Stel één aanpassing van het trainingsprogramma voor. De app legt het voorstel langs de veiligheidsregels en toont het aan de gebruiker, die het accepteert of afwijst. Gebruik dit alleen als een programmawijziging het juiste antwoord is, niet voor uitlegvragen.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        kind: {
          type: 'string',
          enum: [...ADJUSTMENT_KINDS],
          description: 'Het soort aanpassing.',
        },
        ladderId: {
          type: 'string',
          description:
            'De oefeninglader waarop de aanpassing slaat, exact zoals die in de meegestuurde data staat. Laat weg voor een aanpassing op het hele programma.',
        },
        amount: {
          type: 'number',
          description: 'Aantal sets erbij of eraf. Alleen bij sets-omhoog en sets-omlaag. Maximaal 1.',
        },
        repMin: { type: 'number', description: 'Nieuwe ondergrens van het repbereik.' },
        repMax: { type: 'number', description: 'Nieuwe bovengrens van het repbereik.' },
        reason: {
          type: 'string',
          description:
            'Waarom deze aanpassing, in één of twee zinnen, met de getallen uit de data erbij. Dit leest de gebruiker.',
        },
        expiresAfterWeeks: {
          type: 'number',
          description: 'Na hoeveel weken de aanpassing vanzelf vervalt. Gebruik 2 tot 6.',
        },
      },
      required: ['kind', 'reason'],
    },
  },
}

export interface ProposalArguments {
  kind: AdjustmentKind
  ladderId?: string
  amount?: number
  repMin?: number
  repMax?: number
  reason: string
  expiresAfterWeeks?: number
}

/**
 * Controleert wat het model terugstuurt.
 *
 * Een taalmodel levert JSON als tekst, en die tekst hoeft nergens aan te
 * voldoen. Een kapot of verzonnen voorstel hoort hier te stranden en niet in
 * de client als `undefined` door te sijpelen.
 */
export function parseProposalArguments(raw: string): ProposalArguments | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null

  const value = parsed as Record<string, unknown>
  const kind = value.kind
  if (typeof kind !== 'string' || !ADJUSTMENT_KINDS.includes(kind as AdjustmentKind)) return null
  if (typeof value.reason !== 'string' || value.reason.trim().length === 0) return null

  const number = (field: unknown): number | undefined =>
    typeof field === 'number' && Number.isFinite(field) ? field : undefined

  return {
    kind: kind as AdjustmentKind,
    ladderId: typeof value.ladderId === 'string' && value.ladderId.length > 0 ? value.ladderId : undefined,
    amount: number(value.amount),
    repMin: number(value.repMin),
    repMax: number(value.repMax),
    reason: value.reason.trim(),
    expiresAfterWeeks: number(value.expiresAfterWeeks),
  }
}
