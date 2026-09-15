import { Suspense, useCallback, useEffect, useState, useTransition } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  Activity,
  CloudOff,
  Apple,
  Dumbbell,
  LayoutDashboard,
  MessageSquareWarning,
  Moon,
  Ruler,
  Settings,
  Sun,
  Route,
} from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { useAlerts } from '@/store/selectors'
import { useTheme } from '@/ui/theme'
import { cx } from '@/ui/primitives'
import { lazyScreen } from '@/ui/lazyScreen'
import { heeftAccount, markeerAccount, startSync, useSync } from '@/features/account/sync'
import { status as accountStatus } from '@/features/account/accountClient'
import { HerstelScherm, isHerstelPagina } from '@/features/account/HerstelScherm'
import { BewaarScherm, WelkomScherm } from '@/features/account/WelkomScherm'
import { leesKeuzes, vergeetKeuzes, zetKeuze } from '@/features/account/onboarding'
import type { AccountStatus } from '@/features/account/accountClient'
import Dashboard from '@/features/dashboard/Dashboard'

/**
 * Alleen het dashboard laadt meteen mee; dat is het scherm dat een terugkerende
 * gebruiker als eerste ziet. De rest komt pas binnen als je het tabblad opent.
 * Dat scheelt bij het opstarten de code van zes schermen die je op dat moment
 * niet bekijkt, wat telt op een telefoon met slecht bereik.
 */
const IntakeWizard = lazyScreen(() => import('@/features/intake/IntakeWizard'))
const SessionLogger = lazyScreen(() => import('@/features/session/SessionLogger'))
const PlanScreen = lazyScreen(() => import('@/features/plan/PlanScreen'))
const NutritionScreen = lazyScreen(() => import('@/features/nutrition/NutritionScreen'))
const MeasurementsScreen = lazyScreen(() => import('@/features/measurements/MeasurementsScreen'))
const CoachScreen = lazyScreen(() => import('@/features/coach/CoachScreen'))
const SettingsScreen = lazyScreen(() => import('@/features/settings/SettingsScreen'))

/**
 * Haalt de overige schermen op zodra de app stil ligt.
 *
 * Lui laden houdt het eerste scherm licht, maar zou elke tabwissel een
 * wachtmoment geven. Door de rest op te halen wanneer er toch niets gebeurt,
 * is het eerste scherm snel én voelt navigeren daarna direct. De browser
 * behandelt dit als werk met lage prioriteit, dus het vertraagt het eerste
 * scherm niet.
 */
function usePrefetchScreens(active: boolean) {
  useEffect(() => {
    if (!active) return
    let cancelled = false
    const run = () => {
      if (cancelled) return
      for (const screen of [SessionLogger, PlanScreen, CoachScreen, NutritionScreen, MeasurementsScreen, SettingsScreen]) {
        void screen.preload()
      }
    }
    // Direct na de eerste weergave, niet pas wanneer de browser niets meer te
    // doen heeft: requestIdleCallback duurde in de praktijk seconden en dan
    // kijkt de gebruiker bij de eerste tabwissel alsnog naar een skelet. Een
    // frame wachten houdt de eerste weergave vrij; samen zijn deze zes brokken
    // ongeveer 31 kB gecomprimeerd, dus daarna is er ruimte zat.
    const frame = requestAnimationFrame(run)
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
    }
  }, [active])
}

/**
 * Wie krijgt welk scherm te zien voordat de app zelf begint.
 *
 * Drie regels, en de eerste twee zijn er om te voorkomen dat bestaande
 * gebruikers ineens voor een dichte deur staan:
 *
 * - Wie op dit toestel al een account had, of al gegevens heeft staan, ziet het
 *   startscherm nooit. Een update mag niemand buitensluiten.
 * - Zonder verbinding weten we niets van accounts, en dan gaat de app gewoon
 *   open. Een inlogscherm in een sportschool zonder bereik is een app die niet
 *   werkt.
 * - Alleen wie helemaal nieuw is, krijgt de keuze. En daarna, na de intake, nog
 *   één keer de vraag; niet vaker, want dan leert iemand hem wegklikken zonder
 *   te lezen.
 */
type Toegang =
  | { stand: 'wachten' }
  | { stand: 'welkom'; gelukt: (s: AccountStatus) => void; zonderAccount: () => void }
  | { stand: 'bewaren'; gelukt: (s: AccountStatus) => void; later: () => void }
  | { stand: 'door' }

