/**
 * UI-bouwstenen. Bewust klein gehouden: elk onderdeel doet één ding,
 * zodat schermen leesbaar blijven (principe 3, eenvoud boven complexiteit).
 */

import { motion } from 'motion/react'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { Minus, Plus } from 'lucide-react'

export type Tone = 'good' | 'warn' | 'serious' | 'neutral' | 'brand'

export const TONE_STYLE: Record<Tone, { fg: string; bg: string; border: string }> = {
  good: { fg: 'var(--status-good)', bg: 'var(--status-good-soft)', border: 'color-mix(in oklab, var(--status-good) 35%, transparent)' },
  warn: { fg: 'var(--status-warn)', bg: 'var(--status-warn-soft)', border: 'color-mix(in oklab, var(--status-warn) 35%, transparent)' },
  serious: { fg: 'var(--status-serious)', bg: 'var(--status-serious-soft)', border: 'color-mix(in oklab, var(--status-serious) 35%, transparent)' },
  neutral: { fg: 'var(--status-neutral)', bg: 'var(--status-neutral-soft)', border: 'var(--border-subtle)' },
  brand: { fg: 'var(--brand-2)', bg: 'var(--brand-soft)', border: 'color-mix(in oklab, var(--brand-2) 35%, transparent)' },
}

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

/* ---------------------------------------------------------------- */

export function Card({
  children,
  className,
  delay = 0,
  as: _as,
}: {
  children: ReactNode
  className?: string
  delay?: number
  as?: never
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.22, 1, 0.36, 1] }}
      className={cx('card p-5', className)}
    >
      {children}
    </motion.section>
  )
}

export function SectionTitle({
  title,
  subtitle,
  right,
}: {
  title: string
  subtitle?: string
  right?: ReactNode
}) {
  return (
    <header className="mb-4 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[13px] text-ink-3">{subtitle}</p>}
      </div>
      {right}
    </header>
  )
}

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  const s = TONE_STYLE[tone]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold"
      style={{ color: s.fg, background: s.bg, border: `1px solid ${s.border}` }}
    >
      {children}
    </span>
  )
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'quiet' | 'danger'
  size?: 'sm' | 'md'
  icon?: ReactNode
}

export function Button({ variant = 'quiet', size = 'md', icon, children, className, ...rest }: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-150 disabled:opacity-45 disabled:cursor-not-allowed select-none'
  const sizing = size === 'sm' ? 'px-3 py-1.5 text-[13px]' : 'px-4 py-2.5 text-[14px]'

  const styles: Record<string, string> = {
    primary: 'brand-gradient text-white shadow-[0_6px_20px_-8px_var(--brand-1)] hover:brightness-110 active:scale-[0.985]',
    quiet: 'bg-surface-3 text-ink hover:bg-surface-2 border border-line active:scale-[0.985]',
    ghost: 'text-ink-2 hover:text-ink hover:bg-surface-3',
    danger: 'text-serious border hover:bg-serious-soft',
  }
  const inline = variant === 'danger' ? { borderColor: 'color-mix(in oklab, var(--status-serious) 35%, transparent)' } : undefined

  return (
    <button className={cx(base, sizing, styles[variant], className)} style={inline} {...rest}>
      {icon}
      {children}
    </button>
  )
}

/* ---------------------------------------------------------------- */

/**
 * Het label van het veld waar je in zit.
 *
 * Knoppen binnen een veld hebben een naam nodig die zegt wat ze doen, en
 * "omhoog" alleen is die naam niet: op een scherm met vier getalvelden staan
 * er dan vier knoppen met dezelfde naam. Het label staat al in Field, dus dat
 * geven we door in plaats van het op elke aanroep te herhalen.
 */
const VeldLabel = createContext<string>('')

