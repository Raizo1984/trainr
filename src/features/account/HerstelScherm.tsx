/**
 * Een nieuw wachtwoord instellen via de link uit de mail.
 *
 * Een eigen scherm en geen tabblad in de app: je komt hier binnen zonder
 * ingelogd te zijn, vanuit je mailprogramma, en dan hoort er niets anders in
 * beeld te staan dan dit.
 *
 * De app heeft verder geen routering. Dat hoeft ook niet voor één pad: de
 * server stuurt elk onbekend pad naar dezelfde pagina, en hier kijken we welk
 * pad dat was.
 */

import { useState } from 'react'
import { motion } from 'motion/react'
import { CircleCheck, KeyRound, TriangleAlert } from 'lucide-react'
import { Button, Card, Note, SectionTitle } from '@/ui/primitives'
import { zetNieuwWachtwoord } from './accountClient'

export const HERSTEL_PAD = '/wachtwoord-herstellen'

export function isHerstelPagina(): boolean {
  return typeof window !== 'undefined' && window.location.pathname === HERSTEL_PAD
}

function tokenUitAdres(): string {
  if (typeof window === 'undefined') return ''
  return new URLSearchParams(window.location.search).get('token') ?? ''
}

export function HerstelScherm() {
  const [token] = useState(tokenUitAdres)
  const [wachtwoord, setWachtwoord] = useState('')
  const [toon, setToon] = useState(false)
  const [bezig, setBezig] = useState(false)
  const [klaar, setKlaar] = useState<string | null>(null)
  const [fout, setFout] = useState<string | null>(null)

  const naarApp = () => {
    window.location.href = '/'
  }

  const opslaan = async () => {
    setBezig(true)
    setFout(null)
    try {
      setKlaar(await zetNieuwWachtwoord(token, wachtwoord))
    } catch (error) {
      setFout(error instanceof Error ? error.message : 'Het lukte niet.')
    } finally {
      setBezig(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-5 flex items-center gap-2.5">
          <div className="brand-gradient grid size-10 place-items-center rounded-xl text-white">
            <KeyRound className="size-5" />
          </div>
          <div>
            <div className="text-[17px] font-bold tracking-tight">Nieuw wachtwoord</div>
            <div className="text-[12.5px] text-ink-3">Voor je Trainr-account</div>
          </div>
        </div>

        <Card>
          {klaar ? (
            <>
              <SectionTitle
                title="Gelukt"
                subtitle={klaar}
                right={<CircleCheck className="size-4" style={{ color: 'var(--status-good)' }} />}
              />
              <Button onClick={naarApp}>Naar de app</Button>
            </>
          ) : !token ? (
            <>
              <SectionTitle
                title="Deze link is onvolledig"
                subtitle="Er staat geen code in het adres. Open de link uit de mail opnieuw, of vraag een nieuwe aan."
                right={<TriangleAlert className="size-4" style={{ color: 'var(--status-warn)' }} />}
              />
              <Button variant="ghost" onClick={naarApp}>
                Naar de app
              </Button>
            </>
          ) : (
            <>
              <SectionTitle
                title="Kies een nieuw wachtwoord"
                subtitle="Minstens 12 tekens. Een zin onthoud je beter dan een streepjescode, en is moeilijker te raden."
              />
              <label className="block">
                <span className="mb-1 block text-[11.5px] font-medium text-ink-2">Nieuw wachtwoord</span>
                <input
                  type={toon ? 'text' : 'password'}
                  value={wachtwoord}
                  autoComplete="new-password"
                  onChange={(e) => setWachtwoord(e.target.value)}
                  className="w-full rounded-xl border px-3.5 py-2.5 text-[13.5px] outline-none transition-colors focus:border-line-strong"
                  style={{ background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' }}
                />
              </label>
              <label className="mt-2 flex cursor-pointer items-center gap-2 text-[12.5px] text-ink-3">
                <input
                  type="checkbox"
                  checked={toon}
                  onChange={(e) => setToon(e.target.checked)}
                  className="size-3.5 accent-[var(--brand-1)]"
                />
                Laat zien wat ik typ
              </label>

              {fout && (
                <p className="mt-3 text-[12.5px] leading-snug" style={{ color: 'var(--status-serious)' }} role="status">
                  {fout}
                </p>
              )}

              <div className="mt-4">
                <Button onClick={opslaan} disabled={wachtwoord.length < 12 || bezig}>
                  {bezig ? 'Bezig' : 'Opslaan'}
                </Button>
              </div>
            </>
          )}

          <Note>Na het wijzigen ben je overal uitgelogd, ook op je andere apparaten.</Note>
        </Card>
      </motion.div>
    </div>
  )
}
