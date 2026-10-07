import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarPlus, Star } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { errorMessage } from '../../api/http'
import { passApi } from '../../api/satops'
import type { AddSatellitePassModel, SatellitePassFromTle } from '../../api/types'
import { Button } from '../../components/ui/Button'
import { Checkbox } from '../../components/ui/Form'
import { Modal } from '../../components/ui/Modal'
import { EmptyState, ErrorState, TableSkeleton } from '../../components/ui/States'
import { Table, TD, TH, THead, TR } from '../../components/ui/Table'
import { cn } from '../../lib/cn'
import { formatDateTime, formatDuration, parseApiDate } from '../../lib/format'
import { maxElevationBetween, type GroundStation, type TrackedSatellite } from './orbit'

interface Row {
  id: number
  pass: SatellitePassFromTle
  aos: Date | null
  los: Date | null
  maxElevation: number
  color: string
}

interface PassSelectionModalProps {
  onClose: () => void
  passes: SatellitePassFromTle[] | undefined
  loading?: boolean
  error?: unknown
  satellites: TrackedSatellite[]
  station: GroundStation | null
  title?: string
  description?: string
}

/** Hesaplanan geçişlerden seçilenleri planlamaya ekler (SatellitePass/getpassbyrange). */
export function PassSelectionModal({ open, ...props }: PassSelectionModalProps & { open: boolean }) {
  return open ? <PassSelectionModalContent {...props} /> : null
}

