/**
 * Het eerste dat een nieuwe gebruiker ziet.
 *
 * Met een account blijft je programma bewaard als je je telefoon kwijtraakt en
 * kun je op meer apparaten. Zonder account staat alles alleen hier, en dat is
 * precies zo lang prima tot er iets misgaat.
 *
 * Toch geen harde muur. Een registratiescherm voordat iemand iets van de app
 * heeft gezien is de grootste afhaakplek die er is, en deze app begint al met
 * een intake van acht stappen. De uitweg staat er dus, maar klein en met de
 * gevolgen erbij, zodat niemand er per ongeluk in rolt.
 */

import { useState } from 'react'
import { motion } from 'motion/react'
import { Activity, CloudOff, LogIn, ShieldCheck, UserPlus } from 'lucide-react'
import { Button, Card, Note, SectionTitle } from '@/ui/primitives'
import { AanmeldCard } from './AccountCard'
import type { AccountStatus } from './accountClient'

type Stap = 'keuze' | 'formulier' | 'zonder'

export function WelkomScherm({
  onKlaar,
  onZonderAccount,
}: {
  onKlaar: (status: AccountStatus) => void
  onZonderAccount: () => void
}) {
  const [stap, setStap] = useState<Stap>('keuze')

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <div className="mb-6 flex items-center gap-3">
          <div className="brand-gradient grid size-12 place-items-center rounded-2xl text-white shadow-[0_8px_24px_-10px_var(--brand-1)]">
            <Activity className="size-6" strokeWidth={2.4} />
          </div>
          <div>
            <div className="text-[22px] font-bold tracking-tight">Trainr</div>
            <div className="text-[13px] text-ink-3">Een coach die je tegenhoudt wanneer dat moet</div>
          </div>
        </div>

        {stap === 'formulier' && (
          <>
            <AanmeldCard delay={0} onKlaar={onKlaar} />
            <div className="mt-3 text-center">
              <button
                onClick={() => setStap('keuze')}
                className="text-[12.5px] font-medium text-ink-3 underline underline-offset-2 hover:text-ink-2"
              >
                Terug
              </button>
            </div>
          </>
        )}

        {stap === 'keuze' && (
          <Card>
            <SectionTitle
              title="Maak een account"
              subtitle="Dan blijft je programma bewaard als je je telefoon kwijtraakt, en zie je op je laptop hetzelfde als op je telefoon."
              right={<ShieldCheck className="size-4 text-ink-3" />}
            />

            <div className="flex flex-col gap-2">
              <Button variant="primary" onClick={() => setStap('formulier')} icon={<UserPlus className="size-4" />}>
                Account maken
              </Button>
              <Button onClick={() => setStap('formulier')} icon={<LogIn className="size-4" />}>
                Ik heb al een account
              </Button>
            </div>

            <div className="mt-5 border-t pt-3" style={{ borderColor: 'var(--border-subtle)' }}>
              <button
                onClick={() => setStap('zonder')}
                className="text-[12.5px] font-medium text-ink-3 underline underline-offset-2 hover:text-ink-2"
              >
                Verder zonder account
              </button>
            </div>

            <Note>
              We bewaren je trainings-, pijn- en voedingsgegevens. Bij het aanmaken van een account
              lees je precies wat dat inhoudt en geef je daar apart toestemming voor.
            </Note>
          </Card>
        )}

        {stap === 'zonder' && (
          <Card>
            <SectionTitle
              title="Zonder account, wat betekent dat?"
              subtitle="De app werkt volledig. Maar er is één ding dat je moet weten voordat je begint."
              right={<CloudOff className="size-4 text-ink-3" />}
            />
            <ul className="space-y-2.5 text-[13px] leading-relaxed text-ink-2">
              <li>
                <span className="font-medium text-ink">Je gegevens staan alleen op dit toestel.</span> Er
                komt niets bij ons terecht, en dat is meteen het risico: raak je je telefoon kwijt of
                wis je de app, dan is je hele log weg. Wij kunnen dat niet terughalen.
              </li>
              <li>
                <span className="font-medium text-ink">Op een ander apparaat begin je opnieuw.</span> Je
                telefoon en je laptop weten niets van elkaar.
              </li>
              <li>
                <span className="font-medium text-ink">Je kunt dit later nog omzetten.</span> Maak je
                alsnog een account, dan gaat alles wat je tot dan hebt gelogd gewoon mee.
              </li>
            </ul>

            <div className="mt-5 flex flex-col gap-2">
              <Button variant="primary" onClick={() => setStap('formulier')} icon={<UserPlus className="size-4" />}>
                Toch een account maken
              </Button>
              <Button variant="ghost" onClick={onZonderAccount}>
                Ik begrijp het, ga verder zonder account
              </Button>
            </div>
          </Card>
        )}
      </motion.div>
    </div>
  )
}

/**
 * De tweede vraag, direct na de intake.
 *
 * Dit is het sterkste moment: iemand heeft net acht stappen ingevuld, en dan is
 * "zo raak je dit niet kwijt" een argument in plaats van een drempel. Eén keer
 * vragen, daarna niet meer, anders leert iemand hem wegklikken zonder te lezen.
 */
export function BewaarScherm({
  onKlaar,
  onLater,
}: {
  onKlaar: (status: AccountStatus) => void
  onLater: () => void
}) {
  const [formulier, setFormulier] = useState(false)

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        {formulier ? (
          <>
            <AanmeldCard delay={0} onKlaar={onKlaar} />
            <div className="mt-3 text-center">
              <button
                onClick={onLater}
                className="text-[12.5px] font-medium text-ink-3 underline underline-offset-2 hover:text-ink-2"
              >
                Toch later
              </button>
            </div>
          </>
        ) : (
          <Card>
            <SectionTitle
              title="Je programma staat klaar"
              subtitle="Nog één ding: wil je dit bewaren?"
              right={<ShieldCheck className="size-4 text-ink-3" />}
            />
            <p className="text-[13.5px] leading-relaxed text-ink-2">
              Je hebt net je intake ingevuld en daar is een programma uit gerold. Zonder account
              staat dat alleen op dit toestel. Raak je je telefoon kwijt, dan begin je opnieuw bij
              stap één.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <Button variant="primary" onClick={() => setFormulier(true)} icon={<UserPlus className="size-4" />}>
                Bewaar mijn programma
              </Button>
              <Button variant="ghost" onClick={onLater}>
                Later, ik wil eerst kijken
              </Button>
            </div>
            <Note>Je kunt dit altijd alsnog doen bij Instellingen. Wat je tot dan logt, gaat mee.</Note>
          </Card>
        )}
      </motion.div>
    </div>
  )
}
