import { AlertTriangle, RotateCw } from 'lucide-react'
import type { ReactNode } from 'react'
import { errorMessage } from '../../api/http'
import { cn } from '../../lib/cn'
import { Button } from './Button'

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 px-6 py-12 text-center', className)}>
      {icon && (
        <div className="relative grid size-14 place-items-center rounded-2xl bg-gradient-to-b from-white/8 to-white/2 text-ink-300 ring-1 ring-white/10">
          {icon}
          <div className="absolute -inset-3 -z-10 rounded-3xl bg-cyan-400/5 blur-xl" />
        </div>
      )}
      <div>
        <p className="font-medium text-ink-100">{title}</p>
        {description && <p className="mx-auto mt-1 max-w-sm text-sm text-ink-400">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function ErrorState({ error, onRetry, compact }: { error: unknown; onRetry?: () => void; compact?: boolean }) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl bg-rose-500/8 text-sm ring-1 ring-rose-400/20',
        compact ? 'p-3' : 'm-5 p-4',
      )}
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-300" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-rose-200">Veri alınamadı</p>
        <p className="mt-0.5 break-words text-rose-200/70">{errorMessage(error)}</p>
      </div>
      {onRetry && (
        <Button size="xs" variant="ghost" icon={<RotateCw className="size-3.5" />} onClick={onRetry}>
          Tekrar dene
        </Button>
      )}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-gradient-to-r from-white/[0.04] via-white/[0.08] to-white/[0.04]',
        className,
      )}
    />
  )
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2.5 p-5">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  )
}
