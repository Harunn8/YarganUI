import { FlaskConical, LogOut } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { dayOfYearUtc, formatTime, formatUtcTime } from '../../lib/format'
import { useNow } from '../../lib/useNow'
import { Badge } from '../ui/Badge'
import { navItems } from './Sidebar'

function Clock() {
  const now = useNow()
  return (
    <div className="hidden items-center gap-1 rounded-xl bg-ink-900/70 p-1 ring-1 ring-white/8 md:flex">
      <div className="rounded-lg bg-white/[0.04] px-3 py-1">
        <div className="label-caps !text-[9.5px] !tracking-[0.18em]">UTC · Gün {dayOfYearUtc(now)}</div>
        <div className="num text-[15px] leading-5 font-medium text-cyan-200">{formatUtcTime(now)}</div>
      </div>
      <div className="px-3 py-1">
        <div className="label-caps !text-[9.5px] !tracking-[0.18em]">Yerel</div>
        <div className="num text-[15px] leading-5 text-ink-200">{formatTime(now)}</div>
      </div>
    </div>
  )
}

export function Topbar() {
  const { pathname } = useLocation()
  const { userName, logout, expiresAt } = useAuth()
  const current = navItems.find((n) => pathname.startsWith(n.to))
  const initials = userName
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toLocaleUpperCase('tr-TR'))
    .join('')

  return (
    <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-white/6 bg-ink-950/70 px-6 backdrop-blur-xl">
      <div className="flex min-w-0 items-center gap-3">
        {current && <current.icon className="size-[18px] text-cyan-300" />}
        <div className="truncate text-[15px] font-semibold text-ink-100">{current?.label ?? 'Yargan'}</div>
        {import.meta.env.VITE_MOCK === 'true' && (
          <Badge tone="fuchsia" icon={<FlaskConical className="size-3" />}>
            Demo verisi
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-3">
        <Clock />
        <div className="flex items-center gap-2.5 rounded-xl py-1 pr-1 pl-1.5 ring-1 ring-white/8">
          <div className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-cyan-400 to-violet-500 text-xs font-bold text-ink-950">
            {initials || 'OP'}
          </div>
          <div className="hidden leading-tight sm:block">
            <div className="text-[13px] font-medium text-ink-100">{userName}</div>
            <div className="text-[11px] text-ink-400">
              {expiresAt ? `Oturum ${formatTime(expiresAt)}'e kadar` : 'Operatör'}
            </div>
          </div>
          <button
            type="button"
            onClick={() => logout('manual')}
            className="grid size-8 place-items-center rounded-lg text-ink-400 transition hover:bg-rose-500/10 hover:text-rose-300"
            title="Çıkış yap"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
