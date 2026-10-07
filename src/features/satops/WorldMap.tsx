import {
  geoCircle,
  geoDistance,
  geoEquirectangular,
  geoGraticule10,
  geoOrthographic,
  geoPath,
  type GeoProjection,
} from 'd3-geo'
import { select } from 'd3-selection'
import { zoom as d3Zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom'
import { LocateFixed, Minus, Plus } from 'lucide-react'
import { memo, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { feature, mesh } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import worldUrl110 from 'world-atlas/countries-110m.json?url'
import worldUrl50 from 'world-atlas/countries-50m.json?url'
import { cn } from '../../lib/cn'
import { formatLat, formatLon } from '../../lib/format'
import type { GroundTrack } from './orbit'

export interface MapSatellite {
  key: string
  name: string
  color: string
  lat: number
  lon: number
  altKm: number
  footprintDeg: number
  /** Yer istasyonundan minimum elevasyonun üstünde görünüyor. */
  visible?: boolean
}

export interface MapStation {
  name: string
  lat: number
  lon: number
}

export interface MapLayers {
  tracks: boolean
  footprints: boolean
  night: boolean
  labels: boolean
  grid: boolean
  links: boolean
}

export const defaultLayers: MapLayers = {
  tracks: true,
  footprints: true,
  night: true,
  labels: true,
  grid: true,
  links: true,
}

type WorldData = {
  land: GeoJSON.FeatureCollection
  borders: GeoJSON.MultiLineString
}

type WorldTopology = Topology<{ land: GeometryCollection; countries: GeometryCollection }>

const worldCache = new Map<string, Promise<WorldData>>()

function loadWorld(resolution: '50m' | '110m'): Promise<WorldData> {
  let promise = worldCache.get(resolution)
  if (!promise) {
    promise = fetch(resolution === '50m' ? worldUrl50 : worldUrl110)
      .then((r) => r.json() as Promise<WorldTopology>)
      .then((topo) => ({
        land: feature(topo, topo.objects.land) as GeoJSON.FeatureCollection,
        borders: mesh(topo, topo.objects.countries, (a, b) => a !== b),
      }))
    worldCache.set(resolution, promise)
  }
  return promise
}

function useWorld(resolution: '50m' | '110m') {
  const [world, setWorld] = useState<WorldData | null>(null)
  useEffect(() => {
    let alive = true
    loadWorld(resolution)
      .then((data) => alive && setWorld(data))
      .catch(() => alive && setWorld(null))
    return () => {
      alive = false
    }
  }, [resolution])
  return world
}

function useSize(ref: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setSize({ w: Math.round(el.clientWidth), h: Math.round(el.clientHeight) })
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return size
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
/** Eşdikdörtgen haritanın kartı boşluksuz doldurması için ölçek (fazlası kaydırılarak görülür). */
const coverScale = (w: number, h: number) => Math.max(w / (2 * Math.PI), h / Math.PI)
const graticule = geoGraticule10()

interface WorldMapProps {
  satellites: MapSatellite[]
  /** Yer izleri; kimliği yalnızca izler yeniden hesaplanınca değişmeli. */
  tracks?: Record<string, GroundTrack>
  station?: MapStation | null
  sun?: [number, number] | null
  selectedKey?: string | null
  onSelect?: (key: string | null) => void
  mode?: '2d' | '3d'
  layers?: MapLayers
  /** Seçili uyduyu ekranda ortalar. */
  follow?: boolean
  /** Panelde küçük, etkileşimsiz önizleme. */
  compact?: boolean
  className?: string
}

export const WorldMap = memo(function WorldMap({
  satellites,
  tracks,
  station,
  sun,
  selectedKey,
  onSelect,
  mode = '2d',
  layers = defaultLayers,
  follow,
  compact,
  className,
}: WorldMapProps) {
  const uid = useId().replace(/:/g, '')
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const { w, h } = useSize(containerRef)
  const world = useWorld(mode === '3d' || compact ? '110m' : '50m')

  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity)
  const [rotation, setRotation] = useState<[number, number]>(() => [-(station?.lon ?? 32), -(station?.lat ?? 35) * 0.7])
  const [globeZoom, setGlobeZoom] = useState(1)
  const [hover, setHover] = useState<string | null>(null)
  // Olay dinleyicileri ve efektler en güncel değerleri ref'lerden okur.
  const rotationRef = useRef(rotation)
  const transformRef = useRef(transform)
  const globeZoomRef = useRef(globeZoom)
  useLayoutEffect(() => {
    rotationRef.current = rotation
    transformRef.current = transform
    globeZoomRef.current = globeZoom
  })

  const centerLon = station?.lon ?? 0

  const projection = useMemo<GeoProjection | null>(() => {
    if (!w || !h) return null
    if (mode === '3d') {
      const radius = Math.min(w, h) / 2 - 18
      return geoOrthographic()
        .scale(radius * globeZoom)
        .translate([w / 2, h / 2])
        .rotate([rotation[0], rotation[1], 0])
        .clipAngle(90)
        .precision(0.6)
    }
    return geoEquirectangular()
      .rotate([-centerLon, 0])
      .scale(coverScale(w, h))
      .translate([w / 2, h / 2])
      .precision(0.6)
  }, [w, h, mode, rotation, globeZoom, centerLon])

  const path = useMemo(() => (projection ? geoPath(projection) : null), [projection])
  const k = mode === '2d' ? transform.k : 1

  // ------------------------------------------------ 2D: d3-zoom ile yakınlaştırma/kaydırma
  useEffect(() => {
    const svgEl = svgRef.current
    if (mode !== '2d' || compact || !svgEl || !w || !h) return
    const scale = coverScale(w, h)
    const behavior = d3Zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 14])
      .translateExtent([
        [w / 2 - Math.PI * scale, h / 2 - (Math.PI / 2) * scale],
        [w / 2 + Math.PI * scale, h / 2 + (Math.PI / 2) * scale],
      ])
      .on('zoom', (event: { transform: ZoomTransform }) => setTransform(event.transform))
    const selection = select(svgEl)
    selection.call(behavior)
    zoomRef.current = behavior
    return () => {
      selection.on('.zoom', null)
      zoomRef.current = null
    }
  }, [mode, compact, w, h])

  // ------------------------------------------------ 3D: sürükleyerek döndür, tekerlekle yakınlaştır
  useEffect(() => {
    const el = svgRef.current
    if (mode !== '3d' || compact || !el) return
    let drag: { x: number; y: number; rot: [number, number]; id: number; moved: boolean } | null = null

    const onDown = (e: PointerEvent) => {
      drag = { x: e.clientX, y: e.clientY, rot: rotationRef.current, id: e.pointerId, moved: false }
    }
    const onMove = (e: PointerEvent) => {
      if (!drag) return
      const dx = e.clientX - drag.x
      const dy = e.clientY - drag.y
      if (!drag.moved && Math.hypot(dx, dy) < 3) return
      if (!drag.moved) {
        drag.moved = true
        el.setPointerCapture(drag.id)
      }
      const sensitivity = 0.28 / globeZoomRef.current
      setRotation([drag.rot[0] + dx * sensitivity, clamp(drag.rot[1] - dy * sensitivity, -88, 88)])
    }
    const onUp = () => {
      drag = null
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      setGlobeZoom((z) => clamp(z * Math.exp(-e.deltaY * 0.0015), 0.85, 8))
    }
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      el.removeEventListener('wheel', onWheel)
    }
  }, [mode, compact])

  // ------------------------------------------------ Seçili uyduyu takip et
  const selected = satellites.find((s) => s.key === selectedKey)
  const animRef = useRef<number | null>(null)

  const animateRotation = useCallback((target: [number, number], duration = 650) => {
    if (animRef.current) cancelAnimationFrame(animRef.current)
    const from = rotationRef.current
    let dLon = ((((target[0] - from[0]) % 360) + 540) % 360) - 180
    if (!Number.isFinite(dLon)) dLon = 0
    const dLat = target[1] - from[1]
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const e = 1 - Math.pow(1 - t, 3)
      setRotation([from[0] + dLon * e, from[1] + dLat * e])
      animRef.current = t < 1 ? requestAnimationFrame(step) : null
    }
    animRef.current = requestAnimationFrame(step)
  }, [])

  useEffect(() => () => {
    if (animRef.current) cancelAnimationFrame(animRef.current)
  }, [])

  const followLon = selected?.lon
  const followLat = selected?.lat
  const lastFollowKey = useRef<string | null>(null)

  // 3D: küreyi seçili uydunun altına çevir (seçim değişince yumuşak geçiş).
  useEffect(() => {
    if (!follow || mode !== '3d' || compact || followLon === undefined || followLat === undefined) return
    const target: [number, number] = [-followLon, clamp(-followLat * 0.85, -80, 80)]
    if (lastFollowKey.current !== selectedKey) {
      lastFollowKey.current = selectedKey ?? null
      animateRotation(target)
    } else if (!animRef.current) {
      setRotation(target)
    }
  }, [follow, mode, compact, followLon, followLat, selectedKey, animateRotation])

  // 2D: mevcut yakınlaştırmayı koruyarak uyduyu ortala.
  useEffect(() => {
    if (!follow || mode !== '2d' || compact || followLon === undefined || followLat === undefined) return
    const svgEl = svgRef.current
    const behavior = zoomRef.current
    if (!svgEl || !behavior || !projection) return
    const p = projection([followLon, followLat])
    if (!p) return
    const scale = Math.max(transformRef.current.k, 2.2)
    select(svgEl).call(behavior.transform, zoomIdentity.translate(w / 2 - p[0] * scale, h / 2 - p[1] * scale).scale(scale))
  }, [follow, mode, compact, followLon, followLat, projection, w, h])

  useEffect(() => {
    if (!follow) lastFollowKey.current = null
  }, [follow])

  // ------------------------------------------------ Katman yolları
  const spherePath = useMemo(() => path?.({ type: 'Sphere' }) ?? undefined, [path])
  const gridPath = useMemo(() => path?.(graticule) ?? undefined, [path])
  const landPath = useMemo(() => (world && path ? (path(world.land) ?? undefined) : undefined), [world, path])
  const borderPath = useMemo(() => (world && path ? (path(world.borders) ?? undefined) : undefined), [world, path])

  const nightPaths = useMemo(() => {
    if (!sun || !path) return []
    const anti: [number, number] = [sun[0] + 180, -sun[1]]
    return [90, 84, 78, 72].map((r) => path(geoCircle().center(anti).radius(r).precision(2)()) ?? '')
  }, [sun, path])

  const sunPoint = useMemo(() => {
    if (!sun || !projection) return null
    if (mode === '3d' && geoDistance(sun, [-rotation[0], -rotation[1]]) > Math.PI / 2) return null
    return projection(sun)
  }, [sun, projection, mode, rotation])

  const isFront = useCallback(
    (lon: number, lat: number) => mode !== '3d' || geoDistance([lon, lat], [-rotation[0], -rotation[1]]) < Math.PI / 2 - 0.02,
    [mode, rotation],
  )

  const trackPaths = useMemo(() => {
    const result = new Map<string, { past?: string; future?: string; short?: string }>()
    if (!path || !tracks) return result
    const line = (coordinates: [number, number][]) =>
      coordinates.length > 1 ? (path({ type: 'LineString', coordinates }) ?? undefined) : undefined
    for (const [key, t] of Object.entries(tracks)) {
      result.set(key, {
        past: line(t.past),
        future: line(t.future),
        short: line(t.future.slice(0, Math.max(2, Math.ceil(t.future.length * 0.4)))),
      })
    }
    return result
  }, [path, tracks])

  if (!w || !h) {
    return <div ref={containerRef} className={cn('relative overflow-hidden', className)} />
  }

  const stationPoint = station && projection && isFront(station.lon, station.lat) ? projection([station.lon, station.lat]) : null
  const hovered = satellites.find((s) => s.key === hover)
  const hoveredPoint = hovered && projection ? projection([hovered.lon, hovered.lat]) : null

  const zoomBy = (factor: number) => {
    if (mode === '3d') {
      setGlobeZoom((z) => clamp(z * factor, 0.85, 8))
      return
    }
    if (svgRef.current && zoomRef.current) select(svgRef.current).call(zoomRef.current.scaleBy, factor)
  }
  const resetView = () => {
    if (mode === '3d') {
      setGlobeZoom(1)
      animateRotation([-(station?.lon ?? 32), -(station?.lat ?? 35) * 0.7])
      return
    }
    if (svgRef.current && zoomRef.current) select(svgRef.current).call(zoomRef.current.transform, zoomIdentity)
  }

  return (
    <div ref={containerRef} className={cn('relative overflow-hidden', className)}>
      <svg
        ref={svgRef}
        width={w}
        height={h}
        className={cn(
          'block touch-none select-none',
          !compact && (mode === '3d' ? 'cursor-grab active:cursor-grabbing' : 'cursor-move'),
        )}
      >
        <defs>
          <radialGradient id={`${uid}-ocean3d`} cx="42%" cy="38%" r="65%">
            <stop offset="0" stopColor="#0f2a4d" />
            <stop offset="0.7" stopColor="#081a33" />
            <stop offset="1" stopColor="#050f22" />
          </radialGradient>
          <linearGradient id={`${uid}-ocean2d`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#040b18" />
            <stop offset="0.5" stopColor="#071426" />
            <stop offset="1" stopColor="#040b18" />
          </linearGradient>
          <radialGradient id={`${uid}-atmo`} cx="50%" cy="50%" r="50%">
            <stop offset="0.86" stopColor="#38bdf8" stopOpacity="0.32" />
            <stop offset="0.93" stopColor="#38bdf8" stopOpacity="0.08" />
            <stop offset="1" stopColor="#38bdf8" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${uid}-sun`}>
            <stop offset="0" stopColor="#fde68a" stopOpacity="0.9" />
            <stop offset="1" stopColor="#fde68a" stopOpacity="0" />
          </radialGradient>
          <filter id={`${uid}-glow`} x="-150%" y="-150%" width="400%" height="400%">
            <feGaussianBlur stdDeviation="2.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <clipPath id={`${uid}-clip`}>
            <path d={spherePath} />
          </clipPath>
        </defs>

        {mode === '3d' && projection && (
          <circle cx={w / 2} cy={h / 2} r={projection.scale() * 1.12} fill={`url(#${uid}-atmo)`} />
        )}

        <g transform={mode === '2d' ? transform.toString() : undefined}>
          <path d={spherePath} fill={mode === '3d' ? `url(#${uid}-ocean3d)` : `url(#${uid}-ocean2d)`} />
          {layers.grid && (
            <path d={gridPath} fill="none" stroke="rgb(125 211 252 / 0.07)" strokeWidth={0.6} vectorEffect="non-scaling-stroke" />
          )}
          <path d={landPath} fill="#1a2c49" stroke="#2a4269" strokeWidth={0.6} vectorEffect="non-scaling-stroke" />
          <path d={borderPath} fill="none" stroke="rgb(148 163 184 / 0.22)" strokeWidth={0.5} vectorEffect="non-scaling-stroke" />

          {layers.night && (
            <g clipPath={mode === '2d' ? `url(#${uid}-clip)` : undefined} pointerEvents="none">
              {nightPaths.map((d, i) => (
                <path key={i} d={d} fill="rgb(1 4 12 / 0.21)" />
              ))}
            </g>
          )}
          {sunPoint && layers.night && (
            <g transform={`translate(${sunPoint[0]},${sunPoint[1]}) scale(${1 / k})`} pointerEvents="none">
              <circle r={16} fill={`url(#${uid}-sun)`} />
              <circle r={3.2} fill="#fde68a" />
            </g>
          )}

          {layers.footprints &&
            satellites.map((s) => {
              const active = s.key === selectedKey
              // Yer eşzamanlı uyduların yarım küreyi kaplayan alanı yalnızca seçiliyken çizilir.
              if (s.footprintDeg > 45 && !active) return null
              const d = path?.(geoCircle().center([s.lon, s.lat]).radius(s.footprintDeg).precision(1.5)())
              if (!d) return null
              return (
                <path
                  key={`fp-${s.key}`}
                  d={d}
                  fill={s.color}
                  fillOpacity={active ? 0.1 : 0.045}
                  stroke={s.color}
                  strokeOpacity={active ? 0.75 : 0.32}
                  strokeWidth={active ? 1.3 : 0.9}
                  strokeDasharray={active ? undefined : '3 3'}
                  vectorEffect="non-scaling-stroke"
                  pointerEvents="none"
                />
              )
            })}

          {layers.tracks &&
            satellites.map((s) => {
              const t = trackPaths.get(s.key)
              if (!t) return null
              const active = s.key === selectedKey
              if (!active) {
                return t.short ? (
                  <path
                    key={`tr-${s.key}`}
                    d={t.short}
                    fill="none"
                    stroke={s.color}
                    strokeOpacity={selectedKey ? 0.22 : 0.5}
                    strokeWidth={1.2}
                    vectorEffect="non-scaling-stroke"
                    pointerEvents="none"
                  />
                ) : null
              }
              return (
                <g key={`tr-${s.key}`} pointerEvents="none">
                  {t.past && (
                    <path d={t.past} fill="none" stroke={s.color} strokeOpacity={0.5} strokeWidth={1.4} strokeDasharray="2 4" vectorEffect="non-scaling-stroke" />
                  )}
                  {t.future && (
                    <>
                      <path d={t.future} fill="none" stroke={s.color} strokeOpacity={0.25} strokeWidth={5} vectorEffect="non-scaling-stroke" />
                      <path d={t.future} fill="none" stroke={s.color} strokeOpacity={0.95} strokeWidth={1.8} vectorEffect="non-scaling-stroke" />
                    </>
                  )}
                </g>
              )
            })}

          {layers.links &&
            station &&
            satellites
              .filter((s) => s.visible)
              .map((s) => (
                <path
                  key={`ln-${s.key}`}
                  d={path?.({ type: 'LineString', coordinates: [[station.lon, station.lat], [s.lon, s.lat]] }) ?? undefined}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={1.4}
                  className="link-flow"
                  vectorEffect="non-scaling-stroke"
                  pointerEvents="none"
                />
              ))}

          {stationPoint && station && (
            <g transform={`translate(${stationPoint[0]},${stationPoint[1]}) scale(${1 / k})`} pointerEvents="none">
              <circle r={7} fill="#fbbf24" opacity={0.5} className="svg-pulse" />
              <path d="M0 -6.5 L6.5 0 L0 6.5 L-6.5 0 Z" fill="#fbbf24" stroke="#04070e" strokeWidth={1.5} />
              {!compact && layers.labels && (
                <text x={10} y={-8} fontSize={11} fontWeight={600} fill="#fde68a" stroke="#04070e" strokeWidth={3} paintOrder="stroke">
                  {station.name}
                </text>
              )}
            </g>
          )}

          {satellites.map((s) => {
            if (!projection || !isFront(s.lon, s.lat)) return null
            const p = projection([s.lon, s.lat])
            if (!p) return null
            const active = s.key === selectedKey
            const size = compact ? 0.8 : active ? 1.25 : 1
            return (
              <g
                key={`sat-${s.key}`}
                transform={`translate(${p[0]},${p[1]}) scale(${size / k})`}
                className={cn(onSelect && 'cursor-pointer')}
                onClick={(e) => {
                  e.stopPropagation()
                  onSelect?.(active ? null : s.key)
                }}
                onMouseEnter={() => setHover(s.key)}
                onMouseLeave={() => setHover((current) => (current === s.key ? null : current))}
              >
                <circle r={14} fill="transparent" />
                {active && <circle r={9} fill="none" stroke={s.color} strokeWidth={2} className="svg-pulse" />}
                {s.visible && <circle r={12} fill="none" stroke={s.color} strokeOpacity={0.6} strokeDasharray="2 2.5" />}
                <g filter={`url(#${uid}-glow)`}>
                  <rect x={-10} y={-2.4} width={6.2} height={4.8} rx={0.8} fill={s.color} opacity={0.9} />
                  <rect x={3.8} y={-2.4} width={6.2} height={4.8} rx={0.8} fill={s.color} opacity={0.9} />
                  <rect x={-3} y={-3} width={6} height={6} rx={1.4} fill="#f8fafc" stroke={s.color} strokeWidth={1.2} />
                </g>
                {layers.labels && !compact && (
                  <text
                    x={13}
                    y={4}
                    fontSize={active ? 12 : 11}
                    fontWeight={active ? 700 : 600}
                    fill={active ? '#f8fafc' : '#cbd5e1'}
                    stroke="#04070e"
                    strokeWidth={3}
                    paintOrder="stroke"
                    className="font-mono"
                  >
                    {s.name}
                  </text>
                )}
              </g>
            )
          })}
        </g>

        {mode === '3d' && projection && (
          <circle cx={w / 2} cy={h / 2} r={projection.scale()} fill="none" stroke="rgb(125 211 252 / 0.25)" strokeWidth={1} pointerEvents="none" />
        )}
      </svg>

      {hovered && hoveredPoint && !compact && (
        <div
          className="pointer-events-none absolute z-10 min-w-44 -translate-x-1/2 -translate-y-[calc(100%+14px)] rounded-lg bg-ink-900/95 px-3 py-2 text-xs shadow-xl ring-1 ring-white/10 backdrop-blur"
          style={{
            left: mode === '2d' ? transform.applyX(hoveredPoint[0]) : hoveredPoint[0],
            top: mode === '2d' ? transform.applyY(hoveredPoint[1]) : hoveredPoint[1],
          }}
        >
          <div className="mb-1 flex items-center gap-2 font-semibold text-ink-100">
            <span className="size-2 rounded-full" style={{ background: hovered.color }} />
            {hovered.name}
          </div>
          <div className="num grid grid-cols-2 gap-x-3 gap-y-0.5 text-ink-300">
            <span>{formatLat(hovered.lat)}</span>
            <span>{formatLon(hovered.lon)}</span>
            <span>{Math.round(hovered.altKm).toLocaleString('tr-TR')} km</span>
            <span className={hovered.visible ? 'text-emerald-300' : 'text-ink-500'}>
              {hovered.visible ? 'görünür' : 'ufuk altı'}
            </span>
          </div>
        </div>
      )}

      {!compact && (
        <div className="absolute right-3 bottom-3 flex flex-col overflow-hidden rounded-lg bg-ink-900/85 ring-1 ring-white/10 backdrop-blur">
          <button type="button" onClick={() => zoomBy(1.5)} className="grid size-8 place-items-center text-ink-300 hover:bg-white/8 hover:text-ink-100" title="Yakınlaştır">
            <Plus className="size-4" />
          </button>
          <button type="button" onClick={() => zoomBy(1 / 1.5)} className="grid size-8 place-items-center border-y border-white/8 text-ink-300 hover:bg-white/8 hover:text-ink-100" title="Uzaklaştır">
            <Minus className="size-4" />
          </button>
          <button type="button" onClick={resetView} className="grid size-8 place-items-center text-ink-300 hover:bg-white/8 hover:text-ink-100" title="Görünümü sıfırla">
            <LocateFixed className="size-4" />
          </button>
        </div>
      )}
    </div>
  )
})
