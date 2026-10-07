import { Crosshair, Radio, X } from 'lucide-react'
import { useMemo } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { Switch } from '../../components/ui/Form'
import { cn } from '../../lib/cn'
import {
  formatCountdown,
  formatDuration,
  formatLat,
  formatLon,
  formatShortDateTime,
  formatTime,
} from '../../lib/format'
import { ElevationChart } from './ElevationChart'
import { passProfile, tleAgeDays, type GroundStation, type PredictedPass, type SatPosition, type TrackedSatellite } from './orbit'
import { SkyPlot } from './SkyPlot'

function Metric({ label, value, unit, accent }: { label: string; value: string; unit?: string; accent?: boolean }) {
  return (
    <div className="rounded-lg bg-white/[0.03] px-3 py-1.5 ring-1 ring-white/6">
      <div className="label-caps !text-[9.5px]">{label}</div>
      <div className={cn('num mt-0.5 text-[15px] font-medium', accent ? 'text-emerald-300' : 'text-ink-100')}>
        {value}
        {unit && <span className="ml-0.5 text-[11px] text-ink-400">{unit}</span>}
      </div>
    </div>
  )
}

export function SatelliteDetail({
  satellite,
  position,
  nextPass,
  station,
  now,
  follow,
  onFollowChange,
  onClose,
}: {
  satellite: TrackedSatellite
  position: SatPosition | null
  nextPass: PredictedPass | null
  station: GroundStation | null
  now: Date
  follow: boolean
  onFollowChange: (value: boolean) => void
  onClose: () => void
}) {
  const profile = useMemo(
    () =>
      nextPass && station && satellite.satrec && !nextPass.continuous
        ? passProfile(satellite.satrec, station, nextPass.aos, nextPass.los)
        : [],
    [nextPass, station, satellite.satrec],
  )

  const age = tleAgeDays(satellite.epoch, now)
  const inPass = nextPass ? nextPass.aos <= now && now < nextPass.los : false
  const visible = Boolean(station && position && (position.elevation ?? -90) >= station.minElevation)

  return (
    <Card className="animate-rise overflow-hidden">
      <div
        className="relative px-5 pt-4 pb-3"
        style={{ background: `linear-gradient(135deg, ${satellite.color}22, transparent 60%)` }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full shadow-[0_0_10px_currentColor]" style={{ background: satellite.color, color: satellite.color }} />
              <h3 className="truncate text-lg font-semibold">{satellite.name}</h3>
            </div>
            <div className="num mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-400">
              {satellite.noradId && <span>NORAD {satellite.noradId}</span>}
              {age !== null && (
                <Badge tone={age > 14 ? 'rose' : age > 3 ? 'amber' : 'emerald'}>TLE yaşı {age.toFixed(1)} gün</Badge>
              )}
              {visible && (
                <Badge tone="emerald" dot pulse icon={<Radio className="size-3" />}>
                  Bağlantı penceresinde
                </Badge>
              )}
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-ink-400 hover:bg-white/8 hover:text-ink-100" aria-label="Kapat">
            <X className="size-4" />
          </button>
        </div>
        <div className="mt-3">
          <Switch
            size="sm"
            checked={follow}
            onChange={onFollowChange}
            label={
              <span className="inline-flex items-center gap-1.5">
                <Crosshair className="size-3.5 text-cyan-300" /> Haritada takip et
              </span>
            }
          />
        </div>
      </div>

      <div className="space-y-4 px-5 pt-1 pb-5">
        {position ? (
          <div className="grid grid-cols-3 gap-2">
            <Metric label="Enlem" value={formatLat(position.lat)} />
            <Metric label="Boylam" value={formatLon(position.lon)} />
            <Metric label="İrtifa" value={Math.round(position.altKm).toLocaleString('tr-TR')} unit="km" />
            <Metric label="Hız" value={position.speedKmS.toFixed(2)} unit="km/s" />
            <Metric label="Azimut" value={(position.azimuth ?? 0).toFixed(1)} unit="°" />
            <Metric label="Elevasyon" value={(position.elevation ?? 0).toFixed(1)} unit="°" accent={visible} />
            <Metric label="Menzil" value={Math.round(position.rangeKm ?? 0).toLocaleString('tr-TR')} unit="km" />
            <Metric label="Periyot" value={satellite.periodMin ? satellite.periodMin.toFixed(1) : '—'} unit="dk" />
            <Metric label="Eğim" value={satellite.inclinationDeg?.toFixed(2) ?? '—'} unit="°" />
          </div>
        ) : (
          <p className="text-sm text-rose-300">Konum hesaplanamadı. TLE verisini kontrol edin.</p>
        )}

        {station && (
          <div className="rounded-xl bg-ink-900/60 p-4 ring-1 ring-white/8">
            {!nextPass ? (
              <p className="text-sm text-ink-400">Önümüzdeki 24 saatte {station.name} üzerinden geçiş yok.</p>
            ) : nextPass.continuous ? (
              <p className="text-sm text-ink-300">
                Uydu sürekli ufuk üstünde (yer eşzamanlı yörünge). Maksimum elevasyon{' '}
                <span className="num text-ink-100">{nextPass.maxElevation.toFixed(1)}°</span>.
              </p>
            ) : (
              <>
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <div className="label-caps">{inPass ? 'Geçiş sürüyor · LOS’a kalan' : 'Sonraki geçiş · AOS’a kalan'}</div>
                    <div className={cn('num mt-1 text-3xl font-semibold tracking-tight', inPass ? 'text-emerald-300' : 'text-cyan-200')}>
                      {formatCountdown((inPass ? nextPass.los : nextPass.aos).getTime() - now.getTime())}
                    </div>
                  </div>
                  <div className="text-right text-xs text-ink-400">
                    <div>{formatShortDateTime(nextPass.aos)}</div>
                    <div className="num mt-0.5 text-ink-200">
                      Maks. El <span className="text-ink-100">{nextPass.maxElevation.toFixed(1)}°</span>
                    </div>
                  </div>
                </div>
                <div className="num mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <div className="text-ink-500">AOS</div>
                    <div className="text-ink-200">{formatTime(nextPass.aos)}</div>
                    <div className="text-ink-500">Az {nextPass.aosAzimuth.toFixed(0)}°</div>
                  </div>
                  <div>
                    <div className="text-ink-500">Süre</div>
                    <div className="text-ink-200">{formatDuration((nextPass.los.getTime() - nextPass.aos.getTime()) / 1000)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-ink-500">LOS</div>
                    <div className="text-ink-200">{formatTime(nextPass.los)}</div>
                    <div className="text-ink-500">Az {nextPass.losAzimuth.toFixed(0)}°</div>
                  </div>
                </div>
                {profile.length > 1 && (
                  <div className="mt-4 grid grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] items-center gap-3">
                    <SkyPlot
                      points={profile}
                      current={inPass && position ? { az: position.azimuth ?? 0, el: position.elevation ?? 0 } : null}
                      color={satellite.color}
                      minElevation={station.minElevation}
                    />
                    <ElevationChart points={profile} now={now} color={satellite.color} minElevation={station.minElevation} />
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
