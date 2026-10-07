import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  ArrowRight,
  CalendarClock,
  Cpu,
  HeartPulse,
  Orbit,
  Play,
  Radio,
  Server,
  Users,
} from 'lucide-react'
import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { deviceApi, pagApi, pagDeviceApi } from '../api/device'
import { services } from '../api/http'
import { cronPolicyApi } from '../api/rule'
import { passApi, tleApi } from '../api/satops'
import { PassStatus } from '../api/types'
import { userApi } from '../api/user'
import { useAuth } from '../auth/AuthContext'
import { useHealth } from '../components/layout/useHealth'
import { Badge, StatusDot } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card, CardHeader } from '../components/ui/Card'
import { EmptyState, Skeleton } from '../components/ui/States'
import { StatCard } from '../components/ui/StatCard'
import { ElevationChart } from '../features/satops/ElevationChart'
import { passProfile } from '../features/satops/orbit'
import { statusOf } from '../features/satops/passStatus'
import { SkyPlot } from '../features/satops/SkyPlot'
import { useSatelliteTracker } from '../features/satops/useSatelliteTracker'
import { defaultLayers, WorldMap } from '../features/satops/WorldMap'
import { cn } from '../lib/cn'
import { formatCountdown, formatDay, formatDuration, formatHm, formatTime, greeting, parseApiDate } from '../lib/format'

const finished: number[] = [PassStatus.Completed, PassStatus.Failed, PassStatus.Canceled, PassStatus.Skipped]
/** Yer eşzamanlı uydular için backend pencereyi kaplayan çok uzun "geçişler" üretebiliyor. */
const CONTINUOUS_MS = 12 * 3_600_000
const isContinuous = (p: { aos: Date; los: Date }) => p.los.getTime() - p.aos.getTime() > CONTINUOUS_MS
const compactLayers = { ...defaultLayers, labels: false, links: true, grid: false }

