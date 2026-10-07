import { ChevronDown } from 'lucide-react'
import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { cn } from '../../lib/cn'

const control =
  'w-full rounded-lg bg-ink-900/70 px-3 text-sm text-ink-100 ring-1 ring-inset ring-white/10 transition placeholder:text-ink-500 ' +
  'hover:ring-white/16 focus:bg-ink-900 focus:outline-none focus:ring-2 focus:ring-cyan-400/60 disabled:opacity-50 aria-[invalid=true]:ring-rose-400/60'

interface FieldProps {
  label?: ReactNode
  hint?: ReactNode
  error?: string | null
  required?: boolean
  className?: string
  children: (id: string) => ReactNode
}

/** Etiket + kontrol + yardım/hata metni. */
export function Field({ label, hint, error, required, className, children }: FieldProps) {
  const id = useId()
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={id} className="text-[13px] font-medium text-ink-200">
          {label}
          {required && <span className="ml-0.5 text-cyan-400">*</span>}
        </label>
      )}
      {children(id)}
      {error ? (
        <p className="text-xs text-rose-300">{error}</p>
      ) : (
        hint && <p className="text-xs text-ink-400">{hint}</p>
      )}
    </div>
  )
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { leading?: ReactNode }>(
  function Input({ className, leading, ...rest }, ref) {
    if (leading) {
      return (
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-400">{leading}</span>
          <input ref={ref} className={cn(control, 'h-10 pl-9', className)} {...rest} />
        </div>
      )
    }
    return <input ref={ref} className={cn(control, 'h-10', className)} {...rest} />
  },
)

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...rest },
  ref,
) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(control, 'h-10 appearance-none pr-9', className)} {...rest}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-400" />
    </div>
  )
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return <textarea ref={ref} className={cn(control, 'min-h-24 py-2.5 leading-relaxed', className)} {...rest} />
  },
)

interface SwitchProps {
  checked: boolean
  onChange: (value: boolean) => void
  label?: ReactNode
  description?: ReactNode
  disabled?: boolean
  size?: 'sm' | 'md'
}

export function Switch({ checked, onChange, label, description, disabled, size = 'md' }: SwitchProps) {
  const track = size === 'sm' ? 'h-4 w-7' : 'h-5 w-9'
  const thumb = size === 'sm' ? 'size-3 data-[on=true]:translate-x-3' : 'size-4 data-[on=true]:translate-x-4'
  return (
    <label className={cn('inline-flex cursor-pointer items-center gap-2.5', disabled && 'cursor-not-allowed opacity-50')}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        data-on={checked}
        className={cn(
          'relative inline-flex shrink-0 items-center rounded-full p-0.5 transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70',
          checked ? 'bg-cyan-400/90' : 'bg-ink-600',
          track,
        )}
      >
        <span
          data-on={checked}
          className={cn('rounded-full bg-white shadow transition-transform', thumb)}
        />
      </button>
      {(label || description) && (
        <span className="flex flex-col">
          {label && <span className="text-[13px] text-ink-100">{label}</span>}
          {description && <span className="text-xs text-ink-400">{description}</span>}
        </span>
      )}
    </label>
  )
}

export function Checkbox({
  checked,
  onChange,
  label,
  indeterminate,
  ...rest
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label?: ReactNode
  indeterminate?: boolean
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'checked'>) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-ink-200">
      <input
        type="checkbox"
        checked={checked}
        ref={(el) => {
          if (el) el.indeterminate = Boolean(indeterminate)
        }}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 cursor-pointer rounded border-0 bg-ink-700 accent-cyan-400"
        {...rest}
      />
      {label}
    </label>
  )
}

/** Birbirini dışlayan seçenekler için segment kontrolü. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
}: {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: ReactNode; icon?: ReactNode }[]
  size?: 'sm' | 'md'
}) {
  return (
    <div className="inline-flex rounded-lg bg-ink-900/80 p-0.5 ring-1 ring-white/8">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md font-medium transition',
            size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-[13px]',
            value === opt.value
              ? 'bg-ink-600 text-ink-100 shadow ring-1 ring-white/10'
              : 'text-ink-400 hover:text-ink-200',
          )}
        >
          {opt.icon}
          {opt.label}
        </button>
      ))}
    </div>
  )
}
