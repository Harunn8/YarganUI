import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type Tone = 'neutral' | 'cyan' | 'emerald' | 'amber' | 'rose' | 'violet' | 'sky' | 'fuchsia'

const tones: Record<Tone, { badge: string; dot: string }> = {
  neutral: { badge: 'bg-white/6 text-ink-200 ring-white/10', dot: 'bg-ink-300' },
  cyan: { badge: 'bg-cyan-400/10 text-cyan-300 ring-cyan-400/25', dot: 'bg-cyan-300' },
  emerald: { badge: 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/25', dot: 'bg-emerald-300' },
  amber: { badge: 'bg-amber-400/10 text-amber-300 ring-amber-400/25', dot: 'bg-amber-300' },
  rose: { badge: 'bg-rose-400/10 text-rose-300 ring-rose-400/25', dot: 'bg-rose-300' },
  violet: { badge: 'bg-violet-400/10 text-violet-300 ring-violet-400/25', dot: 'bg-violet-300' },
  sky: { badge: 'bg-sky-400/10 text-sky-300 ring-sky-400/25', dot: 'bg-sky-300' },
  fuchsia: { badge: 'bg-fuchsia-400/10 text-fuchsia-300 ring-fuchsia-400/25', dot: 'bg-fuchsia-300' },
}

interface BadgeProps {
  tone?: Tone
  dot?: boolean
  pulse?: boolean
  icon?: ReactNode
  className?: string
  children: ReactNode
}

export function Badge({ tone = 'neutral', dot, pulse, icon, className, children }: BadgeProps) {
  const t = tones[tone]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ring-1 ring-inset',
        t.badge,
        className,
      )}
    >
      {dot && (
        <span className="relative flex size-1.5">
          {pulse && <span className={cn('absolute inline-flex size-full animate-ping rounded-full opacity-70', t.dot)} />}
          <span className={cn('relative inline-flex size-1.5 rounded-full', t.dot)} />
        </span>
      )}
      {icon}
      {children}
    </span>
  )
}

export function StatusDot({ tone = 'emerald', pulse }: { tone?: Tone; pulse?: boolean }) {
  const t = tones[tone]
  return (
    <span className="relative flex size-2">
      {pulse && <span className={cn('absolute inline-flex size-full animate-ping rounded-full opacity-60', t.dot)} />}
      <span className={cn('relative inline-flex size-2 rounded-full', t.dot)} />
    </span>
  )
}
