import { useQuery } from '@tanstack/react-query'
import { Activity, Boxes, Cpu, Server, Wrench } from 'lucide-react'
import { useMemo, useState } from 'react'
import { deviceApi, pagApi, pagDeviceApi } from '../api/device'
import { Card } from '../components/ui/Card'
import { PageHeader } from '../components/ui/PageHeader'
import { StatCard } from '../components/ui/StatCard'
import { Tabs } from '../components/ui/Tabs'
import { DefinitionsTab } from '../features/devices/DefinitionsTab'
import { PagDevicesTab } from '../features/devices/PagDevicesTab'
import { PagsTab } from '../features/devices/PagsTab'

type Tab = 'instances' | 'definitions' | 'pags'

export default function DevicesPage() {
  const [tab, setTab] = useState<Tab>('instances')
  const pagDevices = useQuery({ queryKey: ['pagDevices', 'all'], queryFn: pagDeviceApi.getAll })
  const active = useQuery({ queryKey: ['pagDevices', 'active'], queryFn: pagDeviceApi.getActive })
  const devices = useQuery({ queryKey: ['devices'], queryFn: deviceApi.getAll })
  const pags = useQuery({ queryKey: ['pags'], queryFn: pagApi.getAll })

  const activeIds = useMemo(() => new Set((active.data ?? []).map((d) => d.id)), [active.data])
  const total = pagDevices.data?.length ?? 0
  const activeCount = (pagDevices.data ?? []).filter((d) => activeIds.has(d.id)).length

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Device API"
        title="Cihazlar"
        description="Yer istasyonundaki cihaz tanımları, PAG grupları ve sahadaki cihazların haberleşme durumu."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<Server className="size-4" />} label="PAG cihazı" value={total} loading={pagDevices.isLoading} sub="Sahada kayıtlı cihaz" />
        <StatCard
          icon={<Activity className="size-4" />}
          label="Aktif"
          accent="emerald"
          value={activeCount}
          loading={pagDevices.isLoading || active.isLoading}
          sub={total ? `%${Math.round((activeCount / total) * 100)} haberleşmede` : '—'}
        />
        <StatCard icon={<Wrench className="size-4" />} label="Bakımda" accent="amber" value={total - activeCount} loading={pagDevices.isLoading || active.isLoading} sub="DCM haberleşmiyor" />
        <StatCard icon={<Cpu className="size-4" />} label="Cihaz tanımı" accent="violet" value={devices.data?.length ?? 0} loading={devices.isLoading} sub={`${pags.data?.length ?? 0} PAG içinde`} />
      </div>

      <Card>
        <Tabs
          className="mx-5 mb-4 pt-2"
          value={tab}
          onChange={setTab}
          items={[
            { value: 'instances', label: 'PAG cihazları', icon: <Server className="size-4" />, count: total },
            { value: 'definitions', label: 'Cihaz tanımları', icon: <Cpu className="size-4" />, count: devices.data?.length },
            { value: 'pags', label: 'PAG’ler', icon: <Boxes className="size-4" />, count: pags.data?.length },
          ]}
        />
        {tab === 'instances' && (
          <PagDevicesTab
            pagDevices={pagDevices.data ?? []}
            activeIds={activeIds}
            devices={devices.data ?? []}
            pags={pags.data ?? []}
            loading={pagDevices.isLoading}
            error={pagDevices.error}
            onRetry={() => pagDevices.refetch()}
          />
        )}
        {tab === 'definitions' && (
          <DefinitionsTab
            devices={devices.data ?? []}
            pags={pags.data ?? []}
            pagDevices={pagDevices.data ?? []}
            loading={devices.isLoading}
            error={devices.error}
            onRetry={() => devices.refetch()}
          />
        )}
        {tab === 'pags' && (
          <PagsTab
            pags={pags.data ?? []}
            devices={devices.data ?? []}
            pagDevices={pagDevices.data ?? []}
            activeIds={activeIds}
            loading={pags.isLoading}
            error={pags.error}
            onRetry={() => pags.refetch()}
          />
        )}
      </Card>
    </div>
  )
}
