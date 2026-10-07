import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, Pencil, Plus, Repeat, Search, Timer, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { errorMessage } from '../../api/http'
import { cronPolicyApi } from '../../api/rule'
import type { CronPolicyResponse, PolicyScriptResponse } from '../../api/types'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { useConfirm } from '../../components/ui/Confirm'
import { Input, Segmented, Switch } from '../../components/ui/Form'
import { EmptyState, ErrorState, TableSkeleton } from '../../components/ui/States'
import { Table, TD, TH, THead, TR } from '../../components/ui/Table'
import { describeCron } from '../../lib/cron'
import { formatShortDateTime, parseApiDate } from '../../lib/format'
import { CronModal } from './CronModal'

type Filter = 'all' | 'running' | 'stopped'

export function CronTab({
  policies,
  scripts,
  loading,
  error,
  onRetry,
}: {
  policies: CronPolicyResponse[]
  scripts: PolicyScriptResponse[]
  loading: boolean
  error: unknown
  onRetry: () => void
}) {
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [editing, setEditing] = useState<CronPolicyResponse | null>(null)
  const [open, setOpen] = useState(false)

  const rows = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr-TR')
    return policies
      .filter((p) => (filter === 'all' ? true : filter === 'running' ? p.isRunning : !p.isRunning))
      .filter((p) => !q || p.name.toLocaleLowerCase('tr-TR').includes(q))
  }, [policies, filter, search])

  const scriptName = (id: string, fallback?: string | null) => scripts.find((s) => s.id === id)?.name ?? fallback ?? '—'

  const toggle = useMutation({
    mutationFn: ({ id, start }: { id: string; start: boolean }) => cronPolicyApi.startOrStop(id, start),
    onSuccess: (result, { start }) => {
      queryClient.invalidateQueries({ queryKey: ['cronPolicies'] })
      if (result === false) toast.error('Durum değiştirilemedi')
      else toast.success(start ? 'Cron işi başlatıldı' : 'Cron işi durduruldu')
    },
    onError: (err) => toast.error('İşlem başarısız', { description: errorMessage(err) }),
  })

  const remove = useMutation({
    mutationFn: (id: string) => cronPolicyApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cronPolicies'] })
      toast.success('Cron politikası silindi')
    },
    onError: (err) => toast.error('Silinemedi', { description: errorMessage(err) }),
  })

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 px-5 pb-4">
        <div className="w-full max-w-xs">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Politika ara" leading={<Search className="size-4" />} className="h-9" />
        </div>
        <Segmented
          size="sm"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'Tümü' },
            { value: 'running', label: 'Çalışan' },
            { value: 'stopped', label: 'Durdurulmuş' },
          ]}
        />
        <Button
          size="sm"
          variant="primary"
          className="ml-auto"
          icon={<Plus className="size-3.5" />}
          onClick={() => {
            setEditing(null)
            setOpen(true)
          }}
        >
          Cron politikası
        </Button>
      </div>

      {loading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorState error={error} onRetry={onRetry} />
      ) : rows.length === 0 ? (
        <EmptyState icon={<CalendarClock className="size-6" />} title="Cron politikası yok" description="Bir scripti zamanlanmış olarak çalıştırmak için politika oluşturun." />
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Politika</TH>
              <TH>Zamanlama</TH>
              <TH>Geçerlilik</TH>
              <TH>Durum</TH>
              <TH className="text-right">İşlemler</TH>
            </tr>
          </THead>
          <tbody>
            {rows.map((p) => {
              const start = parseApiDate(p.startAt)
              const end = parseApiDate(p.endAt)
              return (
                <TR key={p.id}>
                  <TD>
                    <div className="font-medium text-ink-100">{p.name}</div>
                    <div className="mt-0.5 text-xs text-ink-400">Script: {scriptName(p.policyScriptId, p.policyScript?.name)}</div>
                  </TD>
                  <TD>
                    {p.forOnce ? (
                      <div className="flex items-center gap-2">
                        <Timer className="size-4 text-amber-300" />
                        <div>
                          <div className="text-[13px] text-ink-100">Tek seferlik</div>
                          <div className="num text-xs text-ink-400">{formatShortDateTime(start)}</div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Repeat className="size-4 text-cyan-300" />
                        <div>
                          <div className="text-[13px] text-ink-100">{describeCron(p.cronFormat) ?? 'Geçersiz ifade'}</div>
                          <div className="num text-xs text-ink-400">{p.cronFormat}</div>
                        </div>
                      </div>
                    )}
                  </TD>
                  <TD className="num text-xs text-ink-300">
                    <div>{formatShortDateTime(start)}</div>
                    <div className="text-ink-500">→ {end ? formatShortDateTime(end) : 'süresiz'}</div>
                  </TD>
                  <TD>
                    <div className="flex items-center gap-3">
                      <Switch
                        size="sm"
                        checked={p.isRunning}
                        disabled={toggle.isPending && toggle.variables?.id === p.id}
                        onChange={(start) => toggle.mutate({ id: p.id, start })}
                      />
                      {p.isRunning ? (
                        <Badge tone="emerald" dot pulse>
                          Çalışıyor
                        </Badge>
                      ) : (
                        <Badge>Durdu</Badge>
                      )}
                    </div>
                  </TD>
                  <TD>
                    <div className="flex justify-end gap-1 opacity-70 transition group-hover:opacity-100">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => {
                          setEditing(p)
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
                          if (await confirm({ title: `${p.name} silinsin mi?`, description: 'Zamanlanmış iş Rule Engine’den kaldırılır.', confirmLabel: 'Sil' })) remove.mutate(p.id)
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

      <CronModal open={open} onClose={() => setOpen(false)} policy={editing} scripts={scripts} />
    </div>
  )
}
