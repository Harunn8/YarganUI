import { cn } from '../../lib/cn'

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn('size-9', className)} aria-hidden>
      <defs>
        <radialGradient id="logo-planet" cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor="#7dd3fc" />
          <stop offset="0.55" stopColor="#0284c7" />
          <stop offset="1" stopColor="#0c2a4a" />
        </radialGradient>
        <linearGradient id="logo-ring" x1="0" x2="1">
          <stop offset="0" stopColor="#22d3ee" stopOpacity="0.1" />
          <stop offset="0.5" stopColor="#22d3ee" />
          <stop offset="1" stopColor="#a78bfa" />
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r="9" fill="url(#logo-planet)" />
      <ellipse
        cx="20"
        cy="20"
        rx="17"
        ry="6.5"
        fill="none"
        stroke="url(#logo-ring)"
        strokeWidth="1.8"
        transform="rotate(-24 20 20)"
      />
      <circle cx="34.6" cy="12.6" r="2.6" fill="#f0abfc">
        <animate attributeName="opacity" values="1;0.55;1" dur="2.4s" repeatCount="indefinite" />
      </circle>
    </svg>
  )
}

export function Logo({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark />
      {!compact && (
        <div className="leading-none">
          <div className="text-[15px] font-bold tracking-[0.28em] text-ink-100">YARGAN</div>
          <div className="mt-1 text-[10px] font-medium tracking-[0.16em] text-ink-400 uppercase">Yer İstasyonu</div>
        </div>
      )}
    </div>
  )
}