export default function DashboardPage() {
  const navigate = useNavigate()
  const { userName } = useAuth()
  const tle = useQuery({ queryKey: ['tle'], queryFn: tleApi.get })
  const passes = useQuery({ queryKey: ['passes'], queryFn: passApi.getAll, refetchInterval: 30_000 })
  const pagDevices = useQuery({ queryKey: ['pagDevices', 'all'], queryFn: pagDeviceApi.getAll })
  const active = useQuery({ queryKey: ['pagDevices', 'active'], queryFn: pagDeviceApi.getActive })
  const devices = useQuery({ queryKey: ['devices'], queryFn: deviceApi.getAll })
  const pags = useQuery({ queryKey: ['pags'], queryFn: pagApi.getAll })
  const activeJobs = useQuery({ queryKey: ['cronPolicies', 'active'], queryFn: cronPolicyApi.getActive })
  const users = useQuery({ queryKey: ['users'], queryFn: userApi.getAll })
  const health = useHealth()

  const { now, station, satellites, positions, tracks, predicted, sun, mapSatellites } = useSatelliteTracker(tle.data)
  const t = now.getTime()

  const upcoming = useMemo(
    () =>
      (passes.data ?? [])
        .map((p) => ({ pass: p, aos: parseApiDate(p.aos), los: parseApiDate(p.los) }))
        .filter((p): p is { pass: typeof p.pass; aos: Date; los: Date } => Boolean(p.aos && p.los))
        .filter((p) => p.los.getTime() > t && !finished.includes(p.pass.status))
        .sort((a, b) => a.aos.getTime() - b.aos.getTime()),
    [passes.data, t],
  )

  const next = upcoming.find((p) => !isContinuous(p)) ?? null
  const nextSat = next ? satellites.find((s) => s.name.toLocaleLowerCase('tr-TR') === next.pass.name.toLocaleLowerCase('tr-TR')) : null
  const profile = useMemo(
    () => (next && nextSat?.satrec && station ? passProfile(nextSat.satrec, station, next.aos, next.los) : []),
    [next, nextSat, station],
  )
  const nextLive = next ? next.aos.getTime() <= t : false
  const nextPos = nextSat ? positions[nextSat.key] : null
  const in24h = upcoming.filter((p) => !isContinuous(p) && p.aos.getTime() - t < 86_400_000).length
  const visibleNow = mapSatellites.filter((s) => s.visible).length

  const activeIds = useMemo(() => new Set((active.data ?? []).map((d) => d.id)), [active.data])
  const activeCount = (pagDevices.data ?? []).filter((d) => activeIds.has(d.id)).length
  const firstName = userName.split(/[.\s_-]/)[0]
  const displayName = firstName ? firstName[0].toLocaleUpperCase('tr-TR') + firstName.slice(1) : userName
  const nextPredicted = predicted.find((p) => !p.continuous && p.aos.getTime() > t)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="label-caps text-cyan-300/80">{formatDay(now)}</div>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight">
            {greeting(now)}, {displayName}
          </h1>
          <p className="mt-1 text-sm text-ink-400">
            {station ? (
              <>
                {station.name} · <span className="text-emerald-300">{visibleNow} uydu görünür</span>
                {nextPredicted && (
                  <>
                    {' '}
                    · sıradaki AOS <span className="num text-ink-200">{nextPredicted.name}</span>{' '}
                    <span className="num text-cyan-200">{formatCountdown(nextPredicted.aos.getTime() - t)}</span>
                  </>
                )}
              </>
            ) : (
              'TLE yapılandırması bekleniyor.'
            )}
          </p>
        </div>
        <Link to="/satops">
          <Button variant="primary" icon={<Orbit className="size-4" />}>
            Uydu operasyonlarına git
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <StatCard icon={<Orbit className="size-4" />} label="Takip edilen uydu" value={satellites.length} sub={`${visibleNow} şu an görünür`} loading={tle.isLoading} onClick={() => navigate('/satops')} />
        <StatCard icon={<CalendarClock className="size-4" />} label="Planlı geçiş" accent="violet" value={in24h} sub="Önümüzdeki 24 saat" loading={passes.isLoading} onClick={() => navigate('/satops')} />
        <StatCard
          icon={<Server className="size-4" />}
          label="Aktif cihaz"
          accent="emerald"
          value={
            <span>
              {activeCount}
              <span className="text-lg text-ink-500">/{pagDevices.data?.length ?? 0}</span>
            </span>
          }
          sub="DCM ile haberleşen"
          loading={pagDevices.isLoading || active.isLoading}
          onClick={() => navigate('/devices')}
        />
        <StatCard icon={<Cpu className="size-4" />} label="Cihaz tanımı" accent="sky" value={devices.data?.length ?? 0} sub={`${pags.data?.length ?? 0} PAG`} loading={devices.isLoading} onClick={() => navigate('/devices')} />
        <StatCard icon={<Play className="size-4" />} label="Aktif cron işi" accent="amber" value={activeJobs.data?.length ?? 0} sub="Rule Engine" loading={activeJobs.isLoading} onClick={() => navigate('/rules')} />
        <StatCard icon={<Users className="size-4" />} label="Kullanıcı" accent="fuchsia" value={users.data?.length ?? 0} sub="Kayıtlı operatör" loading={users.isLoading} onClick={() => navigate('/users')} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <CardHeader
            icon={<Radio className="size-4" />}
            title="Canlı uydu konumları"
            subtitle={station ? `${station.name} merkezli · SGP4` : 'TLE yapılandırması yok'}
            actions={
              <Link to="/satops" className="inline-flex items-center gap-1 text-xs font-medium text-cyan-300 hover:text-cyan-200">
                Haritayı aç <ArrowRight className="size-3.5" />
              </Link>
            }
          />
          <button type="button" onClick={() => navigate('/satops')} className="block w-full text-left" aria-label="Uydu operasyonlarını aç">
            <WorldMap
              compact
              className="h-[340px] border-t border-white/6"
              satellites={mapSatellites}
              tracks={tracks}
              station={station ? { name: station.name, lat: station.lat, lon: station.lon } : null}
              sun={sun}
              layers={compactLayers}
            />
          </button>
        </Card>

        <Card className="flex flex-col">
          <CardHeader icon={<CalendarClock className="size-4" />} title="Sıradaki geçiş" subtitle="Planlanmış geçişlerden" />
          <div className="flex flex-1 flex-col px-5 pb-5">
            {passes.isLoading ? (
              <Skeleton className="h-60" />
            ) : !next ? (
              <EmptyState className="flex-1" title="Planlanmış geçiş yok" description="Satops ekranından TLE’ye göre geçiş planlayın." />
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-lg font-semibold">
                      {nextSat && <span className="size-2.5 rounded-full" style={{ background: nextSat.color }} />}
                      {next.pass.name}
                    </div>
                    <div className="mt-1">
                      <Badge tone={statusOf(next.pass.status).tone} dot pulse={nextLive}>
                        {statusOf(next.pass.status).label}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="label-caps">{nextLive ? 'LOS’a kalan' : 'AOS’a kalan'}</div>
                    <div className={cn('num mt-1 text-3xl font-semibold tracking-tight', nextLive ? 'text-emerald-300' : 'text-cyan-200')}>
                      {formatCountdown((nextLive ? next.los : next.aos).getTime() - t)}
                    </div>
                  </div>
                </div>
                <div className="num mt-4 grid grid-cols-3 gap-2 rounded-xl bg-ink-900/60 p-3 text-xs ring-1 ring-white/6">
                  <div>
                    <div className="text-ink-500">AOS</div>
                    <div className="text-ink-100">{formatTime(next.aos)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-ink-500">Süre</div>
                    <div className="text-ink-100">{formatDuration((next.los.getTime() - next.aos.getTime()) / 1000)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-ink-500">LOS</div>
                    <div className="text-ink-100">{formatTime(next.los)}</div>
                  </div>
                </div>
                {profile.length > 1 && nextSat && station ? (
                  <div className="mt-4 grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)] items-center gap-3">
                    <SkyPlot
                      points={profile}
                      current={nextLive && nextPos ? { az: nextPos.azimuth ?? 0, el: nextPos.elevation ?? 0 } : null}
                      color={nextSat.color}
                      minElevation={station.minElevation}
                      size={180}
                    />
                    <ElevationChart points={profile} now={now} color={nextSat.color} minElevation={station.minElevation} />
                  </div>
                ) : (
                  <p className="mt-4 text-xs text-ink-500">Bu uydunun TLE’si yapılandırmada yok; gök haritası çizilemiyor.</p>
                )}
              </>
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        <Card>
          <CardHeader icon={<CalendarClock className="size-4" />} title="Yaklaşan geçişler" subtitle={`${upcoming.length} geçiş planlı`} />
          <ul className="space-y-1 px-3 pb-4">
            {upcoming.slice(0, 6).map(({ pass, aos, los }) => {
              const sat = satellites.find((s) => s.name.toLocaleLowerCase('tr-TR') === pass.name.toLocaleLowerCase('tr-TR'))
              const continuous = isContinuous({ aos, los })
              const live = aos.getTime() <= t
              const meta = statusOf(pass.status)
              return (
                <li key={pass.id} className="flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 hover:bg-white/[0.03]">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="size-2 shrink-0 rounded-full" style={{ background: sat?.color ?? '#94a3b8' }} />
                    <div className="min-w-0">
                      <div className="truncate text-[13.5px] font-medium text-ink-100">{pass.name}</div>
                      <div className="num text-[11px] text-ink-500">
                        {formatHm(aos)} – {formatHm(los)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                    <span className={cn('num w-[74px] text-right text-xs', live || continuous ? 'text-emerald-300' : 'text-ink-300')}>
                      {continuous ? 'sürekli' : live ? 'şimdi' : formatCountdown(aos.getTime() - t)}
                    </span>
                  </div>
                </li>
              )
            })}
            {upcoming.length === 0 && <li className="px-3 py-8 text-center text-sm text-ink-500">Yaklaşan geçiş yok.</li>}
          </ul>
        </Card>

        <Card>
          <CardHeader icon={<HeartPulse className="size-4" />} title="Servis durumu" subtitle="/health uçları · 30 sn’de bir" />
          <ul className="space-y-2 px-5 pb-5">
            {services.map((s) => {
              const r = health.data?.find((x) => x.service === s.name)
              const pct = r?.ok ? Math.min(100, (r.latencyMs / 500) * 100) : 0
              return (
                <li key={s.name} className="rounded-xl bg-white/[0.025] px-3.5 py-2.5 ring-1 ring-white/6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <StatusDot tone={!r ? 'neutral' : r.ok ? 'emerald' : 'rose'} pulse={r?.ok} />
                      <div>
                        <div className="text-[13px] font-medium text-ink-100">{s.label}</div>
                        <div className="text-[11px] text-ink-500">{s.description}</div>
                      </div>
                    </div>
                    <span className={cn('num text-xs', r?.ok ? 'text-ink-300' : 'text-rose-300')}>
                      {!r ? '…' : r.ok ? `${r.latencyMs} ms` : r.status ? `HTTP ${r.status}` : 'erişilemiyor'}
                    </span>
                  </div>
                  {r?.ok && (
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/6">
                      <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400" style={{ width: `${Math.max(4, pct)}%` }} />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </Card>

        <Card className="lg:col-span-2 2xl:col-span-1">
          <CardHeader icon={<Activity className="size-4" />} title="Cihaz durumu" subtitle="PAG bazında haberleşme" />
          <div className="space-y-3 px-5 pb-5">
            {(pags.data ?? []).map((pag) => {
              const list = (pagDevices.data ?? []).filter((d) => d.pagId === pag.id)
              const on = list.filter((d) => activeIds.has(d.id)).length
              return (
                <div key={pag.id}>
                  <div className="mb-1.5 flex items-center justify-between text-[13px]">
                    <span className="text-ink-200">{pag.name}</span>
                    <span className="num text-xs text-ink-400">
                      <span className="text-emerald-300">{on}</span> / {list.length}
                    </span>
                  </div>
                  <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
                    {list.length === 0 ? (
                      <div className="h-full flex-1 bg-white/6" />
                    ) : (
                      list.map((d) => (
                        <div
                          key={d.id}
                          title={`${d.name} · ${activeIds.has(d.id) ? 'aktif' : 'bakımda'}`}
                          className={cn('h-full flex-1', activeIds.has(d.id) ? 'bg-emerald-400/80' : 'bg-amber-400/60')}
                        />
                      ))
                    )}
                  </div>
                </div>
              )
            })}
            {(pags.data ?? []).length === 0 && !pags.isLoading && <p className="py-6 text-center text-sm text-ink-500">PAG tanımlı değil.</p>}
            <div className="flex gap-4 pt-1 text-[11px] text-ink-400">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-sm bg-emerald-400/80" /> Aktif
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-sm bg-amber-400/60" /> Bakımda
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
