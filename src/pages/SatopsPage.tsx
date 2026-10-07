import { useQuery } from '@tanstack/react-query'
import { CalendarClock, CalendarPlus, GanttChart, List, Plus, Settings2, Telescope } from 'lucide-react'
import { useState } from 'react'
import { passApi, tleApi } from '../api/satops'
import type { SatellitePassFromTle } from '../api/types'
import { Button } from '../components/ui/Button'
import { Card, CardHeader } from '../components/ui/Card'
import { PageHeader } from '../components/ui/PageHeader'
import { PageLoader } from '../components/ui/Spinner'
import { ErrorState } from '../components/ui/States'
import { Tabs } from '../components/ui/Tabs'
import { ManualPassModal } from '../features/satops/ManualPassModal'
import { MapLegend, MapToolbar } from '../features/satops/MapToolbar'
import type { GroundStation, TrackedSatellite } from '../features/satops/orbit'
import { PassSelectionModal } from '../features/satops/PassSelectionModal'
import { PassTable } from '../features/satops/PassTable'
import { PassTimeline } from '../features/satops/PassTimeline'
import { SatelliteDetail } from '../features/satops/SatelliteDetail'
import { SatelliteList } from '../features/satops/SatelliteList'
import { SchedulerControl } from '../features/satops/SchedulerControl'
import { StationCard } from '../features/satops/StationCard'
import { TleConfigModal } from '../features/satops/TleConfigModal'
import { nextPassFor, useSatelliteTracker } from '../features/satops/useSatelliteTracker'
import { defaultLayers, WorldMap, type MapLayers } from '../features/satops/WorldMap'
import { useLocalStorageState } from '../lib/useLocalStorage'

