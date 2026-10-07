import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Cpu, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { deviceApi } from '../../api/device'
import { errorMessage } from '../../api/http'
import { CommunicationType, type DeviceResponse, type PagDeviceResponse, type PagResponse } from '../../api/types'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { useConfirm } from '../../components/ui/Confirm'
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/States'
import { parseCommunication, snmpVersionLabel } from './communication'
import { DeviceModal } from './DeviceModal'

export function DefinitionsTab({
  devices,
  pags,
  pagDevices,
  loading,
  error,
  onRetry,
}: {
  devices: DeviceResponse[]
  pags: PagResponse[]
  pagDevices: PagDeviceResponse[]
  loading: boolean
  error: unknown
  onRetry: () => void
}) {
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const [editing, setEditing] = useState<DeviceResponse | null>(null)
  const [open, setOpen] = useState(false)

  const remove = useMutation({
    mutationFn: (id: string) => deviceApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] })
      toast.success('Cihaz tanımı silindi')
    },
    onError: (err) => toast.error('Silinemedi', { description: errorMessage(err) }),
  })

  return (
    <div className="px-5 pb-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-ink-400">Cihaz tipleri, haberleşme protokolleri ve izlenen parametreler.</p>
        <Button
          size="sm"
          variant="primary"
          icon={<Plus className="size-3.5" />}
          onClick={() => {
            setEditing(null)
            setOpen(true)
          }}
        >
          Cihaz tanımı
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={onRetry} compact />
      ) : devices.length === 0 ? (
        <EmptyState icon={<Cpu className="size-6" />} title="Cihaz tanımı yok" description="SNMP ya da TCP ile haberleşen bir cihaz tipi ekleyin." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {devices.map((device) => {
            const data = parseCommunication(device)
            const queries = data.Queries ?? []
            const instances = pagDevices.filter((p) => p.deviceId === device.id).length
            const isSnmp = device.communicationType === CommunicationType.SNMP
            return (
              <div key={device.id} className="group relative rounded-xl bg-white/[0.025] p-4 ring-1 ring-white/8 transition hover:bg-white/[0.04] hover:ring-white/12">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={`grid size-10 shrink-0 place-items-center rounded-xl ring-1 ${isSnmp ? 'bg-sky-400/10 text-sky-300 ring-sky-400/25' : 'bg-fuchsia-400/10 text-fuchsia-300 ring-fuchsia-400/25'}`}>
                      <Cpu className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-medium text-ink-100">{device.name}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Badge tone={isSnmp ? 'sky' : 'fuchsia'}>
                          {isSnmp ? `SNMP ${snmpVersionLabel[data.SNMPVersion ?? 2] ?? ''}` : 'TCP'}
                        </Badge>
                        <Badge tone="violet">{device.pag?.name ?? pags.find((p) => p.id === device.pagId)?.name ?? '—'}</Badge>
                        {data.Version && <span className="num text-[11px] text-ink-500">v{data.Version}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-60 transition group-hover:opacity-100">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => {
                        setEditing(device)
                        setOpen(true)
                      }}
                      aria-label="Düzenle"
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="hover:text-rose-300"
                      onClick={async () => {
                        if (
                          await confirm({
                            title: `${device.name} silinsin mi?`,
                            description: instances > 0 ? `Bu tanıma bağlı ${instances} PAG cihazı var.` : 'Bu işlem geri alınamaz.',
                            confirmLabel: 'Sil',
                          })
                        )
                          remove.mutate(device.id)
                      }}
                      aria-label="Sil"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="label-caps mb-1.5 flex items-center justify-between">
                    <span>Parametreler</span>
                    <span className="num normal-case tracking-normal text-ink-500">{instances} kurulu</span>
                  </div>
                  {queries.length === 0 ? (
                    <p className="text-xs text-ink-500">Parametre tanımlı değil.</p>
                  ) : (
                    <ul className="space-y-1">
                      {queries.slice(0, 4).map((q) => (
                        <li key={q.ParameterId} className="flex items-center justify-between gap-3 rounded-md bg-ink-950/40 px-2.5 py-1.5 text-xs">
                          <span className="truncate text-ink-200">{q.ParameterName}</span>
                          <span className="num truncate text-[11px] text-ink-400">{q.Query}</span>
                        </li>
                      ))}
                      {queries.length > 4 && <li className="px-2.5 text-[11px] text-ink-500">+{queries.length - 4} parametre daha</li>}
                    </ul>
                  )}
                </div>
                {isSnmp && data.ReadCommunity && (
                  <div className="num mt-3 text-[11px] text-ink-500">community: {data.ReadCommunity}</div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <DeviceModal open={open} onClose={() => setOpen(false)} device={editing} pags={pags} />
    </div>
  )
}
