import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface TabItem<T extends string> {
  value: T
  label: ReactNode
  icon?: ReactNode
  count?: number
}

export function Tabs<T extends string>({
  value,
  onChange,
  items,
  className,
}: {
  value: T
  onChange: (value: T) => void
  items: TabItem<T>[]
  className?: string
}) {
  return (
    <div role="tablist" className={cn('flex items-center gap-1 border-b border-white/6', className)}>
      {items.map((item) => {
        const active = item.value === value
        return (
          <button
            key={item.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              'relative -mb-px inline-flex items-center gap-2 px-3.5 py-2.5 text-[13px] font-medium transition',
              active ? 'text-ink-100' : 'text-ink-400 hover:text-ink-200',
            )}
          >
            {item.icon}
            {item.label}
            {item.count !== undefined && (
              <span
                className={cn(
                  'num rounded-full px-1.5 text-[10px] leading-4',
                  active ? 'bg-cyan-400/15 text-cyan-300' : 'bg-white/6 text-ink-400',
                )}
              >
                {item.count}
              </span>
            )}
            {active && (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-cyan-300 to-sky-400 shadow-[0_0_10px_rgb(34_211_238/0.7)]" />
            )}
          </button>
        )
      })}
    </div>
  )
}
