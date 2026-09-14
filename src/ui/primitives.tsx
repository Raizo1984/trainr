/**
 * UI-bouwstenen. Bewust klein gehouden: elk onderdeel doet één ding,
 * zodat schermen leesbaar blijven (principe 3, eenvoud boven complexiteit).
 */

import { motion } from 'motion/react'
import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

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
      {children}
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

export function NumberInput({
  value,
  onChange,
  suffix,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: number | null
  onChange: (value: number | null) => void
  suffix?: string
}) {
  return (
    <div className="relative">
      <input
        {...rest}
        type="number"
        inputMode="decimal"
        className="input num pr-12"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      />
      {suffix && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-ink-3">
          {suffix}
        </span>
      )}
    </div>
  )
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
    <p className="mt-3 border-t border-line pt-2.5 text-[11.5px] text-ink-3">
      <span className="font-medium">Bron:</span> {children}
    </p>
  )
}
