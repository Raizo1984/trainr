/**
 * Account aanmaken, inloggen en beheren.
 *
 * Een account is niet verplicht. De app werkt zonder, en dan blijven je
 * gegevens op dit toestel. Dat is geen tussenoplossing maar een bewuste keuze:
 * wie geen gezondheidsgegevens op een server wil, hoeft dat niet.
 *
 * Bij het aanmaken staat de toestemming er niet als vinkje dat je wegklikt. Het
 * gaat om gegevens over pijn, blessures en eetgedrag, en de AVG vraagt daar
 * uitdrukkelijke toestemming voor. Die vraag hoort dus leesbaar te zijn.
 */

import { useEffect, useId, useState } from 'react'
import { motion } from 'motion/react'
import {
  CircleCheck,
  CloudOff,
  KeyRound,
  LogIn,
  LogOut,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
  UserPlus,
} from 'lucide-react'
import { Badge, Button, Card, SectionTitle, SourceNote, cx } from '@/ui/primitives'
import * as api from './accountClient'
import { PRIVACY, TOESTEMMING_TEKST } from './privacy'
import { houdServer, houdToestel, naInloggen, nuOpsturen, startSynchroniseren, stopSynchroniseren, useSync } from './sync'
import type { SyncStand, SyncStatus } from './sync'

type Modus = 'inloggen' | 'registreren'

export function AccountCard({ delay = 0 }: { delay?: number }) {
  const [status, setStatus] = useState<api.AccountStatus | null>(null)
  const [bezig, setBezig] = useState(false)
  const sync = useSync()

  useEffect(() => {
    let weg = false
    void api.status().then((s) => {
      if (weg) return
      setStatus(s)
      if (s.gebruiker) void naInloggen().then(() => startSynchroniseren(useSync.getState().versie))
    })
    return () => {
      weg = true
    }
  }, [])

  if (!status) return null

  if (!status.accountsMogelijk) {
    return (
      <Card delay={delay}>
        <SectionTitle
          title="Account"
          subtitle="Accounts staan uit op deze installatie."
          right={<CloudOff className="size-4 text-ink-3" />}
        />
        <p className="text-[13px] leading-relaxed text-ink-2">
          Je gegevens staan uitsluitend op dit toestel. Dat werkt prima en er komt niets bij ons
          terecht, maar het betekent ook dat je log weg is als je je toestel kwijtraakt. Maak
          hieronder een export als reservekopie.
        </p>
        <SourceNote>Voor accounts moet er een database aan de server hangen.</SourceNote>
      </Card>
    )
  }

  if (status.gebruiker) {
    return (
      <IngelogdCard
        email={status.gebruiker.email}
        delay={delay}
        bezig={bezig}
        setBezig={setBezig}
        onUitgelogd={() => {
          stopSynchroniseren()
          setStatus({ ...status, gebruiker: null })
        }}
        sync={sync}
      />
    )
  }

  return <AanmeldCard delay={delay} onKlaar={(s) => setStatus(s)} />
}

/* ------------------------------------------------------------------ */