function PassSelectionModalContent({
  onClose,
  passes,
  loading,
  error,
  satellites,
  station,
  title = 'Geçişleri planla',
  description,
}: PassSelectionModalProps) {
  const queryClient = useQueryClient()
  const [openedAt] = useState(() => Date.now())

  const rows = useMemo<Row[]>(() => {
    const byName = new Map(satellites.map((s) => [s.name.toLocaleLowerCase('tr-TR'), s]))
    return (passes ?? []).map((pass, id) => {
      const aos = parseApiDate(pass.aos)
      const los = parseApiDate(pass.los)
      const sat = byName.get(pass.name.toLocaleLowerCase('tr-TR'))
      const maxElevation =
        sat?.satrec && station && aos && los ? maxElevationBetween(sat.satrec, station, aos, los) : 0
      return { id, pass, aos, los, maxElevation, color: sat?.color ?? '#94a3b8' }
    })
  }, [passes, satellites, station])

  const [selected, setSelected] = useState<Set<number> | null>(null)
  const [important, setImportant] = useState<Set<number>>(new Set())

  // Varsayılan seçim: gelecekteki tüm geçişler.
  const effectiveSelected = useMemo(() => {
    if (selected) return selected
    return new Set(rows.filter((r) => (r.aos?.getTime() ?? 0) > openedAt).map((r) => r.id))
  }, [selected, rows, openedAt])

  const mutation = useMutation({
    mutationFn: (models: AddSatellitePassModel[]) => passApi.addMany(models),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['passes'] })
      toast.success(`${saved?.length ?? 0} geçiş planlamaya eklendi`)
      close()
    },
    onError: (err) => toast.error('Geçişler eklenemedi', { description: errorMessage(err) }),
  })

  const close = onClose

  const toggle = (id: number, value: boolean) => {
    const next = new Set(effectiveSelected)
    if (value) next.add(id)
    else next.delete(id)
    setSelected(next)
  }

  const submit = () => {
    const models = rows
      .filter((r) => effectiveSelected.has(r.id))
      .map<AddSatellitePassModel>((r) => ({
        name: r.pass.name,
        duration: r.pass.duration,
        aos: r.pass.aos,
        los: r.pass.los,
        maxElevation: Math.round(r.maxElevation * 10) / 10,
        isImportant: important.has(r.id),
      }))
    if (models.length) mutation.mutate(models)
  }

  const allChecked = rows.length > 0 && effectiveSelected.size === rows.length

  return (
    <Modal
      open
      onClose={close}
      size="xl"
      icon={<CalendarPlus className="size-4" />}
      title={title}
      description={description ?? 'Planlamaya eklenecek geçişleri seçin. Yıldızlı geçişler çakışmalarda önceliklidir.'}
      dismissible={!mutation.isPending}
      footer={
        <>
          <span className="mr-auto text-xs text-ink-400">
            {effectiveSelected.size} / {rows.length} geçiş seçili
          </span>
          <Button variant="ghost" onClick={close}>
            Kapat
          </Button>
          <Button variant="primary" onClick={submit} loading={mutation.isPending} disabled={effectiveSelected.size === 0}>
            Seçilenleri planla
          </Button>
        </>
      }
    >
      {loading ? (
        <TableSkeleton rows={6} />
      ) : error ? (
        <ErrorState error={error} compact />
      ) : rows.length === 0 ? (
        <EmptyState title="Geçiş bulunamadı" description="Bu pencerede minimum elevasyonun üstüne çıkan geçiş yok." />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            <Button size="xs" variant="outline" onClick={() => setSelected(new Set(rows.map((r) => r.id)))}>
              Tümünü seç
            </Button>
            <Button size="xs" variant="outline" onClick={() => setSelected(new Set())}>
              Seçimi temizle
            </Button>
            <Button
              size="xs"
              variant="outline"
              onClick={() => setSelected(new Set(rows.filter((r) => r.maxElevation >= 20).map((r) => r.id)))}
            >
              Maks. elevasyon ≥ 20°
            </Button>
          </div>
          <div className="-mx-6 max-h-[52vh] overflow-y-auto">
            <Table>
              <THead>
                <tr>
                  <TH className="w-10">
                    <Checkbox
                      checked={allChecked}
                      indeterminate={!allChecked && effectiveSelected.size > 0}
                      onChange={(v) => setSelected(v ? new Set(rows.map((r) => r.id)) : new Set())}
                      aria-label="Tümünü seç"
                    />
                  </TH>
                  <TH>Uydu</TH>
                  <TH>AOS</TH>
                  <TH>LOS</TH>
                  <TH>Süre</TH>
                  <TH>Maks. El</TH>
                  <TH className="text-center">Öncelik</TH>
                </tr>
              </THead>
              <tbody>
                {rows.map((r) => {
                  const isOn = effectiveSelected.has(r.id)
                  const star = important.has(r.id)
                  return (
                    <TR key={r.id} className={cn(!isOn && 'opacity-55')}>
                      <TD>
                        <Checkbox checked={isOn} onChange={(v) => toggle(r.id, v)} aria-label={`${r.pass.name} seç`} />
                      </TD>
                      <TD>
                        <span className="inline-flex items-center gap-2 font-medium whitespace-nowrap text-ink-100">
                          <span className="size-2 rounded-full" style={{ background: r.color }} />
                          {r.pass.name}
                        </span>
                      </TD>
                      <TD className="num text-[13px] whitespace-nowrap">{formatDateTime(r.aos)}</TD>
                      <TD className="num text-[13px] whitespace-nowrap">{formatDateTime(r.los)}</TD>
                      <TD className="num text-[13px] whitespace-nowrap">
                        {r.aos && r.los ? formatDuration((r.los.getTime() - r.aos.getTime()) / 1000) : `${r.pass.duration} dk`}
                      </TD>
                      <TD>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/8">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400"
                              style={{ width: `${Math.min(100, (r.maxElevation / 90) * 100)}%` }}
                            />
                          </div>
                          <span className="num text-[12.5px] text-ink-200">{r.maxElevation.toFixed(1)}°</span>
                        </div>
                      </TD>
                      <TD className="text-center">
                        <button
                          type="button"
                          onClick={() => {
                            const next = new Set(important)
                            if (star) next.delete(r.id)
                            else next.add(r.id)
                            setImportant(next)
                          }}
                          className="rounded p-1 transition hover:bg-white/8"
                          aria-label="Önemli olarak işaretle"
                        >
                          <Star className={cn('size-4', star ? 'fill-amber-300 text-amber-300' : 'text-ink-500')} />
                        </button>
                      </TD>
                    </TR>
                  )
                })}
              </tbody>
            </Table>
          </div>
        </>
      )}
    </Modal>
  )
}
