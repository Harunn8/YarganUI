import {
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  RadioTower,
  Satellite,
  Users,
  Workflow,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { services } from '../../api/http'
import { cn } from '../../lib/cn'
import { StatusDot } from '../ui/Badge'
import { Logo } from './Logo'
import { useHealth } from './useHealth'

export const navItems = [
  { to: '/dashboard', label: 'Genel Bakış', icon: LayoutDashboard },
  { to: '/satops', label: 'Uydu Operasyonları', icon: Satellite },
  { to: '/devices', label: 'Cihazlar', icon: RadioTower },
  { to: '/rules', label: 'Kurallar & Otomasyon', icon: Workflow },
  { to: '/users', label: 'Kullanıcılar', icon: Users },
]

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const health = useHealth()
  const results = health.data ?? []
  const upCount = results.filter((r) => r.ok).length

  return (
    <aside
      className={cn(
        'relative z-20 flex shrink-0 flex-col border-r border-white/6 bg-ink-900/60 backdrop-blur-xl transition-[width] duration-200',
        collapsed ? 'w-[76px]' : 'w-[76px] lg:w-64',
      )}
    >
      <div className={cn('flex h-16 items-center px-5', collapsed && 'justify-center px-0')}>
        <div className={cn(collapsed ? 'block' : 'lg:hidden')}>
          <Logo compact />
        </div>
        {!collapsed && (
          <div className="hidden lg:block">
            <Logo />
          </div>
        )}
      </div>

      <nav className="mt-2 flex flex-1 flex-col gap-1 px-3">
        <div className={cn('label-caps mb-1 px-3', collapsed ? 'hidden' : 'hidden lg:block')}>Operasyon</div>
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            title={label}
            className={({ isActive }) =>
              cn(
                'group relative flex h-10 items-center gap-3 rounded-lg px-3 text-[13.5px] font-medium transition',
                collapsed ? 'justify-center' : 'justify-center lg:justify-start',
                isActive
                  ? 'bg-gradient-to-r from-cyan-400/15 to-cyan-400/0 text-ink-100'
                  : 'text-ink-400 hover:bg-white/5 hover:text-ink-200',
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute top-2 bottom-2 left-0 w-0.5 rounded-full bg-cyan-300 shadow-[0_0_12px_rgb(34_211_238/0.9)]" />
                )}
                <Icon className={cn('size-[18px] shrink-0', isActive && 'text-cyan-300')} />
                <span className={cn('truncate', collapsed ? 'hidden' : 'hidden lg:inline')}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="space-y-3 border-t border-white/6 p-3">
        <div className={cn('rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/6', collapsed ? 'hidden' : 'hidden lg:block')}>
          <div className="mb-2 flex items-center justify-between">
            <span className="label-caps">Servisler</span>
            <span className="num text-[11px] text-ink-400">
              {health.isLoading ? '…' : `${upCount}/${services.length}`}
            </span>
          </div>
          <ul className="space-y-1.5">
            {services.map((s) => {
              const r = results.find((x) => x.service === s.name)
              return (
                <li key={s.name} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-ink-300">
                    <StatusDot tone={!r ? 'neutral' : r.ok ? 'emerald' : 'rose'} pulse={r?.ok} />
                    {s.label}
                  </span>
                  <span className="num text-[10.5px] text-ink-500">{r?.ok ? `${r.latencyMs} ms` : r ? 'kapalı' : ''}</span>
                </li>
              )
            })}
          </ul>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="hidden h-9 w-full items-center justify-center gap-2 rounded-lg text-xs text-ink-400 transition hover:bg-white/5 hover:text-ink-200 lg:flex"
          title={collapsed ? 'Menüyü genişlet' : 'Menüyü daralt'}
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          {!collapsed && <span>Daralt</span>}
        </button>
      </div>
    </aside>
  )
}