function useToegang(intakeDone: boolean): Toegang {
  const [status, setStatus] = useState<AccountStatus | null>(null)
  const [keuzes, setKeuzes] = useState(leesKeuzes)

  /*
   * Eén keer vastgesteld, bij het openen. Niet elke hertekening opnieuw: een
   * nieuwe gebruiker rondt de intake af binnen dezelfde sessie, en dan zou hij
   * halverwege ineens als bestaande gebruiker gelden en de tweede vraag nooit
   * krijgen.
   */
  const [bekendToestel] = useState(() => {
    const staat = useAppStore.getState()
    return heeftAccount() || staat.sessions.length > 0 || Boolean(staat.intake.completedAt)
  })

  useEffect(() => {
    let weg = false
    void accountStatus().then((s) => {
      if (!weg) setStatus(s)
    })
    return () => {
      weg = true
    }
  }, [])

  // Een toestel dat de app al gebruikt, hoeft nergens op te wachten.
  if (bekendToestel) return { stand: 'door' }
  if (status === null) return { stand: 'wachten' }
  if (!status.accountsMogelijk || status.gebruiker) return { stand: 'door' }

  const gelukt = (nieuw: AccountStatus) => {
    vergeetKeuzes()
    setKeuzes(leesKeuzes())
    setStatus(nieuw)
    startSync()
  }

  if (!keuzes.zonderAccount) {
    return {
      stand: 'welkom',
      gelukt,
      zonderAccount: () => {
        zetKeuze({ zonderAccount: true })
        setKeuzes(leesKeuzes())
      },
    }
  }

  if (intakeDone && !keuzes.naIntakeGevraagd) {
    return {
      stand: 'bewaren',
      gelukt,
      later: () => {
        zetKeuze({ naIntakeGevraagd: true })
        setKeuzes(leesKeuzes())
      },
    }
  }

  return { stand: 'door' }
}

/**
 * Synchroniseren aanzetten zodra de app opengaat.
 *
 * Bewust hier en niet in het instellingenscherm. Wie in de sportschool zonder
 * bereik zijn sets logt, komt daarna niet nog even bij Instellingen langs: hij
 * doet de app dicht. Als de synchronisatie pas op dat scherm begint, blijft die
 * training staan tot iemand er toevallig heen navigeert.
 */
function useSyncBijOpstart(): void {
  useEffect(() => {
    let weg = false

    /*
     * Eerst op wat dit toestel zelf weet, en pas daarna op wat de server zegt.
     * Zonder bereik kun je de server niets vragen, en juist dan moet de app al
     * bijhouden dat wat je invoert straks verstuurd moet worden.
     */
    if (heeftAccount()) startSync()

    void accountStatus().then((s) => {
      if (weg) return
      if (s.gebruiker) {
        startSync()
        return
      }
      // De server is bereikbaar en zegt dat je niet ingelogd bent. Alleen dan
      // is de conclusie dat dit toestel geen account heeft. Staat er nog
      // invoer klaar, dan blijft die staan; die is niets waard op de server
      // maar alles op dit toestel.
      if (s.accountsMogelijk && !useSync.getState().vuil) markeerAccount(false)
    })

    return () => {
      weg = true
    }
  }, [])
}

/**
 * Een stille melding wanneer er invoer klaarstaat die nog niet verstuurd is.
 *
 * Geen waarschuwing, want er is niets mis: je gegevens staan op je toestel en
 * gaan vanzelf mee. Maar je moet het wel kunnen zien, anders lijkt het alsof de
 * app je training is kwijtgeraakt.
 */
function SyncMelding() {
  const stand = useSync((s) => s.stand)
  const vuil = useSync((s) => s.vuil)
  if (!vuil || (stand !== 'offline' && stand !== 'fout')) return null
  return (
    <div
      className="mb-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-[12.5px] leading-snug"
      style={{ background: 'var(--surface-2)', borderColor: 'var(--border-subtle)', color: 'var(--ink-2)' }}
      role="status"
    >
      <CloudOff className="size-4 shrink-0 text-ink-3" />
      <span>Nog niet op de server. Je invoer staat op dit toestel en gaat mee zodra er verbinding is.</span>
    </div>
  )
}

/** Plaatshouder tijdens het laden van een scherm. Rustig, geen springerige layout. */
function ScreenFallback() {
  return (
    <div className="space-y-4" aria-label="Laden" role="status">
      {[0, 1].map((i) => (
        <div
          key={i}
          className="card animate-pulse"
          style={{ height: i === 0 ? 180 : 260, background: 'var(--surface-2)' }}
        />
      ))}
    </div>
  )
}

export type Tab = 'vandaag' | 'trainen' | 'plan' | 'voeding' | 'metingen' | 'coach' | 'instellingen'

