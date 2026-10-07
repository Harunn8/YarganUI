import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, PowerOff, Search, Server, Trash2, Wrench } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { pagDeviceApi } from '../../api/device'
import { errorMessage } from '../../api/http'
import type { DeviceResponse, PagDeviceResponse, PagResponse } from '../../api/types'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { useConfirm } from '../../components/ui/Confirm'
import { Checkbox, Input, Segmented, Select } from '../../components/ui/Form'
import { EmptyState, ErrorState, TableSkeleton } from '../../components/ui/States'
import { Table, TD, TH, THead, TR } from '../../components/ui/Table'
import { communicationTypeLabel } from '../../api/types'
import { PagDeviceModal } from './PagModals'

type StatusFilter = 'all' | 'active' | 'maintenance'

/*
 * PagDevice/startorstop ucu backend'de cihazın InMaintenance alanını `isStart` değerine
 * eşitliyor (isStart=true → bakıma alır, DCM haberleşmeyi keser). Arayüz bu yüzden
 * eylemleri etkisine göre "Bakıma al / Bakımdan çıkar" olarak adlandırır.
 */
const PUT_IN_MAINTENANCE = true

export function PagDevicesTab({
  pagDevices,
  activeIds,
  devices,
  pags,
  loading,
  error,
  onRetry,
}: {
  pagDevices: PagDeviceResponse[]
  activeIds: Set<string>
  devices: DeviceResponse[]
  pags: PagResponse[]
  loading: boolean
  error: unknown
  onRetry: () => void
}) {
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const [search, setSearch] = useState('')
  const [pagFilter, setPagFilter] = useState('all')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<(PagDeviceResponse & { active?: boolean }) | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const rows = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr-TR')
    return pagDevices
      .map((p) => ({ ...p, active: activeIds.has(p.id) }))
      .filter((p) => (pagFilter === 'all' ? true : p.pagId === pagFilter))
      .filter((p) => (status === 'all' ? true : status === 'active' ? p.active : !p.active))
      .filter((p) => !q || p.name.toLocaleLowerCase('tr-TR').includes(q) || p.ipAddress.includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
  }, [pagDevices, activeIds, pagFilter, status, search])

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['pagDevices'] })

  const toggle = useMutation({
    mutationFn: ({ id, maintenance }: { id: string; maintenance: boolean }) =>
      pagDeviceApi.startOrStop(id, maintenance ? PUT_IN_MAINTENANCE : !PUT_IN_MAINTENANCE),
    onSuccess: (_, { maintenance }) => {
      invalidate()
      toast.success(maintenance ? 'Cihaz bakıma alındı' : 'Cihaz bakımdan çıkarıldı', { description: 'DCM’e bildirim gönderildi.' })
    },
    onError: (err) => toast.error('İşlem başarısız', { description: errorMessage(err) }),
  })

  const bulk = useMutation({
    mutationFn: ({ ids, maintenance }: { ids: string[]; maintenance: boolean }) =>
      pagDeviceApi.startOrStopMany(ids, maintenance ? PUT_IN_MAINTENANCE : !PUT_IN_MAINTENANCE),
    onSuccess: (_, { ids, maintenance }) => {
      invalidate()
      setSelected(new Set())
      toast.success(`${ids.length} cihaz ${maintenance ? 'bakıma alındı' : 'bakımdan çıkarıldı'}`)
    },
    onError: (err) => toast.error('Toplu işlem başarısız', { description: errorMessage(err) }),
  })

  const remove = useMutation({
    mutationFn: (id: string) => pagDeviceApi.remove(id),
    onSuccess: () => {
      invalidate()
      toast.success('PAG cihazı silindi')
    },
    onError: (err) => toast.error('Silinemedi', { description: errorMessage(err) }),
  })

  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id))
  const deviceName = (id: string) => devices.find((d) => d.id === id)
  const pagName = (id: string) => pags.find((p) => p.id === id)?.name ?? '—'

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 px-5 pb-4">
        <div className="w-full max-w-xs">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ad ya da IP ara" leading={<Search className="size-4" />} className="h-9" />
        </div>
        <div className="w-48">
          <Select value={pagFilter} onChange={(e) => setPagFilter(e.target.value)} className="h-9">
            <option value="all">Tüm PAG’ler</option>
            {pags.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
        <Segmented
          size="sm"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'all', label: 'Tümü' },
            { value: 'active', label: 'Aktif' },
            { value: 'maintenance', label: 'Bakımda' },
          ]}
        />
        <div className="ml-auto flex items-center gap-2">
          {selected.size > 0 && (
            <>
              <span className="text-xs text-ink-400">{selected.size} seçili</span>
              <Button size="sm" variant="success" icon={<Wrench className="size-3.5" />} loading={bulk.isPending && bulk.variables?.maintenance === false} onClick={() => bulk.mutate({ ids: [...selected], maintenance: false })}>
                Bakımdan çıkar
              </Button>
              <Button size="sm" variant="danger" icon={<PowerOff className="size-3.5" />} loading={bulk.isPending && bulk.variables?.maintenance === true} onClick={() => bulk.mutate({ ids: [...selected], maintenance: true })}>
                Bakıma al
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="primary"
            icon={<Plus className="size-3.5" />}
            onClick={() => {
              setEditing(null)
              setModalOpen(true)
            }}
          >
            PAG cihazı
          </Button>
        </div>
      </div>

      {loading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorState error={error} onRetry={onRetry} />
      ) : rows.length === 0 ? (
        <EmptyState icon={<Server className="size-6" />} title="PAG cihazı bulunamadı" description="Filtreleri değiştirin ya da yeni bir PAG cihazı ekleyin." />
      ) : (
        <Table>
          <THead>
            <tr>
              <TH className="w-10">
                <Checkbox
                  checked={allChecked}
                  indeterminate={!allChecked && selected.size > 0}
                  onChange={(v) => setSelected(v ? new Set(rows.map((r) => r.id)) : new Set())}
                  aria-label="Tümünü seç"
                />
              </TH>
              <TH>Cihaz</TH>
              <TH>PAG</TH>
              <TH>Adres</TH>
              <TH>Zaman aşımı</TH>
              <TH>Durum</TH>
              <TH className="text-right">İşlemler</TH>
            </tr>
          </THead>
          <tbody>
            {rows.map((row) => {
              const def = deviceName(row.deviceId)
              return (
                <TR key={row.id}>
                  <TD>
                    <Checkbox
                      checked={selected.has(row.id)}
                      onChange={(v) => {
                        const next = new Set(selected)
                        if (v) next.add(row.id)
                        else next.delete(row.id)
                        setSelected(next)
                      }}
                      aria-label={`${row.name} seç`}
                    />
                  </TD>
                  <TD>
                    <div className="font-medium text-ink-100">{row.name}</div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-400">
                      {def && <span className="rounded bg-white/6 px-1 text-[10px] font-semibold text-ink-300">{communicationTypeLabel[def.communicationType]}</span>}
                      {def?.name ?? 'Tanım bulunamadı'}
                    </div>
                  </TD>
                  <TD>
                    <Badge tone="violet">{row.pag?.name ?? pagName(row.pagId)}</Badge>
                  </TD>
                  <TD className="num text-[13px] text-ink-100">
                    {row.ipAddress}
                    <span className="text-ink-500">:{row.port}</span>
                  </TD>
                  <TD className="num text-[13px]">{row.timeout.toLocaleString('tr-TR')} ms</TD>
                  <TD>
                    {row.active ? (
                      <Badge tone="emerald" dot pulse>
                        Aktif
                      </Badge>
                    ) : (
                      <Badge tone="amber" dot>
                        Bakımda
                      </Badge>
                    )}
                  </TD>
                  <TD>
                    <div className="flex justify-end gap-1 opacity-70 transition group-hover:opacity-100">
                      {row.active ? (
                        <Button
                          size="xs"
                          variant="ghost"
                          icon={<PowerOff className="size-3.5" />}
                          loading={toggle.isPending && toggle.variables?.id === row.id}
                          onClick={() => toggle.mutate({ id: row.id, maintenance: true })}
                        >
                          Bakıma al
                        </Button>
                      ) : (
                        <Button
                          size="xs"
                          variant="ghost"
                          icon={<Wrench className="size-3.5" />}
                          loading={toggle.isPending && toggle.variables?.id === row.id}
                          onClick={() => toggle.mutate({ id: row.id, maintenance: false })}
                        >
                          Bakımdan çıkar
                        </Button>
                      )}
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => {
                          setEditing(row)
                          setModalOpen(true)
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
                          if (await confirm({ title: `${row.name} silinsin mi?`, description: 'Cihaz kaydı silinir ve DCM’e bildirilir.', confirmLabel: 'Sil' })) remove.mutate(row.id)
                        }}
                        aria-label="Sil"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TD>
                </TR>
              )
            })}
          </tbody>
        </Table>
      )}

      <PagDeviceModal open={modalOpen} onClose={() => setModalOpen(false)} pagDevice={editing} devices={devices} pags={pags} />
    </div>
  )
}
