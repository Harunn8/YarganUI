import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Spinner } from './Spinner'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline'
type Size = 'xs' | 'sm' | 'md' | 'icon' | 'icon-sm'

const variants: Record<Variant, string> = {
  primary:
    'bg-gradient-to-b from-cyan-400 to-cyan-500 text-ink-950 font-semibold shadow-[0_0_0_1px_rgb(34_211_238/0.5),0_8px_24px_-10px_rgb(34_211_238/0.8)] hover:from-cyan-300 hover:to-cyan-400',
  secondary: 'bg-ink-700/80 text-ink-100 ring-1 ring-inset ring-white/8 hover:bg-ink-600/80',
  outline: 'text-ink-100 ring-1 ring-inset ring-white/12 hover:bg-white/5',
  ghost: 'text-ink-200 hover:bg-white/6 hover:text-ink-100',
  danger: 'bg-rose-500/15 text-rose-300 ring-1 ring-inset ring-rose-400/30 hover:bg-rose-500/25',
  success: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-400/30 hover:bg-emerald-500/25',
}

const sizes: Record<Size, string> = {
  xs: 'h-7 px-2.5 text-xs gap-1.5 rounded-md',
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-lg',
  icon: 'size-9 rounded-lg justify-center',
  'icon-sm': 'size-7 rounded-md justify-center',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: ReactNode
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, loading, disabled, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex shrink-0 items-center whitespace-nowrap font-medium transition-all duration-150 select-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 focus-visible:ring-offset-0',
        'disabled:pointer-events-none disabled:opacity-45 active:translate-y-px',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner className={size === 'xs' ? 'size-3' : 'size-4'} /> : icon}
      {children}
    </button>
  )
})