const TABS: Array<{ id: Tab; label: string; icon: typeof Activity }> = [
  { id: 'vandaag', label: 'Vandaag', icon: LayoutDashboard },
  { id: 'trainen', label: 'Trainen', icon: Dumbbell },
  { id: 'plan', label: 'Plan', icon: Route },
  { id: 'voeding', label: 'Voeding', icon: Apple },
  { id: 'metingen', label: 'Metingen', icon: Ruler },
  { id: 'coach', label: 'Coach', icon: MessageSquareWarning },
  { id: 'instellingen', label: 'Instellingen', icon: Settings },
]

export default function App() {
  /*
   * De link uit de herstelmail komt op een eigen pad binnen. De server stuurt
   * elk onbekend pad naar deze pagina, dus hier kijken we welk pad dat was.
   * Dit gaat voor op alles: je komt hier zonder ingelogd te zijn, vanuit je
   * mailprogramma, en dan hoort er niets anders in beeld te staan.
   */
  const [herstelPagina] = useState(isHerstelPagina)

  const intakeDone = useAppStore((s) => Boolean(s.intake.completedAt))
  const toegang = useToegang(intakeDone)
  const [tab, setTabNow] = useState<Tab>('vandaag')
  const [, startTabChange] = useTransition()
  const { theme, toggle } = useTheme()
  usePrefetchScreens(intakeDone)
  useSyncBijOpstart()

  // Als overgang, niet als gewone toestandswijziging. Het nieuwe scherm wordt
  // apart ingeladen, en zonder overgang ruilt React het oude scherm meteen in
  // voor een leeg skelet. Zo blijft het vorige scherm staan tot het volgende
  // klaar is: bij een voorgeladen brok is dat onmerkbaar, en anders zie je
  // liever nog even het oude scherm dan een lege pagina.
  const setTab = useCallback((next: Tab) => {
    startTabChange(() => setTabNow(next))
  }, [])

  if (herstelPagina) return <HerstelScherm />

  // Zolang we niet weten of er accounts zijn, niets tonen aan iemand die nog
  // nergens is. Een flits van het startscherm bij een bestaande gebruiker is
  // erger dan een halve seconde leeg.
  if (toegang.stand === 'wachten') return <div className="min-h-dvh" />

  if (toegang.stand === 'welkom') {
    return <WelkomScherm onKlaar={toegang.gelukt} onZonderAccount={toegang.zonderAccount} />
  }

  if (!intakeDone) {
    return (
      <Suspense fallback={<div className="min-h-dvh" />}>
        <IntakeWizard theme={theme} onToggleTheme={toggle} />
      </Suspense>
    )
  }

  if (toegang.stand === 'bewaren') {
    return <BewaarScherm onKlaar={toegang.gelukt} onLater={toegang.later} />
  }

  return (
    <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[1180px] gap-6 px-4 pb-24 pt-0 md:px-6 md:pb-8 md:pt-6">
      <SideNav tab={tab} onChange={setTab} theme={theme} onToggleTheme={toggle} />

      <main className="min-w-0 flex-1">
        <MobileHeader tab={tab} onChange={setTab} theme={theme} onToggleTheme={toggle} />
        <SyncMelding />
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            <Suspense fallback={<ScreenFallback />}>
              {tab === 'vandaag' && <Dashboard onNavigate={setTab} />}
              {tab === 'trainen' && <SessionLogger />}
              {tab === 'plan' && <PlanScreen />}
              {tab === 'voeding' && <NutritionScreen />}
              {tab === 'metingen' && <MeasurementsScreen />}
              {tab === 'coach' && <CoachScreen />}
              {tab === 'instellingen' && <SettingsScreen />}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>

      <BottomNav tab={tab} onChange={setTab} />
    </div>
  )
}

/* ------------------------------------------------------------------ */

function useAlertCount(): number {
  const alerts = useAlerts()
  return alerts.filter((a) => a.severity !== 'info').length
}

function Brand() {
  const name = useAppStore((s) => s.intake.name)
  return (
    <div className="flex items-center gap-2.5 px-2 pb-1">
      <div className="brand-gradient grid size-9 shrink-0 place-items-center rounded-xl text-white shadow-[0_6px_18px_-8px_var(--brand-1)]">
        <Activity className="size-[18px]" strokeWidth={2.4} />
      </div>
      <div className="min-w-0">
        <div className="text-[15px] font-bold leading-tight tracking-tight">Trainr</div>
        <div className="truncate text-[11.5px] text-ink-3">{name || 'Evidence-based coach'}</div>
      </div>
    </div>
  )
}

/**
 * Kopbalk voor telefoons. De zijbalk is daar verborgen, dus zonder deze balk
 * zijn het thema en de instellingen onbereikbaar.
 */
