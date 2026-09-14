/**
 * Backend voor Trainr.
 *
 * Doet twee dingen: de gebouwde app uitserveren, en `/api/coach` aanbieden als
 * doorgeefluik naar Claude. De API-sleutel staat uitsluitend hier. Hij komt
 * nooit in de browser, want alles wat de browser kent kan iedere bezoeker met
 * de ontwikkelaarsconsole uitlezen.
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import Anthropic from '@anthropic-ai/sdk'
import { COACH_SYSTEM } from './prompt.ts'
import { ADJUSTMENT_TOOL } from './tools.ts'
import { parseCoachResponse } from './parse.ts'

const here = path.dirname(fileURLToPath(import.meta.url))
const app = express()

// Het profiel plus de recente historie is ruim, maar niet onbeperkt: zonder
// grens kan iemand de server als generieke doorgeefluik naar Claude gebruiken.
app.use(express.json({ limit: '1mb' }))

const PORT = Number(process.env.PORT ?? 3001)
const MODEL = 'claude-opus-5'

/** Laat de client weten of de coach bruikbaar is, zonder de sleutel te tonen. */
app.get('/api/coach/status', (_req, res) => {
  res.json({ available: Boolean(process.env.ANTHROPIC_API_KEY), model: MODEL })
})

app.post('/api/coach', async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(503).json({
      error: 'geen-sleutel',
      message:
        'De coach is niet geconfigureerd. Zet ANTHROPIC_API_KEY in de omgeving van de server, bijvoorbeeld in de Replit Secrets.',
    })
    return
  }

  const { messages, context } = req.body as {
    messages?: Array<{ role: 'user' | 'assistant'; content: string }>
    context?: unknown
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'geen-bericht', message: 'Er is geen gesprek meegestuurd.' })
    return
  }
  if (messages.length > 40) {
    res.status(400).json({ error: 'te-lang', message: 'Dit gesprek is te lang. Begin een nieuw gesprek.' })
    return
  }

  const client = new Anthropic()

  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 4000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      system: [
        // De instructie staat vooraan en verandert niet: dat houdt het
        // cachebare deel van elke aanvraag stabiel.
        { type: 'text', text: COACH_SYSTEM, cache_control: { type: 'ephemeral' } },
        {
          type: 'text',
          text: `DATA VAN DEZE GEBRUIKER\n${JSON.stringify(context ?? {}, null, 1)}`,
        },
      ],
      tools: [ADJUSTMENT_TOOL],
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    })

    const response = await stream.finalMessage()

    const parsed = parseCoachResponse(response, ADJUSTMENT_TOOL.name)

    res.json({
      ...parsed,
      usage: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
        cached: response.usage.cache_read_input_tokens ?? 0,
      },
    })
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      res.status(502).json({ error: 'sleutel-ongeldig', message: 'De API-sleutel wordt geweigerd. Controleer ANTHROPIC_API_KEY.' })
      return
    }
    if (error instanceof Anthropic.RateLimitError) {
      res.status(429).json({ error: 'te-druk', message: 'Even te veel aanvragen. Probeer het over een minuut opnieuw.' })
      return
    }
    if (error instanceof Anthropic.APIError) {
      console.error('Claude-fout', error.status, error.message)
      res.status(502).json({ error: 'api-fout', message: 'De coach is nu niet bereikbaar. Je programma werkt gewoon door.' })
      return
    }
    console.error(error)
    res.status(500).json({ error: 'onbekend', message: 'Er ging iets mis aan onze kant.' })
  }
})

// De gebouwde app. In ontwikkeling draait Vite hier zelf voor.
const dist = path.resolve(here, '..', 'dist')
app.use(express.static(dist))
app.get(/.*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')))

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Trainr draait op poort ${PORT}`)
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('Let op: ANTHROPIC_API_KEY ontbreekt. De app werkt, de coach niet.')
  }
})