export function Field({
  label,
  hint,
  children,
  required,
}: {
  label: string
  hint?: string
  children: ReactNode
  required?: boolean
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline gap-1.5 text-[13px] font-medium text-ink-2">
        {label}
        {required && <span style={{ color: 'var(--status-serious)' }}>*</span>}
      </span>
      <VeldLabel.Provider value={label}>{children}</VeldLabel.Provider>
      {hint && <span className="mt-1.5 block text-[12px] leading-relaxed text-ink-3">{hint}</span>}
    </label>
  )
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx('input', props.className)} />
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx('input', props.className)} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx('input', props.className)} />
}

/**
 * Een getalveld dat je ook leeg mag maken.
 *
 * Twee dingen gingen hier eerder mis, en allebei zaten ze het aanpassen van een
 * ingevuld getal in de weg.
 *
 * Het veld hield zijn eigen tekst niet vast. Bij elke toetsaanslag ging de
 * waarde naar boven, en waar de aanroeper een standaardwaarde teruggaf bij leeg
 * (`v ?? 3`) kwam die meteen weer terug: je wiste de 3, kreeg hem terug, typte
 * 5, en er stond 35. Nu houdt het veld vast wat je typt zolang je erin zit, en
 * pas als je eruit gaat wordt er afgerond, begrensd en zo nodig teruggevallen
 * op wat de aanroeper wil.
 *
 * En de pijltjes van een `type="number"` bestaan op een telefoon niet. Die
 * stonden er dus alleen op een desktop, terwijl je het veld juist in de
 * sportschool gebruikt. Nu staan er twee echte knoppen in, altijd, groot genoeg
 * voor een duim.
 */
