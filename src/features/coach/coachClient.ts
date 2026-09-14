/**
 * Praten met de backend. De sleutel staat daar; hier staat niets geheims.
 */

import type { CoachContext } from '@/domain/coachContext'
import type { AdjustmentKind } from '@/domain/types'

export interface CoachMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface RawProposal {
  kind: AdjustmentKind
  ladderId?: string
  amount?: number
  repMin?: number
  repMax?: number
  reason: string
  expiresAfterWeeks?: number
}

export interface CoachReply {
  text: string
  proposals: RawProposal[]
  refused: boolean
}

export class CoachError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message)
  }
}

export async function coachStatus(): Promise<{ available: boolean; model: string }> {
  try {
    const response = await fetch('/api/coach/status')
    if (!response.ok) return { available: false, model: '' }
    return (await response.json()) as { available: boolean; model: string }
  } catch {
    // Geen server bereikbaar: de app werkt door, de coach niet.
    return { available: false, model: '' }
  }
}

export async function askCoach(messages: CoachMessage[], context: CoachContext): Promise<CoachReply> {
  let response: Response
  try {
    response = await fetch('/api/coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, context }),
    })
  } catch {
    throw new CoachError('Geen verbinding met de server. Je programma werkt gewoon door.', 'offline')
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string; error?: string }
    throw new CoachError(body.message ?? 'De coach is nu niet bereikbaar.', body.error ?? 'onbekend')
  }

  return (await response.json()) as CoachReply
}