function AanmeldCard({ delay, onKlaar }: { delay: number; onKlaar: (s: api.AccountStatus) => void }) {
  const [modus, setModus] = useState<Modus>('registreren')
  const [email, setEmail] = useState('')
  const [wachtwoord, setWachtwoord] = useState('')
  const [toestemming, setToestemming] = useState(false)
  const [toonPrivacy, setToonPrivacy] = useState(false)
  const [fout, setFout] = useState<string | null>(null)
  const [bezig, setBezig] = useState(false)

  const versturen = async () => {
    setBezig(true)
    setFout(null)
    try {
      if (modus === 'registreren') {
        await api.registreer(email, wachtwoord, toestemming)
      } else {
        await api.inloggen(email, wachtwoord)
      }
      const nieuw = await api.status()
      onKlaar(nieuw)
      await naInloggen()
      startSynchroniseren(useSync.getState().versie)
    } catch (error) {
      setFout(error instanceof Error ? error.message : 'Het lukte niet.')
    } finally {
      setBezig(false)
    }
  }

  const kanVerder =
    email.trim().length > 4 &&
    wachtwoord.length >= 12 &&
    (modus === 'inloggen' || toestemming)

  return (
    <Card delay={delay}>
      <SectionTitle
        title="Account"
        subtitle="Met een account staan je gegevens op al je apparaten. Zonder account blijven ze op dit toestel."
        right={<ShieldCheck className="size-4 text-ink-3" />}
      />

      <div className="mb-3 flex gap-1 rounded-xl p-1" style={{ background: 'var(--surface-2)' }}>
        {(['registreren', 'inloggen'] as const).map((m) => (
          <button
            key={m}
            onClick={() => {
              setModus(m)
              setFout(null)
            }}
            className={cx(
              'flex-1 rounded-lg py-2 text-[13px] font-medium transition-colors',
              modus === m ? 'text-ink' : 'text-ink-3 hover:text-ink-2',
            )}
            style={modus === m ? { background: 'var(--surface-1)', boxShadow: 'var(--shadow-card)' } : undefined}
          >
            {m === 'registreren' ? 'Account maken' : 'Inloggen'}
          </button>
        ))}
      </div>

      <div className="space-y-2.5">
        <Veld label="E-mailadres" type="email" value={email} onChange={setEmail} autoComplete="email" />
        <Veld
          label="Wachtwoord"
          type="password"
          value={wachtwoord}
          onChange={setWachtwoord}
          autoComplete={modus === 'registreren' ? 'new-password' : 'current-password'}
          hint={modus === 'registreren' ? 'Minstens 12 tekens. Een zin onthoud je beter dan een streepjescode.' : undefined}
        />
      </div>

      {modus === 'registreren' && (
        <div className="mt-3 rounded-xl border p-3" style={{ borderColor: 'var(--border-subtle)' }}>
          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              checked={toestemming}
              onChange={(e) => setToestemming(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-[var(--brand-1)]"
            />
            <span className="text-[12.5px] leading-relaxed text-ink-2">{TOESTEMMING_TEKST}</span>
          </label>
          <button
            onClick={() => setToonPrivacy((t) => !t)}
            className="mt-2 text-[12px] font-medium text-ink-3 underline underline-offset-2 hover:text-ink-2"
          >
            {toonPrivacy ? 'Verberg wat we precies bewaren' : 'Lees wat we precies bewaren'}
          </button>
          {toonPrivacy && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
              <div className="mt-2 space-y-3 border-t pt-3" style={{ borderColor: 'var(--border-subtle)' }}>
                {PRIVACY.map((blok) => (
                  <div key={blok.kop}>
                    <div className="text-[12.5px] font-semibold">{blok.kop}</div>
                    <ul className="mt-1 space-y-1">
                      {blok.regels.map((regel, i) => (
                        <li key={i} className="text-[12px] leading-relaxed text-ink-3">
                          {regel}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      )}

      {fout && (
        <p className="mt-3 text-[12.5px] leading-snug" style={{ color: 'var(--status-serious)' }} role="status">
          {fout}
        </p>
      )}

      <div className="mt-3">
        <Button
          onClick={versturen}
          disabled={!kanVerder || bezig}
          icon={modus === 'registreren' ? <UserPlus className="size-4" /> : <LogIn className="size-4" />}
        >
          {bezig ? 'Bezig' : modus === 'registreren' ? 'Account maken' : 'Inloggen'}
        </Button>
      </div>

      <SourceNote>
        Zonder account werkt alles gewoon door; je gegevens blijven dan op dit toestel.
      </SourceNote>
    </Card>
  )
}

/* ------------------------------------------------------------------ */

function IngelogdCard({
  email,
  delay,
  bezig,
  setBezig,
  onUitgelogd,
  sync,
}: {
  email: string
  delay: number
  bezig: boolean
  setBezig: (b: boolean) => void
  onUitgelogd: () => void
  sync: SyncStatus
}) {
  const [toonWachtwoord, setToonWachtwoord] = useState(false)
  const [huidig, setHuidig] = useState('')
  const [nieuw, setNieuw] = useState('')
  const [melding, setMelding] = useState<string | null>(null)
  const [fout, setFout] = useState<string | null>(null)
  const [verwijderTekst, setVerwijderTekst] = useState('')

  const uitloggen = async () => {
    setBezig(true)
    try {
      await nuOpsturen()
      await api.uitloggen()
      onUitgelogd()
    } finally {
      setBezig(false)
    }
  }

  return (
    <Card delay={delay}>
      <SectionTitle
        title="Account"
        subtitle={email}
        right={<SyncBadge stand={sync.stand} />}
      />

      {sync.stand === 'conflict' && (
        <div
          className="mb-3 rounded-xl border p-3"
          style={{ background: 'var(--status-warn-soft)', borderColor: 'color-mix(in oklab, var(--status-warn) 35%, transparent)' }}
        >
          <div className="flex items-start gap-2.5">
            <TriangleAlert className="mt-px size-4 shrink-0" style={{ color: 'var(--status-warn)' }} />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold" style={{ color: 'var(--status-warn)' }}>
                Twee versies van je gegevens
              </div>
              <p className="mt-0.5 text-[12.5px] leading-snug text-ink-2">{sync.melding}</p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => void houdToestel()}>
                  Houd dit toestel
                </Button>
                <Button size="sm" variant="ghost" onClick={houdServer}>
                  Houd de server
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {sync.stand !== 'conflict' && sync.melding && (
        <p className="mb-3 text-[12.5px] leading-snug text-ink-3" role="status">
          {sync.melding}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="ghost" onClick={() => void nuOpsturen()} icon={<RefreshCw className="size-4" />}>
          Nu synchroniseren
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setToonWachtwoord((t) => !t)} icon={<KeyRound className="size-4" />}>
          Wachtwoord wijzigen
        </Button>
        <Button size="sm" variant="ghost" onClick={() => void uitloggen()} disabled={bezig} icon={<LogOut className="size-4" />}>
          Uitloggen
        </Button>
      </div>

      {toonWachtwoord && (
        <div className="mt-3 space-y-2.5 border-t pt-3" style={{ borderColor: 'var(--border-subtle)' }}>
          <Veld label="Huidig wachtwoord" type="password" value={huidig} onChange={setHuidig} autoComplete="current-password" />
          <Veld label="Nieuw wachtwoord" type="password" value={nieuw} onChange={setNieuw} autoComplete="new-password" hint="Minstens 12 tekens." />
          <Button
            size="sm"
            disabled={nieuw.length < 12 || huidig.length === 0}
            onClick={async () => {
              setFout(null)
              setMelding(null)
              try {
                const uitgelogd = await api.wijzigWachtwoord(huidig, nieuw)
                setHuidig('')
                setNieuw('')
                setMelding(
                  uitgelogd > 0
                    ? `Gewijzigd. ${uitgelogd} ${uitgelogd === 1 ? 'ander apparaat is' : 'andere apparaten zijn'} uitgelogd.`
                    : 'Gewijzigd.',
                )
              } catch (error) {
                setFout(error instanceof Error ? error.message : 'Het lukte niet.')
              }
            }}
          >
            Opslaan
          </Button>
          {melding && <p className="text-[12.5px] text-ink-2">{melding}</p>}
          {fout && (
            <p className="text-[12.5px]" style={{ color: 'var(--status-serious)' }}>
              {fout}
            </p>
          )}
        </div>
      )}

      <div className="mt-4 border-t pt-3" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="text-[13px] font-semibold">Account verwijderen</div>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-3">
          Alles gaat weg: je sessies, metingen, pijnscores en je intake. Dit kan niet ongedaan
          gemaakt worden. Exporteer eerst als je je log wilt houden.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            value={verwijderTekst}
            onChange={(e) => setVerwijderTekst(e.target.value)}
            placeholder="Typ VERWIJDER"
            className="w-40 rounded-lg border px-3 py-1.5 text-[13px] outline-none"
            style={{ background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' }}
          />
          <Button
            size="sm"
            variant="ghost"
            disabled={verwijderTekst !== 'VERWIJDER'}
            onClick={async () => {
              try {
                await api.verwijderAccount()
                stopSynchroniseren()
                onUitgelogd()
              } catch (error) {
                setFout(error instanceof Error ? error.message : 'Het lukte niet.')
              }
            }}
          >
            Definitief verwijderen
          </Button>
        </div>
      </div>

      <SourceNote>Artikel 15 en 17 AVG: inzage via de export, verwijderen zonder omwegen.</SourceNote>
    </Card>
  )
}

function SyncBadge({ stand }: { stand: SyncStand }) {
  if (stand === 'conflict') return <Badge tone="warn">Keuze nodig</Badge>
  if (stand === 'fout') return <Badge tone="neutral">Niet bijgewerkt</Badge>
  if (stand === 'bezig' || stand === 'wachtend') return <Badge tone="neutral">Bijwerken</Badge>
  if (stand === 'gelijk') {
    return (
      <span className="flex items-center gap-1.5 text-[12px] text-ink-3">
        <CircleCheck className="size-3.5" style={{ color: 'var(--status-good)' }} />
        Bijgewerkt
      </span>
    )
  }
  return null
}

/*
 * De toelichting staat bewust buiten het label en is eraan gekoppeld met
 * aria-describedby. Zet je hem erbinnen, dan heet het veld voor een
 * schermlezer "Wachtwoord Minstens 12 tekens, een zin onthoud je beter", en
 * dat is geen naam maar een verhaal.
 */
function Veld({
  label,
  type,
  value,
  onChange,
  autoComplete,
  hint,
}: {
  label: string
  type: string
  value: string
  onChange: (v: string) => void
  autoComplete?: string
  hint?: string
}) {
  const id = useId()
  const hintId = `${id}-hint`
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[11.5px] font-medium text-ink-2">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        aria-describedby={hint ? hintId : undefined}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border px-3.5 py-2.5 text-[13.5px] outline-none transition-colors focus:border-line-strong"
        style={{ background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' }}
      />
      {hint && (
        <p id={hintId} className="mt-1 text-[11.5px] text-ink-3">
          {hint}
        </p>
      )}
    </div>
  )
}
