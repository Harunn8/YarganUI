import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export function Table({ className, ...rest }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full border-separate border-spacing-0 text-left text-sm', className)} {...rest} />
    </div>
  )
}

export function THead({ className, ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('sticky top-0 z-10 bg-ink-850/95 backdrop-blur', className)} {...rest} />
}

export function TH({ className, ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'border-b border-white/6 px-4 py-2.5 text-[11px] font-semibold tracking-wider whitespace-nowrap text-ink-400 uppercase first:pl-5 last:pr-5',
        className,
      )}
      {...rest}
    />
  )
}

export function TR({ className, ...rest }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('group transition-colors hover:bg-white/[0.025]', className)} {...rest} />
}

export function TD({ className, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn(
        'border-b border-white/[0.04] px-4 py-3 align-middle text-ink-200 group-last:border-b-0 first:pl-5 last:pr-5',
        className,
      )}
      {...rest}
    />
  )
}
