import { useId } from 'react'
import { formatHm } from '../../lib/format'
import type { SkyPoint } from './orbit'

/** Geçiş boyunca elevasyon profili; "şimdi" çizgisi geçiş sürüyorsa gösterilir. */
export function ElevationChart({
  points,
  now,
  color,
  minElevation,
  height = 110,
}: {
  points: SkyPoint[]
  now: Date
  color: string
  minElevation: number
  height?: number
}) {
  const gid = useId().replace(/:/g, '')
  if (points.length < 2) return null
  const width = 320
  const pad = { l: 26, r: 8, t: 10, b: 18 }
  const t0 = points[0].t.getTime()
  const t1 = points[points.length - 1].t.getTime()
  const maxEl = Math.max(...points.map((p) => p.el))
  const top = Math.min(90, Math.max(30, Math.ceil((maxEl + 8) / 10) * 10))
  const x = (t: number) => pad.l + ((t - t0) / (t1 - t0)) * (width - pad.l - pad.r)
  const y = (el: number) => pad.t + (1 - Math.max(0, el) / top) * (height - pad.t - pad.b)

  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t.getTime()).toFixed(1)},${y(p.el).toFixed(1)}`).join('')
  const area = `${line}L${x(t1).toFixed(1)},${y(0)}L${x(t0).toFixed(1)},${y(0)}Z`
  const peak = points.reduce((best, p) => (p.el > best.el ? p : best), points[0])
  const nowMs = now.getTime()
  const inPass = nowMs >= t0 && nowMs <= t1

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Elevasyon profili">
      <defs>
        <linearGradient id={`${gid}-area`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.45" />
          <stop offset="1" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0, top / 2, top].map((el) => (
        <g key={el}>
          <line x1={pad.l} x2={width - pad.r} y1={y(el)} y2={y(el)} stroke="rgb(148 163 184 / 0.1)" />
          <text x={pad.l - 5} y={y(el) + 3} textAnchor="end" fontSize={8.5} fill="#5b6b88" className="num">
            {el}°
          </text>
        </g>
      ))}
      {minElevation > 0 && (
        <line x1={pad.l} x2={width - pad.r} y1={y(minElevation)} y2={y(minElevation)} stroke="#fbbf24" strokeOpacity={0.5} strokeDasharray="3 3" />
      )}
      <path d={area} fill={`url(#${gid}-area)`} />
      <path d={line} fill="none" stroke={color} strokeWidth={2} />
      <circle cx={x(peak.t.getTime())} cy={y(peak.el)} r={3} fill="#f8fafc" />
      <text x={x(peak.t.getTime())} y={y(peak.el) - 6} textAnchor="middle" fontSize={9} fill="#e2e8f0" className="num">
        {peak.el.toFixed(1)}°
      </text>
      {inPass && (
        <g>
          <line x1={x(nowMs)} x2={x(nowMs)} y1={pad.t} y2={y(0)} stroke="#f8fafc" strokeOpacity={0.7} strokeDasharray="2 2" />
          <circle cx={x(nowMs)} cy={pad.t} r={2.5} fill="#f8fafc" />
        </g>
      )}
      <text x={pad.l} y={height - 4} fontSize={9} fill="#8796b0" className="num">
        {formatHm(points[0].t)}
      </text>
      <text x={x(peak.t.getTime())} y={height - 4} textAnchor="middle" fontSize={9} fill="#8796b0" className="num">
        TCA {formatHm(peak.t)}
      </text>
      <text x={width - pad.r} y={height - 4} textAnchor="end" fontSize={9} fill="#8796b0" className="num">
        {formatHm(points[points.length - 1].t)}
      </text>
    </svg>
  )
}
