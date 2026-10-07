import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Boxes, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { pagApi } from '../../api/device'
import { errorMessage } from '../../api/http'
import type { DeviceResponse, PagDeviceResponse, PagResponse } from '../../api/types'
import { Button } from '../../components/ui/Button'
import { useConfirm } from '../../components/ui/Confirm'
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/States'
import { PagModal } from './PagModals'

const accents = ['from-cyan-400/25', 'from-violet-400/25', 'from-amber-400/25', 'from-emerald-400/25', 'from-fuchsia-400/25', 'from-sky-400/25']

export function PagsTab({
  pags,
  devices,
  pagDevices,
  activeIds,
  loading,
  error,
  onRetry,
}: {
  pags: PagResponse[]
  devices: DeviceResponse[]
  pagDevices: PagDeviceResponse[]
  activeIds: Set<string>
  loading: boolean
  error: unknown
  onRetry: () => void
}) {
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const [editing, setEditing] = useState<PagResponse | null>(null)
  const [open, setOpen] = useState(false)

  const remove = useMutation({
    mutationFn: (id: string) => pagApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pags'] })
      toast.success('PAG silindi')
    },
    onError: (err) => toast.error('Silinemedi', { description: errorMessage(err) }),
  })

  return (
    <div className="px-5 pb-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-ink-400">Cihazları işlevine göre gruplayan PAG’ler.</p>
        <Button
          size="sm"
          variant="primary"
          icon={<Plus className="size-3.5" />}
          onClick={() => {
            setEditing(null)
            setOpen(true)
          }}
        >
          PAG
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={onRetry} compact />
      ) : pags.length === 0 ? (
        <EmptyState icon={<Boxes className="size-6" />} title="PAG yok" description="Cihazları gruplamak için bir PAG oluşturun." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {pags.map((pag, i) => {
            const defs = devices.filter((d) => d.pagId === pag.id)
            const instances = pagDevices.filter((p) => p.pagId === pag.id)
            const active = instances.filter((p) => activeIds.has(p.id)).length
            const ratio = instances.length ? active / instances.length : 0
            return (
              <div key={pag.id} className="group relative overflow-hidden rounded-xl bg-white/[0.025] p-5 ring-1 ring-white/8">
                <div className={`pointer-events-none absolute -top-12 -right-12 size-40 rounded-full bg-gradient-to-br to-transparent blur-2xl ${accents[i % accents.length]}`} />
                <div className="relative flex items-start justify-between">
                  <div>
                    <div className="label-caps">PAG</div>
                    <div className="mt-1 text-lg font-semibold text-ink-100">{pag.name}</div>
                  </div>
                  <div className="flex gap-1 opacity-60 transition group-hover:opacity-100">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => {
                        setEditing(pag)
                        setOpen(true)
                      }}
                      aria-label="Yeniden adlandır"
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
                            title: `${pag.name} silinsin mi?`,
                            description: defs.length || instances.length ? `Bu PAG’de ${defs.length} cihaz tanımı ve ${instances.length} PAG cihazı var.` : 'Bu işlem geri alınamaz.',
                            confirmLabel: 'Sil',
                          })
                        )
                          remove.mutate(pag.id)
                      }}
                      aria-label="Sil"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="relative mt-5 grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="num text-2xl font-semibold text-ink-100">{defs.length}</div>
                    <div className="text-[11px] text-ink-400">tanım</div>
                  </div>
                  <div>
                    <div className="num text-2xl font-semibold text-ink-100">{instances.length}</div>
                    <div className="text-[11px] text-ink-400">cihaz</div>
                  </div>
                  <div>
                    <div className="num text-2xl font-semibold text-emerald-300">{active}</div>
                    <div className="text-[11px] text-ink-400">aktif</div>
                  </div>
                </div>
                <div className="relative mt-4 h-1.5 overflow-hidden rounded-full bg-white/6">
                  <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400" style={{ width: `${ratio * 100}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      <PagModal open={open} onClose={() => setOpen(false)} pag={editing} />
    </div>
  )
}
