import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  Activity,
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
import IntakeWizard from '@/features/intake/IntakeWizard'
import Dashboard from '@/features/dashboard/Dashboard'
import SessionLogger from '@/features/session/SessionLogger'
import PlanScreen from '@/features/plan/PlanScreen'
import NutritionScreen from '@/features/nutrition/NutritionScreen'
import MeasurementsScreen from '@/features/measurements/MeasurementsScreen'
import CoachScreen from '@/features/coach/CoachScreen'
import SettingsScreen from '@/features/settings/SettingsScreen'

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
  const intakeDone = useAppStore((s) => Boolean(s.intake.completedAt))
  const [tab, setTab] = useState<Tab>('vandaag')
  const { theme, toggle } = useTheme()

  if (!intakeDone) return <IntakeWizard theme={theme} onToggleTheme={toggle} />

  return (
    <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[1180px] gap-6 px-4 pb-24 pt-0 md:px-6 md:pb-8 md:pt-6">
      <SideNav tab={tab} onChange={setTab} theme={theme} onToggleTheme={toggle} />

      <main className="min-w-0 flex-1">
        <MobileHeader tab={tab} onChange={setTab} theme={theme} onToggleTheme={toggle} />
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            {tab === 'vandaag' && <Dashboard onNavigate={setTab} />}
            {tab === 'trainen' && <SessionLogger />}
            {tab === 'plan' && <PlanScreen />}
            {tab === 'voeding' && <NutritionScreen />}
            {tab === 'metingen' && <MeasurementsScreen />}
            {tab === 'coach' && <CoachScreen />}
            {tab === 'instellingen' && <SettingsScreen />}
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
