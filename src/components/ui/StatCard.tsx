import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Skeleton } from './States'

const accents = {
  cyan: 'from-cyan-400/20 text-cyan-300 ring-cyan-400/25',
  violet: 'from-violet-400/20 text-violet-300 ring-violet-400/25',
  emerald: 'from-emerald-400/20 text-emerald-300 ring-emerald-400/25',
  amber: 'from-amber-400/20 text-amber-300 ring-amber-400/25',
  sky: 'from-sky-400/20 text-sky-300 ring-sky-400/25',
  fuchsia: 'from-fuchsia-400/20 text-fuchsia-300 ring-fuchsia-400/25',
}

export function StatCard({
  icon,
  label,
  value,
  sub,
  accent = 'cyan',
  loading,
  onClick,
}: {
  icon: ReactNode
  label: string
  value: ReactNode
  sub?: ReactNode
  accent?: keyof typeof accents
  loading?: boolean
  onClick?: () => void
}) {
  const className = cn(
    'panel group relative overflow-hidden p-4 text-left transition',
    onClick && 'cursor-pointer hover:-translate-y-0.5 hover:ring-1 hover:ring-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60',
  )
  const content = (
    <>
      <div
        className={cn(
          'pointer-events-none absolute -top-10 -right-10 size-32 rounded-full bg-gradient-to-br to-transparent opacity-60 blur-2xl',
          accents[accent].split(' ')[0],
        )}
      />
      <div className="flex items-center justify-between">
        <span className="label-caps">{label}</span>
        <span className={cn('grid size-8 place-items-center rounded-lg bg-gradient-to-b to-transparent ring-1', accents[accent])}>
          {icon}
        </span>
      </div>
      <div className="mt-3 text-3xl font-semibold tracking-tight text-ink-100">
        {loading ? <Skeleton className="h-8 w-16" /> : value}
      </div>
      {sub && <div className="mt-1 text-xs text-ink-400">{sub}</div>}
    </>
  )
  return onClick ? (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  )
}