export default function SatopsPage() {
  const tleQuery = useQuery({ queryKey: ['tle'], queryFn: tleApi.get })
  const passesQuery = useQuery({ queryKey: ['passes'], queryFn: passApi.getAll, refetchInterval: 30_000 })
  const tle = tleQuery.data
  const { now, station, satellites, positions, tracks, predicted, sun, mapSatellites } = useSatelliteTracker(tle)

  const [mode, setMode] = useLocalStorageState<'2d' | '3d'>('yargan.map.mode', '2d')
  const [layers, setLayers] = useLocalStorageState<MapLayers>('yargan.map.layers', defaultLayers)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [follow, setFollow] = useState(false)
  const [scheduleTab, setScheduleTab] = useState<'timeline' | 'list'>('timeline')

  const [tleOpen, setTleOpen] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)
  const [planOpen, setPlanOpen] = useState(false)
  const [computed, setComputed] = useState<{
    passes: SatellitePassFromTle[]
    satellites: TrackedSatellite[]
    station: GroundStation
  } | null>(null)

  const planQuery = useQuery({ queryKey: ['tle-passes'], queryFn: tleApi.passes, enabled: planOpen })

  // TLE değişip uydu listeden çıkarsa seçim kendiliğinden düşer.
  const selected = satellites.find((s) => s.key === selectedKey) ?? null
  const activeKey = selected ? selected.key : null
  const select = (key: string | null) => {
    setSelectedKey(key)
    if (!key) setFollow(false)
  }
  const passes = passesQuery.data ?? []
  const mapHeight = 'h-[520px] xl:h-[600px] 2xl:h-[660px]'

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Satops"
        title="Uydu Operasyonları"
        description="Uyduların anlık konumu, yer izleri ve yer istasyonu üzerinden geçiş planı."
        actions={
          <>
            <SchedulerControl />
            <Button icon={<CalendarPlus className="size-4" />} onClick={() => setPlanOpen(true)} disabled={!tle}>
              Geçiş planla
            </Button>
            <Button variant="primary" icon={<Settings2 className="size-4" />} onClick={() => setTleOpen(true)}>
              TLE yapılandırması
            </Button>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card className="relative overflow-hidden">
          <MapToolbar mode={mode} onModeChange={setMode} layers={layers} onLayersChange={setLayers} now={now} />
          <WorldMap
            className={mapHeight}
            mode={mode}
            layers={layers}
            satellites={mapSatellites}
            tracks={tracks}
            station={station ? { name: station.name, lat: station.lat, lon: station.lon } : null}
            sun={sun}
            selectedKey={activeKey}
            onSelect={select}
            follow={follow && activeKey !== null}
          />
          <MapLegend />
          {tleQuery.isLoading && (
            <div className="absolute inset-0 grid place-items-center bg-ink-950/50 backdrop-blur-sm">
              <PageLoader label="TLE yapılandırması yükleniyor…" />
            </div>
          )}
          {tleQuery.isError && (
            <div className="absolute inset-x-0 top-16 mx-auto max-w-md">
              <ErrorState error={tleQuery.error} onRetry={() => tleQuery.refetch()} />
            </div>
          )}
          {tleQuery.isSuccess && !tle && (
            <div className="absolute inset-0 grid place-items-center bg-ink-950/40">
              <div className="panel max-w-sm animate-rise p-6 text-center">
                <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-300 ring-1 ring-cyan-400/25">
                  <Telescope className="size-6" />
                </div>
                <h3 className="mt-4 font-semibold">Henüz TLE yapılandırması yok</h3>
                <p className="mt-1.5 text-sm text-ink-400">
                  Yer istasyonu konumunu ve takip edilecek uyduları ekleyin; uydular haritada canlı olarak görünsün.
                </p>
                <Button variant="primary" className="mt-5" icon={<Plus className="size-4" />} onClick={() => setTleOpen(true)}>
                  Yapılandır
                </Button>
              </div>
            </div>
          )}
        </Card>

        <div className={`flex min-h-0 flex-col gap-4 ${mapHeight}`}>
          {!selected && (
            <StationCard station={station} satellites={satellites} positions={positions} predicted={predicted} now={now} />
          )}
          <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl">
            {selected ? (
              <SatelliteDetail
                satellite={selected}
                position={positions[selected.key] ?? null}
                nextPass={nextPassFor(predicted, selected.key, now)}
                station={station}
                now={now}
                follow={follow}
                onFollowChange={setFollow}
                onClose={() => select(null)}
              />
            ) : (
              <SatelliteList
                satellites={satellites}
                positions={positions}
                predicted={predicted}
                station={station}
                now={now}
                selectedKey={activeKey}
                onSelect={select}
              />
            )}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader
          icon={<CalendarClock className="size-4" />}
          title="Geçiş planı"
          subtitle="Planlanmış geçişler ve önümüzdeki 24 saatin SGP4 tahminleri"
          actions={
            <Button size="sm" variant="outline" icon={<Plus className="size-3.5" />} onClick={() => setManualOpen(true)}>
              Manuel geçiş
            </Button>
          }
        />
        <Tabs
          className="mx-5 mb-4"
          value={scheduleTab}
          onChange={setScheduleTab}
          items={[
            { value: 'timeline', label: 'Zaman çizelgesi', icon: <GanttChart className="size-4" /> },
            { value: 'list', label: 'Liste', icon: <List className="size-4" />, count: passes.length },
          ]}
        />
        {passesQuery.isError ? (
          <ErrorState error={passesQuery.error} onRetry={() => passesQuery.refetch()} />
        ) : scheduleTab === 'timeline' ? (
          <PassTimeline passes={passes} predicted={predicted} satellites={satellites} now={now} />
        ) : (
          <PassTable
            passes={passes}
            satellites={satellites}
            now={now}
            emptyAction={
              tle ? (
                <Button variant="primary" size="sm" onClick={() => setPlanOpen(true)}>
                  Geçiş planla
                </Button>
              ) : undefined
            }
          />
        )}
      </Card>

      <TleConfigModal
        open={tleOpen}
        onClose={() => setTleOpen(false)}
        current={tle}
        onPassesComputed={(result, context) => {
          setTleOpen(false)
          setComputed({ passes: result, ...context })
        }}
      />
      <PassSelectionModal
        open={computed !== null}
        onClose={() => setComputed(null)}
        passes={computed?.passes}
        satellites={computed?.satellites ?? satellites}
        station={computed?.station ?? station}
        title="Hesaplanan geçişler"
        description="Yeni TLE yapılandırmasıyla hesaplanan geçişlerden planlamaya eklenecekleri seçin."
      />
      <PassSelectionModal
        open={planOpen}
        onClose={() => setPlanOpen(false)}
        passes={planQuery.data}
        loading={planQuery.isLoading}
        error={planQuery.error}
        satellites={satellites}
        station={station}
      />
      <ManualPassModal
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        satellites={satellites}
        station={station}
        predicted={predicted}
      />
    </div>
  )
}
