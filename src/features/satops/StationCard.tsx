import { MapPin, Timer } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { formatCountdown, formatLat, formatLon } from '../../lib/format'
import type { GroundStation, PredictedPass, SatPosition, TrackedSatellite } from './orbit'

export function StationCard({
  station,
  satellites,
  positions,
  predicted,
  now,
}: {
  station: GroundStation | null
  satellites: TrackedSatellite[]
  positions: Record<string, SatPosition | null>
  predicted: PredictedPass[]
  now: Date
}) {
  if (!station) return null
  const t = now.getTime()
  const inView = satellites.filter((s) => (positions[s.key]?.elevation ?? -90) >= station.minElevation)
  const nextAos = predicted.find((p) => !p.continuous && p.aos.getTime() > t)

  return (
    <Card className="shrink-0 overflow-hidden">
      <div className="flex items-start gap-3 bg-gradient-to-r from-amber-400/10 to-transparent px-4 py-3.5">
        <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/30">
          <MapPin className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold text-ink-100">{station.name}</div>
          <div className="num mt-0.5 text-[11.5px] text-ink-400">
            {formatLat(station.lat)} · {formatLon(station.lon)} · {Math.round(station.altM)} m
          </div>
        </div>
        <div className="text-right">
          <div className="num text-lg leading-none font-semibold text-emerald-300">{inView.length}</div>
          <div className="mt-1 text-[10.5px] text-ink-400">görünür</div>
        </div>
      </div>
      <div className="grid grid-cols-3 divide-x divide-white/6 border-t border-white/6 text-center">
        <div className="px-2 py-2">
          <div className="label-caps !text-[9.5px]">Min. el.</div>
          <div className="num text-[13px] text-ink-100">{station.minElevation}°</div>
        </div>
        <div className="px-2 py-2">
          <div className="label-caps !text-[9.5px]">Hazırlık</div>
          <div className="num text-[13px] text-ink-100">{station.setupInterval} sn</div>
        </div>
        <div className="px-2 py-2">
          <div className="label-caps flex items-center justify-center gap-1 !text-[9.5px]">
            <Timer className="size-3" /> Sıradaki AOS
          </div>
          <div className="num truncate text-[13px] text-cyan-200" title={nextAos?.name}>
            {nextAos ? formatCountdown(nextAos.aos.getTime() - t) : '—'}
          </div>
        </div>
      </div>
    </Card>
  )
}
