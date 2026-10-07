import type { SkyPoint } from './orbit'

const cardinal = [
  { label: 'K', az: 0 },
  { label: 'D', az: 90 },
  { label: 'G', az: 180 },
  { label: 'B', az: 270 },
]

/** Polar gök haritası: merkez başucu (90°), dış çember ufuk (0°), kuzey yukarıda. */
export function SkyPlot({
  points,
  current,
  color,
  minElevation,
  size = 200,
}: {
  points: SkyPoint[]
  current?: { az: number; el: number } | null
  color: string
  minElevation: number
  size?: number
}) {
  const c = size / 2
  const R = c - 18
  const toXY = (az: number, el: number): [number, number] => {
    const r = ((90 - Math.max(0, el)) / 90) * R
    const a = (az * Math.PI) / 180
    return [c + r * Math.sin(a), c - r * Math.cos(a)]
  }
  const visible = points.filter((p) => p.el >= -0.5)
  const d = visible.map((p, i) => `${i ? 'L' : 'M'}${toXY(p.az, p.el).map((v) => v.toFixed(1)).join(',')}`).join('')
  const first = visible[0]
  const last = visible[visible.length - 1]
  const peak = visible.reduce<SkyPoint | null>((best, p) => (!best || p.el > best.el ? p : best), null)

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[220px]" role="img" aria-label="Gök haritası">
      <defs>
        <radialGradient id="sky-bg">
          <stop offset="0" stopColor="#0f2443" />
          <stop offset="1" stopColor="#070d1a" />
        </radialGradient>
      </defs>
      <circle cx={c} cy={c} r={R} fill="url(#sky-bg)" stroke="rgb(148 163 184 / 0.25)" />
      {[30, 60].map((el) => (
        <circle key={el} cx={c} cy={c} r={((90 - el) / 90) * R} fill="none" stroke="rgb(148 163 184 / 0.14)" />
      ))}
      {minElevation > 0 && (
        <circle cx={c} cy={c} r={((90 - minElevation) / 90) * R} fill="none" stroke="#fbbf24" strokeOpacity={0.45} strokeDasharray="3 3" />
      )}
      {[0, 45, 90, 135].map((az) => {
        const [x1, y1] = toXY(az, 0)
        const [x2, y2] = toXY(az + 180, 0)
        return <line key={az} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgb(148 163 184 / 0.1)" />
      })}
      {cardinal.map(({ label, az }) => {
        const [x, y] = toXY(az, -14)
        return (
          <text key={label} x={x} y={y + 3.5} textAnchor="middle" fontSize={10} fontWeight={600} fill="#8796b0">
            {label}
          </text>
        )
      })}
      <text x={c + 3} y={c - ((90 - 30) / 90) * R - 2} fontSize={8} fill="#5b6b88">
        30°
      </text>
      <text x={c + 3} y={c - ((90 - 60) / 90) * R - 2} fontSize={8} fill="#5b6b88">
        60°
      </text>

      {d && (
        <>
          <path d={d} fill="none" stroke={color} strokeWidth={6} strokeOpacity={0.15} strokeLinecap="round" />
          <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
        </>
      )}
      {first && (
        <circle cx={toXY(first.az, first.el)[0]} cy={toXY(first.az, first.el)[1]} r={3.5} fill="#34d399" stroke="#04070e" />
      )}
      {last && (
        <circle cx={toXY(last.az, last.el)[0]} cy={toXY(last.az, last.el)[1]} r={3.5} fill="#fb7185" stroke="#04070e" />
      )}
      {peak && peak.el > 0 && (
        <circle cx={toXY(peak.az, peak.el)[0]} cy={toXY(peak.az, peak.el)[1]} r={2.2} fill="#f8fafc" />
      )}
      {current && current.el >= 0 && (
        <g transform={`translate(${toXY(current.az, current.el).join(',')})`}>
          <circle r={8} fill={color} opacity={0.5} className="svg-pulse" />
          <circle r={4} fill={color} stroke="#f8fafc" strokeWidth={1.5} />
        </g>
      )}
    </svg>
  )
}
