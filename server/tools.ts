/**
 * Het gereedschap dat de coach mag gebruiken.
 *
 * Bewust één stuk gereedschap met een strak schema. Alles wat het model
 * voorstelt gaat in de client nog langs `validateAdjustment`; dit schema
 * beperkt alleen de vórm van een voorstel, niet de veiligheid ervan.
 */

import type Anthropic from '@anthropic-ai/sdk'

export const ADJUSTMENT_TOOL: Anthropic.Tool = {
  name: 'stel_aanpassing_voor',
  description:
    'Stel één aanpassing van het trainingsprogramma voor. De app legt het voorstel langs de veiligheidsregels en toont het aan de gebruiker, die het accepteert of afwijst. Gebruik dit alleen als een programmawijziging het juiste antwoord is, niet voor uitlegvragen.',
  strict: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      kind: {
        type: 'string',
        enum: [
          'sets-omhoog',
          'sets-omlaag',
          'trede-omlaag',
          'trede-omhoog',
          'oefening-pauzeren',
          'repbereik-wijzigen',
          'deload-vervroegen',
          'frequentie-omlaag',
        ],
        description: 'Het soort aanpassing.',
      },
      ladderId: {
        type: 'string',
        description:
          'De oefeninglader waarop de aanpassing slaat, exact zoals die in de meegestuurde data staat. Laat leeg voor een aanpassing op het hele programma.',
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
}
