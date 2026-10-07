import { AlertTriangle, Satellite } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Card, CardHeader } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/States'
import { cn } from '../../lib/cn'
import { formatCountdown, formatLat, formatLon } from '../../lib/format'
import type { GroundStation, PredictedPass, SatPosition, TrackedSatellite } from './orbit'
import { nextPassFor } from './useSatelliteTracker'

export function SatelliteList({
  satellites,
  positions,
  predicted,
  station,
  now,
  selectedKey,
  onSelect,
}: {
  satellites: TrackedSatellite[]
  positions: Record<string, SatPosition | null>
  predicted: PredictedPass[]
  station: GroundStation | null
  now: Date
  selectedKey: string | null
  onSelect: (key: string | null) => void
}) {
  const visibleCount = satellites.filter((s) => {
    const p = positions[s.key]
    return station && p && (p.elevation ?? -90) >= station.minElevation
  }).length

  return (
    <Card className="flex min-h-0 flex-col">
      <CardHeader
        icon={<Satellite className="size-4" />}
        title="Takip edilen uydular"
        subtitle={`${satellites.length} uydu · ${visibleCount} görünür`}
      />
      {satellites.length === 0 ? (
        <EmptyState
          className="py-8"
          title="Uydu yok"
          description="TLE yapılandırmasına uydu ekleyince burada canlı olarak listelenir."
        />
      ) : (
        <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 pb-3">
          {satellites.map((s) => {
            const p = positions[s.key]
            const active = s.key === selectedKey
            const inView = Boolean(station && p && (p.elevation ?? -90) >= station.minElevation)
            const next = station ? nextPassFor(predicted, s.key, now) : null
            return (
              <li key={s.key}>
                <button
                  type="button"
                  onClick={() => onSelect(active ? null : s.key)}
                  className={cn(
                    'group relative w-full overflow-hidden rounded-xl px-3.5 py-2.5 text-left transition',
                    active ? 'bg-white/[0.06] ring-1' : 'hover:bg-white/[0.035]',
                  )}
                  style={active ? { boxShadow: `inset 0 0 0 1px ${s.color}66` } : undefined}
                >
                  <span className="absolute top-2.5 bottom-2.5 left-0 w-[3px] rounded-r-full" style={{ background: s.color }} />
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-[13.5px] font-semibold text-ink-100">{s.name}</span>
                      {s.noradId && <span className="num text-[10.5px] text-ink-500">#{s.noradId}</span>}
                    </div>
                    {s.error ? (
                      <Badge tone="rose" icon={<AlertTriangle className="size-3" />}>
                        {s.error}
                      </Badge>
                    ) : inView ? (
                      <Badge tone="emerald" dot pulse>
                        <span className="num">El {(p?.elevation ?? 0).toFixed(0)}°</span>
                      </Badge>
                    ) : next?.continuous ? (
                      <Badge tone="sky">Sürekli</Badge>
                    ) : next ? (
                      <span className="num text-xs text-ink-300">
                        <span className="text-ink-500">AOS </span>
                        {formatCountdown(next.aos.getTime() - now.getTime())}
                      </span>
                    ) : station ? (
                      <span className="text-[11px] text-ink-500">24 sa geçiş yok</span>
                    ) : null}
                  </div>
                  {p && (
                    <div className="num mt-1 flex flex-wrap gap-x-3 text-[11.5px] text-ink-400">
                      <span>{Math.round(p.altKm).toLocaleString('tr-TR')} km</span>
                      <span>{p.speedKmS.toFixed(2)} km/s</span>
                      <span>
                        {formatLat(p.lat)} {formatLon(p.lon)}
                      </span>
                    </div>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