export function NumberInput({
  value,
  onChange,
  suffix,
  min,
  max,
  step = 1,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'min' | 'max' | 'step'> & {
  value: number | null
  onChange: (value: number | null) => void
  suffix?: string
  min?: number
  max?: number
  step?: number
}) {
  const label = useContext(VeldLabel)
  const veld = useRef<HTMLInputElement>(null)
  const [tekst, setTekst] = useState(() => (value == null ? '' : String(value)))
  const [bezig, setBezig] = useState(false)

  // Zolang je in het veld zit is jouw tekst de waarheid, ook als die tekst
  // even leeg of onaf is. Daarbuiten volgt het veld de waarde van buiten.
  useEffect(() => {
    if (bezig) return
    setTekst(value == null ? '' : String(value))
  }, [value, bezig])

  const begrens = (n: number) => {
    let v = n
    if (typeof min === 'number' && v < min) v = min
    if (typeof max === 'number' && v > max) v = max
    // Halve stappen leveren anders 52.500000000000004 op.
    return Math.round(v * 1000) / 1000
  }

  const stap = (richting: 1 | -1) => {
    const vanaf = lees(tekst) ?? value ?? (typeof min === 'number' ? min : 0)
    const nieuw = begrens(vanaf + richting * step)
    setTekst(String(nieuw))
    onChange(nieuw)
  }

  const knop = 'grid size-11 shrink-0 place-items-center rounded-lg text-ink-2 transition-colors hover:text-ink active:scale-95 disabled:opacity-30'
  const opGrens = (richting: 1 | -1) => {
    const huidig = lees(tekst) ?? value
    if (huidig == null) return false
    return richting === -1 ? typeof min === 'number' && huidig <= min : typeof max === 'number' && huidig >= max
  }

  return (
    <div className="input-groep">
      <input
        {...rest}
        ref={veld}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className="num"
        value={tekst}
        onFocus={() => setBezig(true)}
        onChange={(e) => {
          const schoon = zuiver(e.target.value)
          // Een geweigerd teken verandert de staat niet, dus React tekent niets
          // opnieuw en blijft die letter in het veld staan. Daarom zetten we de
          // waarde hier zelf terug.
          if (schoon !== e.target.value && veld.current) veld.current.value = schoon
          if (schoon === tekst) return
          setTekst(schoon)
          onChange(lees(schoon))
        }}
        onBlur={() => {
          setBezig(false)
          const gelezen = lees(tekst)
          if (gelezen == null) {
            // Leeg laten mag. Wat er dan hoort te staan bepaalt de aanroeper,
            // en dat komt via `value` vanzelf weer terug in beeld.
            onChange(null)
            return
          }
          const binnen = begrens(gelezen)
          setTekst(String(binnen))
          if (binnen !== value) onChange(binnen)
        }}
      />
      {suffix && <span className="shrink-0 pr-1 text-[12px] text-ink-3">{suffix}</span>}
      <span className="flex shrink-0 items-center pr-1">
        <button
          type="button"
          className={knop}
          onClick={() => stap(-1)}
          disabled={opGrens(-1)}
          aria-label={label ? `${label} omlaag` : 'Omlaag'}
        >
          <Minus className="size-3.5" />
        </button>
        <button
          type="button"
          className={knop}
          onClick={() => stap(1)}
          disabled={opGrens(1)}
          aria-label={label ? `${label} omhoog` : 'Omhoog'}
        >
          <Plus className="size-3.5" />
        </button>
      </span>
    </div>
  )
}

/**
 * Alleen cijfers, hoogstens één scheidingsteken en een minteken vooraan.
 *
 * Wat er halverwege het typen staat mag onaf zijn: leeg, "-", "1," — anders
 * kun je een getal niet aanpassen zonder het eerst goed te maken.
 */
function zuiver(tekst: string): string {
  let rest = tekst.replace(/[^0-9.,-]/g, '')
  const teken = rest.startsWith('-') ? '-' : ''
  rest = rest.replace(/-/g, '')
  const scheiding = rest.search(/[.,]/)
  if (scheiding !== -1) {
    rest = rest.slice(0, scheiding + 1) + rest.slice(scheiding + 1).replace(/[.,]/g, '')
  }
  return teken + rest
}

/** Wat er in het veld staat als getal, of null als het (nog) geen getal is. */
function lees(tekst: string): number | null {
  const schoon = tekst.replace(',', '.').trim()
  if (schoon === '' || schoon === '-' || schoon === '.' || schoon === '-.') return null
  const getal = Number(schoon)
  return Number.isFinite(getal) ? getal : null
}

/** Keuzeknoppen. Duidelijker dan een dropdown bij weinig opties. */
export function ChoiceGroup<T extends string>({
  value,
  options,
  onChange,
  columns = 2,
}: {
  value: T
  options: Array<{ value: T; label: string; hint?: string }>
  onChange: (value: T) => void
  columns?: number
}) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cx(
              'relative rounded-xl border px-3 py-2.5 text-left transition-all duration-150',
              active ? 'border-transparent text-ink' : 'border-line bg-surface-2 text-ink-2 hover:border-line-strong',
            )}
            style={
              active
                ? {
                    background: 'var(--brand-soft)',
                    boxShadow: 'inset 0 0 0 1.5px var(--brand-2)',
                  }
                : undefined
            }
          >
            <span className="block text-[13.5px] font-semibold">{option.label}</span>
            {option.hint && <span className="mt-0.5 block text-[12px] text-ink-3">{option.hint}</span>}
          </button>
        )
      })}
    </div>
  )
}

export function CheckRow({
  checked,
  onChange,
  label,
  hint,
  tone = 'brand',
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  hint?: string
  tone?: Tone
}) {
  const s = TONE_STYLE[tone]
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cx(
        'flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-all duration-150',
        checked ? 'border-transparent' : 'border-line bg-surface-2 hover:border-line-strong',
      )}
      style={checked ? { background: s.bg, boxShadow: `inset 0 0 0 1.5px ${s.fg}` } : undefined}
    >
      <span
        className="mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-[6px] border transition-colors"
        style={
          checked
            ? { background: s.fg, borderColor: s.fg }
            : { borderColor: 'var(--border-strong)' }
        }
      >
        {checked && (
          <svg viewBox="0 0 12 12" className="size-3" fill="none" stroke="var(--surface-1)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2.5 6.2 4.8 8.5 9.5 3.5" />
          </svg>
        )}
      </span>
      <span className="min-w-0">
        <span className="block text-[13.5px] font-medium text-ink">{label}</span>
        {hint && <span className="mt-0.5 block text-[12px] leading-snug text-ink-3">{hint}</span>}
      </span>
    </button>
  )
}

