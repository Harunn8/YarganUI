import { Star } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import type { SatellitePassResponse } from '../../api/types'
import { cn } from '../../lib/cn'
import { formatDuration, formatHm, formatTime, parseApiDate } from '../../lib/format'
import type { PredictedPass, TrackedSatellite } from './orbit'
import { statusOf } from './passStatus'

interface Bar {
  id: string
  lane: string
  start: Date
  end: Date
  kind: 'scheduled' | 'predicted'
  status?: number
  important?: boolean
  maxElevation?: number
  color: string
  continuous?: boolean
}

const HOUR = 3_600_000

export function PassTimeline({
  passes,
  predicted,
  satellites,
  now,
  hoursBefore = 1,
  hoursAfter = 23,
}: {
  passes: SatellitePassResponse[]
  predicted: PredictedPass[]
  satellites: TrackedSatellite[]
  now: Date
  hoursBefore?: number
  hoursAfter?: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<{ bar: Bar; x: number; y: number } | null>(null)

  // Pencere başı saat başına hizalanır; böylece ızgara her saniye kaymaz.
  const windowStart = Math.floor((now.getTime() - hoursBefore * HOUR) / HOUR) * HOUR
  const windowEnd = windowStart + (hoursBefore + hoursAfter + 1) * HOUR
  const span = windowEnd - windowStart

  const { lanes, bars } = useMemo(() => {
    const colorOf = new Map(satellites.map((s) => [s.name.toLocaleLowerCase('tr-TR'), s.color]))
    const laneNames: string[] = satellites.map((s) => s.name)
    const laneKey = (name: string) => name.toLocaleLowerCase('tr-TR')
    const known = new Set(laneNames.map(laneKey))
    const result: Bar[] = []

    for (const p of passes) {
      const start = parseApiDate(p.aos)
      const end = parseApiDate(p.los)
      if (!start || !end || end.getTime() < windowStart || start.getTime() > windowEnd) continue
      if (!known.has(laneKey(p.name))) {
        known.add(laneKey(p.name))
        laneNames.push(p.name)
      }
      result.push({
        id: p.id,
        lane: laneKey(p.name),
        start,
        end,
        kind: 'scheduled',
        status: p.status,
        important: p.isImportant,
        color: colorOf.get(laneKey(p.name)) ?? '#94a3b8',
      })
    }

    const scheduled = result.slice()
    for (const p of predicted) {
      if (p.continuous) {
        result.push({
          id: `cont-${p.satKey}`,
          lane: laneKey(p.name),
          start: new Date(windowStart),
          end: new Date(windowEnd),
          kind: 'predicted',
          maxElevation: p.maxElevation,
          color: colorOf.get(laneKey(p.name)) ?? '#94a3b8',
          continuous: true,
        })
        continue
      }
      if (p.los.getTime() < windowStart || p.aos.getTime() > windowEnd) continue
      const lane = laneKey(p.name)
      // Aynı geçiş zaten planlıysa tahmini gösterme.
      const overlaps = scheduled.some((b) => b.lane === lane && b.start < p.los && p.aos < b.end)
      if (overlaps) continue
      result.push({
        id: `pred-${p.satKey}-${p.aos.getTime()}`,
        lane,
        start: p.aos,
        end: p.los,
        kind: 'predicted',
        maxElevation: p.maxElevation,
        color: colorOf.get(lane) ?? '#94a3b8',
      })
    }
    return { lanes: laneNames, bars: result }
  }, [passes, predicted, satellites, windowStart, windowEnd])

  const pct = (t: number) => ((t - windowStart) / span) * 100
  const ticks = Array.from({ length: hoursBefore + hoursAfter + 2 }, (_, i) => windowStart + i * HOUR)
  const nowPct = pct(now.getTime())

  if (lanes.length === 0) {
    return <p className="px-5 py-10 text-center text-sm text-ink-400">Zaman çizelgesinde gösterilecek uydu yok.</p>
  }

  return (
    <div ref={containerRef} className="relative px-5 pb-5">
      <div className="grid grid-cols-[150px_minmax(0,1fr)]">
        <div />
        <div className="relative h-7">
          {ticks.map((t, i) =>
            i % 2 === 0 && Math.abs(pct(t) - nowPct) > 3.2 ? (
              <span key={t} className="num absolute -translate-x-1/2 text-[10.5px] text-ink-500" style={{ left: `${pct(t)}%` }}>
                {formatHm(new Date(t))}
              </span>
            ) : null,
          )}
          <span
            className="num absolute top-0 -translate-x-1/2 rounded bg-cyan-400 px-1.5 text-[10.5px] font-semibold text-ink-950"
            style={{ left: `${nowPct}%` }}
          >
            {formatHm(now)}
          </span>
        </div>

        {lanes.map((name) => {
          const lane = name.toLocaleLowerCase('tr-TR')
          const laneBars = bars.filter((b) => b.lane === lane)
          const color = laneBars[0]?.color ?? satellites.find((s) => s.name === name)?.color ?? '#94a3b8'
          return (
            <div key={name} className="contents">
              <div className="flex h-10 items-center gap-2 border-t border-white/[0.04] pr-3">
                <span className="size-2 shrink-0 rounded-full" style={{ background: color }} />
                <span className="truncate text-[12.5px] font-medium text-ink-200">{name}</span>
              </div>
              <div className="relative h-10 border-t border-white/[0.04]">
                {ticks.map((t) => (
                  <span key={t} className="absolute inset-y-0 w-px bg-white/[0.035]" style={{ left: `${pct(t)}%` }} />
                ))}
                {laneBars.map((b) => {
                  const left = Math.max(0, pct(b.start.getTime()))
                  const right = Math.min(100, pct(b.end.getTime()))
                  const meta = b.status !== undefined ? statusOf(b.status) : null
                  return (
                    <div
                      key={b.id}
                      onMouseEnter={(e) => {
                        const rect = containerRef.current?.getBoundingClientRect()
                        const target = e.currentTarget.getBoundingClientRect()
                        if (rect) setHover({ bar: b, x: target.left - rect.left + target.width / 2, y: target.top - rect.top })
                      }}
                      onMouseLeave={() => setHover(null)}
                      className={cn(
                        'absolute top-2 bottom-2 min-w-[5px] cursor-default rounded-md ring-1 transition hover:brightness-125',
                        b.kind === 'predicted' ? 'border border-dashed bg-transparent ring-transparent' : meta?.bar,
                        b.status === 2 && 'animate-pulse',
                      )}
                      style={{
                        left: `${left}%`,
                        width: `${Math.max(0.35, right - left)}%`,
                        ...(b.kind === 'predicted' ? { borderColor: `${b.color}aa`, background: `${b.color}14` } : {}),
                      }}
                    >
                      {b.important && <Star className="absolute -top-1.5 -right-1.5 size-3 fill-amber-300 text-amber-300" />}
                      {b.continuous && (
                        <span className="absolute inset-0 flex items-center pl-3 text-[11px] font-medium text-ink-300">
                          Sürekli görünür · maks. el. {b.maxElevation?.toFixed(1)}°
                        </span>
                      )}
                    </div>
                  )
                })}
                {nowPct >= 0 && nowPct <= 100 && (
                  <span
                    className="absolute inset-y-0 w-px bg-cyan-300 shadow-[0_0_8px_rgb(34_211_238/0.9)]"
                    style={{ left: `${nowPct}%` }}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 pl-[150px] text-[11px] text-ink-400">
        {[0, 1, 2, 3, 4, 6].map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className={cn('h-2.5 w-5 rounded-sm ring-1', statusOf(s).bar)} />
            {statusOf(s).label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-5 rounded-sm border border-dashed border-ink-300" />
          Tahmini (planlanmamış)
        </span>
      </div>

      {hover && (
        <div
          className="pointer-events-none absolute z-20 w-56 -translate-x-1/2 -translate-y-[calc(100%+8px)] rounded-lg bg-ink-900/95 p-3 text-xs shadow-xl ring-1 ring-white/10 backdrop-blur"
          style={{ left: hover.x, top: hover.y }}
        >
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="font-semibold text-ink-100">{lanes.find((l) => l.toLocaleLowerCase('tr-TR') === hover.bar.lane)}</span>
            <span className={cn('text-[11px]', hover.bar.kind === 'predicted' ? 'text-ink-400' : 'text-ink-200')}>
              {hover.bar.kind === 'predicted' ? 'Tahmini' : statusOf(hover.bar.status ?? 0).label}
            </span>
          </div>
          <div className="num space-y-0.5 text-ink-300">
            <div>
              AOS {formatTime(hover.bar.start)} · LOS {formatTime(hover.bar.end)}
            </div>
            {!hover.bar.continuous && <div>Süre {formatDuration((hover.bar.end.getTime() - hover.bar.start.getTime()) / 1000)}</div>}
            {hover.bar.maxElevation !== undefined && <div>Maks. elevasyon {hover.bar.maxElevation.toFixed(1)}°</div>}
          </div>
        </div>
      )}
    </div>
  )
}
