import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarPlus } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { errorMessage } from '../../api/http'
import { passApi } from '../../api/satops'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select, Switch } from '../../components/ui/Form'
import { Modal } from '../../components/ui/Modal'
import { formatDuration, fromDatetimeLocal, toApiDate, toDatetimeLocal } from '../../lib/format'
import { maxElevationBetween, type GroundStation, type PredictedPass, type TrackedSatellite } from './orbit'

const OTHER = '__other__'

interface ManualPassModalProps {
  onClose: () => void
  satellites: TrackedSatellite[]
  station: GroundStation | null
  predicted: PredictedPass[]
}

export function ManualPassModal({ open, ...props }: ManualPassModalProps & { open: boolean }) {
  return open ? <ManualPassModalContent {...props} /> : null
}

/** Form, açılış anındaki ilk tahmini geçişle doldurulur. */
function initialPass(predicted: PredictedPass[], satellites: TrackedSatellite[]) {
  const now = Date.now()
  const first = predicted.find((p) => !p.continuous && p.aos.getTime() > now)
  const sat = first ? satellites.find((s) => s.key === first.satKey) : satellites[0]
  return {
    satKey: sat?.key ?? OTHER,
    aos: first ? toDatetimeLocal(first.aos) : '',
    los: first ? toDatetimeLocal(first.los) : '',
    maxEl: first ? first.maxElevation.toFixed(1) : '',
  }
}

function ManualPassModalContent({ onClose, satellites, station, predicted }: ManualPassModalProps) {
  const queryClient = useQueryClient()
  const [initial] = useState(() => initialPass(predicted, satellites))
  const [satKey, setSatKey] = useState<string>(initial.satKey)
  const [customName, setCustomName] = useState('')
  const [aos, setAos] = useState(initial.aos)
  const [los, setLos] = useState(initial.los)
  const [maxEl, setMaxEl] = useState(initial.maxEl)
  const [important, setImportant] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sat = satellites.find((s) => s.key === satKey)
  const aosDate = fromDatetimeLocal(aos)
  const losDate = fromDatetimeLocal(los)
  const durationSec = aosDate && losDate ? (losDate.getTime() - aosDate.getTime()) / 1000 : 0

  const computedMax = useMemo(() => {
    const a = fromDatetimeLocal(aos)
    const l = fromDatetimeLocal(los)
    return sat?.satrec && station && a && l && l > a ? maxElevationBetween(sat.satrec, station, a, l) : null
  }, [sat, station, aos, los])

  const mutation = useMutation({
    mutationFn: passApi.add,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['passes'] })
      toast.success('Geçiş eklendi')
      onClose()
    },
    onError: (err) => toast.error('Geçiş eklenemedi', { description: errorMessage(err) }),
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const name = sat ? sat.name : customName.trim()
    if (!name) return setError('Uydu adı gerekli.')
    if (!aosDate || !losDate || durationSec <= 0) return setError('LOS, AOS’tan sonra olmalı.')
    setError(null)
    mutation.mutate({
      name,
      aos: toApiDate(aosDate),
      los: toApiDate(losDate),
      duration: Math.round((durationSec / 60) * 100) / 100,
      maxElevation: Number(maxEl.replace(',', '.')) || computedMax || 0,
      isImportant: important,
    })
  }

  return (
    <Modal
      open
      onClose={onClose}
      icon={<CalendarPlus className="size-4" />}
      title="Manuel geçiş ekle"
      description="Planlamaya tek bir geçişi elle ekleyin."
      dismissible={!mutation.isPending}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Vazgeç
          </Button>
          <Button variant="primary" type="submit" form="manual-pass" loading={mutation.isPending}>
            Ekle
          </Button>
        </>
      }
    >
      <form id="manual-pass" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Uydu" required>
          {(id) => (
            <Select id={id} value={satKey} onChange={(e) => setSatKey(e.target.value)}>
              {satellites.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.name}
                </option>
              ))}
              <option value={OTHER}>Diğer…</option>
            </Select>
          )}
        </Field>
        {satKey === OTHER && (
          <Field label="Uydu adı" required>
            {(id) => <Input id={id} value={customName} onChange={(e) => setCustomName(e.target.value)} />}
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="AOS" required>
            {(id) => <Input id={id} type="datetime-local" step={1} value={aos} onChange={(e) => setAos(e.target.value)} />}
          </Field>
          <Field label="LOS" required hint={durationSec > 0 ? `Süre: ${formatDuration(durationSec)}` : undefined}>
            {(id) => <Input id={id} type="datetime-local" step={1} value={los} onChange={(e) => setLos(e.target.value)} />}
          </Field>
        </div>
        <Field
          label="Maks. elevasyon (°)"
          hint={computedMax !== null ? `SGP4 ile hesaplanan: ${computedMax.toFixed(1)}°` : undefined}
        >
          {(id) => (
            <Input
              id={id}
              inputMode="decimal"
              value={maxEl}
              onChange={(e) => setMaxEl(e.target.value)}
              placeholder={computedMax?.toFixed(1)}
              className="num"
            />
          )}
        </Field>
        <Switch checked={important} onChange={setImportant} label="Önemli geçiş" description="Çakışmalarda bu geçiş öncelikli tutulur." />
        {error && <p className="text-sm text-rose-300">{error}</p>}
      </form>
    </Modal>
  )
}