/** Schaalkiezer voor pijn (0-10) en de 1-5 schalen. */
export function ScalePicker({
  value,
  onChange,
  min = 0,
  max = 10,
  labels,
  tone = 'brand',
}: {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  labels?: [string, string]
  tone?: Tone
}) {
  const steps = Array.from({ length: max - min + 1 }, (_, i) => min + i)
  const s = TONE_STYLE[tone]
  return (
    <div>
      <div className="flex gap-1">
        {steps.map((step) => {
          const active = step === value
          return (
            <button
              key={step}
              type="button"
              aria-label={`${step}`}
              onClick={() => onChange(step)}
              className={cx(
                'num relative h-9 flex-1 rounded-lg border text-[13px] font-semibold transition-all duration-150',
                active ? 'border-transparent' : 'border-line bg-surface-2 text-ink-3 hover:border-line-strong hover:text-ink-2',
              )}
              style={active ? { background: s.fg, color: 'var(--surface-1)' } : undefined}
            >
              {step}
            </button>
          )
        })}
      </div>
      {labels && (
        <div className="mt-1.5 flex justify-between text-[11.5px] text-ink-3">
          <span>{labels[0]}</span>
          <span>{labels[1]}</span>
        </div>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- */

export function Stat({
  label,
  value,
  unit,
  tone = 'neutral',
  hint,
  delay = 0,
}: {
  label: string
  value: string | number
  unit?: string
  tone?: Tone
  hint?: string
  delay?: number
}) {
  const s = TONE_STYLE[tone]
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: [0.22, 1, 0.36, 1] }}
      className="card-quiet px-4 py-3.5"
    >
      <div className="text-[11.5px] font-medium uppercase tracking-wide text-ink-3">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="num text-[25px] font-bold leading-none" style={{ color: tone === 'neutral' ? 'var(--text-primary)' : s.fg }}>
          {value}
        </span>
        {unit && <span className="text-[12.5px] font-medium text-ink-3">{unit}</span>}
      </div>
      {hint && <div className="mt-1.5 text-[12px] leading-snug text-ink-3">{hint}</div>}
    </motion.div>
  )
}

/** Voortgangsring. Gebruikt voor opkomst en gate-voortgang. */
export function ProgressRing({
  value,
  size = 76,
  stroke = 7,
  tone = 'brand',
  children,
}: {
  value: number
  size?: number
  stroke?: number
  tone?: Tone
  children?: ReactNode
}) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(1, value))
  const s = TONE_STYLE[tone]

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={s.fg}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - clamped) }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  )
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line px-6 py-10 text-center">
      {icon && <div className="text-ink-3">{icon}</div>}
      <div>
        <p className="text-[14px] font-semibold text-ink">{title}</p>
        <p className="mx-auto mt-1 max-w-sm text-[13px] leading-relaxed text-ink-3">{body}</p>
      </div>
      {action}
    </div>
  )
}

/** Herkomstvermelding onder adviezen, zodat elk advies traceerbaar blijft. */
export function SourceNote({ children }: { children: ReactNode }) {
  return (
    <Note>
      <span className="font-medium">Bron:</span> {children}
    </Note>
  )
}

/**
 * Dezelfde kleine regel onderaan een kaart, maar zonder "Bron:".
 *
 * Niet elke slotregel verwijst naar de documentatie. Staat er "Bron: Zonder
 * account werkt alles gewoon door", dan leest dat als een verwijzing naar iets
 * wat niet bestaat.
 */
export function Note({ children }: { children: ReactNode }) {
  return <p className="mt-3 border-t border-line pt-2.5 text-[11.5px] text-ink-3">{children}</p>
}
