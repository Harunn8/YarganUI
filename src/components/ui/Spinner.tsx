import { cn } from '../../lib/cn'

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn('size-4 animate-spin', className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export function PageLoader({ label = 'Yükleniyor…' }: { label?: string }) {
  return (
    <div className="flex h-full min-h-[40vh] flex-col items-center justify-center gap-3 text-ink-300">
      <div className="relative size-12">
        <div className="absolute inset-0 rounded-full border border-cyan-400/20" />
        <div className="absolute inset-0 animate-orbit rounded-full [animation-duration:1.6s]">
          <div className="absolute -top-1 left-1/2 size-2 -translate-x-1/2 rounded-full bg-cyan-300 shadow-[0_0_12px_2px_rgb(34_211_238/0.7)]" />
        </div>
        <div className="absolute inset-[30%] rounded-full bg-gradient-to-br from-sky-400 to-sky-800" />
      </div>
      <span className="text-sm">{label}</span>
    </div>
  )
}
