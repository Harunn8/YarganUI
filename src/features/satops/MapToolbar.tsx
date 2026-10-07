import { Globe2, Map as MapIcon } from 'lucide-react'
import { Segmented } from '../../components/ui/Form'
import { cn } from '../../lib/cn'
import { formatUtcTime } from '../../lib/format'
import type { MapLayers } from './WorldMap'

const layerLabels: { key: keyof MapLayers; label: string }[] = [
  { key: 'tracks', label: 'Yer izi' },
  { key: 'footprints', label: 'Kapsama' },
  { key: 'links', label: 'Bağlantı' },
  { key: 'night', label: 'Gece/gündüz' },
  { key: 'labels', label: 'Etiketler' },
  { key: 'grid', label: 'Izgara' },
]

export function MapToolbar({
  mode,
  onModeChange,
  layers,
  onLayersChange,
  now,
}: {
  mode: '2d' | '3d'
  onModeChange: (mode: '2d' | '3d') => void
  layers: MapLayers
  onLayersChange: (layers: MapLayers) => void
  now: Date
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-start justify-between gap-2 bg-gradient-to-b from-ink-950/85 via-ink-950/40 to-transparent p-3 pb-8">
      <div className="pointer-events-auto flex items-center gap-2">
        <Segmented
          size="sm"
          value={mode}
          onChange={onModeChange}
          options={[
            { value: '2d', label: 'Harita', icon: <MapIcon className="size-3.5" /> },
            { value: '3d', label: 'Küre', icon: <Globe2 className="size-3.5" /> },
          ]}
        />
        <div className="flex h-8 items-center gap-2 rounded-lg bg-ink-900/80 px-2.5 ring-1 ring-white/8">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-rose-400 opacity-70" />
            <span className="relative inline-flex size-2 rounded-full bg-rose-400" />
          </span>
          <span className="text-[11px] font-semibold tracking-[0.14em] text-rose-200">CANLI</span>
          <span className="num text-[11.5px] text-ink-300">{formatUtcTime(now)} UTC</span>
        </div>
      </div>
      <div className="pointer-events-auto flex flex-wrap gap-1 rounded-lg bg-ink-900/80 p-1 ring-1 ring-white/8">
        {layerLabels.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => onLayersChange({ ...layers, [key]: !layers[key] })}
            className={cn(
              'h-6 rounded-md px-2 text-[11.5px] font-medium transition',
              layers[key] ? 'bg-cyan-400/15 text-cyan-200 ring-1 ring-cyan-400/30' : 'text-ink-400 hover:text-ink-200',
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function MapLegend() {
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-10 hidden flex-wrap items-center gap-x-3.5 gap-y-1 rounded-lg bg-ink-900/80 px-3 py-1.5 text-[11px] text-ink-300 ring-1 ring-white/8 backdrop-blur md:flex">
      <span className="inline-flex items-center gap-1.5">
        <svg width="10" height="10" viewBox="-6 -6 12 12">
          <path d="M0 -5 L5 0 L0 5 L-5 0 Z" fill="#fbbf24" />
        </svg>
        Yer istasyonu
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-0.5 w-5 rounded bg-cyan-300" /> Gelecek iz
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="w-5 border-t border-dashed border-cyan-300/60" /> Geçmiş iz
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2.5 rounded-full border border-dashed border-cyan-300/70" /> Kapsama (min. el.)
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm bg-black/50 ring-1 ring-white/10" /> Gece
      </span>
    </div>
  )
}