function MobileHeader({
  tab,
  onChange,
  theme,
  onToggleTheme,
}: {
  tab: Tab
  onChange: (tab: Tab) => void
  theme: 'dark' | 'light'
  onToggleTheme: () => void
}) {
  const name = useAppStore((s) => s.intake.name)
  return (
    <header
      className="sticky top-0 z-30 -mx-4 mb-3 flex items-center gap-3 border-b px-4 py-2.5 backdrop-blur-xl md:hidden"
      style={{ background: 'color-mix(in oklab, var(--surface-base) 86%, transparent)', borderColor: 'var(--border-subtle)' }}
    >
      <div className="brand-gradient grid size-8 shrink-0 place-items-center rounded-[10px] text-white">
        <Activity className="size-4" strokeWidth={2.5} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-bold leading-tight tracking-tight">Trainr</div>
        <div className="truncate text-[11px] leading-tight text-ink-3">{name || 'Evidence-based coach'}</div>
      </div>
      <button
        onClick={onToggleTheme}
        aria-label={theme === 'dark' ? 'Lichte modus' : 'Donkere modus'}
        className="grid size-10 place-items-center rounded-xl text-ink-2 transition-colors active:bg-surface-3"
      >
        {theme === 'dark' ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
      </button>
      <button
        onClick={() => onChange('instellingen')}
        aria-label="Instellingen"
        className="grid size-10 place-items-center rounded-xl transition-colors active:bg-surface-3"
        style={{ color: tab === 'instellingen' ? 'var(--brand-2)' : 'var(--text-secondary)' }}
      >
        <Settings className="size-[18px]" />
      </button>
    </header>
  )
}

function SideNav({
  tab,
  onChange,
  theme,
  onToggleTheme,
}: {
  tab: Tab
  onChange: (tab: Tab) => void
  theme: 'dark' | 'light'
  onToggleTheme: () => void
}) {
  const alertCount = useAlertCount()

  return (
    <aside className="sticky top-6 hidden h-fit w-[210px] shrink-0 md:block">
      <Brand />
      <nav className="mt-4 flex flex-col gap-0.5">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = id === tab
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className={cx(
                'relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13.5px] font-medium transition-colors duration-150',
                active ? 'text-ink' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
              )}
            >
              {active && (
                <motion.span
                  layoutId="nav-active"
                  className="absolute inset-0 rounded-xl border"
                  style={{ background: 'var(--surface-1)', borderColor: 'var(--border-subtle)', boxShadow: 'var(--shadow-card)' }}
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                />
              )}
              <Icon className="relative size-[17px]" strokeWidth={active ? 2.3 : 2} style={active ? { color: 'var(--brand-2)' } : undefined} />
              <span className="relative">{label}</span>
              {id === 'coach' && alertCount > 0 && (
                <span
                  className="num relative ml-auto rounded-full px-1.5 py-px text-[10.5px] font-bold"
                  style={{ background: 'var(--status-serious)', color: 'var(--surface-1)' }}
                >
                  {alertCount}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      <button
        onClick={onToggleTheme}
        className="mt-5 flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
      >
        {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
        {theme === 'dark' ? 'Lichte modus' : 'Donkere modus'}
      </button>
    </aside>
  )
}

function BottomNav({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  const alertCount = useAlertCount()
  const items = TABS.filter((t) => t.id !== 'instellingen')

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      style={{ background: 'color-mix(in oklab, var(--surface-1) 88%, transparent)', borderColor: 'var(--border-subtle)' }}
    >
      <div className="flex items-stretch">
        {items.map(({ id, label, icon: Icon }) => {
          const active = id === tab
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className="relative flex flex-1 flex-col items-center gap-0.5 px-1 py-2"
              style={{ color: active ? 'var(--brand-2)' : 'var(--text-muted)' }}
            >
              <span className="relative">
                <Icon className="size-[19px]" strokeWidth={active ? 2.4 : 2} />
                {id === 'coach' && alertCount > 0 && (
                  <span
                    className="absolute -right-2 -top-1 size-2 rounded-full"
                    style={{ background: 'var(--status-serious)' }}
                  />
                )}
              </span>
              <span className="text-[10.5px] font-medium">{label}</span>
              {active && (
                <motion.span
                  layoutId="bottom-active"
                  className="absolute inset-x-3 top-0 h-[2.5px] rounded-full"
                  style={{ background: 'var(--brand-2)' }}
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

/** Zet de paginatitel op de actieve gebruiker, handig bij meerdere tabbladen. */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title
  }, [title])
}
