import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, CheckCircle2, TriangleAlert } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { errorMessage } from '../../api/http'
import { cronPolicyApi } from '../../api/rule'
import type { CronPolicyResponse, PolicyScriptResponse } from '../../api/types'
import { Button } from '../../components/ui/Button'
import { Field, Input, Segmented, Select } from '../../components/ui/Form'
import { Modal } from '../../components/ui/Modal'
import { cn } from '../../lib/cn'
import { cronPresets, describeCron } from '../../lib/cron'
import { fromDatetimeLocal, parseApiDate, toApiDate, toDatetimeLocal } from '../../lib/format'

type Mode = 'periodic' | 'once'

interface CronModalProps {
  onClose: () => void
  policy: CronPolicyResponse | null
  scripts: PolicyScriptResponse[]
}

export function CronModal({ open, ...props }: CronModalProps & { open: boolean }) {
  return open ? <CronModalContent key={props.policy?.id ?? 'new'} {...props} /> : null
}

function defaultWindow(policy: CronPolicyResponse | null) {
  const start = new Date()
  start.setMinutes(start.getMinutes() + 5, 0, 0)
  const fallbackEnd = new Date(start.getTime() + 30 * 86_400_000)
  if (!policy) return { start: toDatetimeLocal(start), end: toDatetimeLocal(fallbackEnd) }
  return {
    start: toDatetimeLocal(parseApiDate(policy.startAt) ?? start),
    end: toDatetimeLocal(parseApiDate(policy.endAt) ?? fallbackEnd),
  }
}

function CronModalContent({ onClose, policy, scripts }: CronModalProps) {
  const queryClient = useQueryClient()
  const [defaults] = useState(() => defaultWindow(policy))
  const [name, setName] = useState(policy?.name ?? '')
  const [selectedScript, setScriptId] = useState(policy?.policyScriptId ?? '')
  const [mode, setMode] = useState<Mode>(policy?.forOnce ? 'once' : 'periodic')
  const [cron, setCron] = useState(policy?.cronFormat ?? '*/15 * * * *')
  const [startAt, setStartAt] = useState(defaults.start)
  const [endAt, setEndAt] = useState(defaults.end)
  const [error, setError] = useState<string | null>(null)
  const scriptId = selectedScript || scripts[0]?.id || ''

  const description = mode === 'periodic' ? describeCron(cron) : null

  const mutation = useMutation({
    mutationFn: () => {
      const model = {
        name: name.trim(),
        policyScriptId: scriptId,
        forOnce: mode === 'once',
        cronFormat: mode === 'once' ? null : cron.trim(),
        startAt: toApiDate(fromDatetimeLocal(startAt)!),
        endAt: toApiDate(fromDatetimeLocal(endAt)!),
      }
      return policy ? cronPolicyApi.update({ id: policy.id, ...model }) : cronPolicyApi.add(model)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cronPolicies'] })
      toast.success(policy ? 'Cron politikası güncellendi' : 'Cron politikası oluşturuldu', {
        description: policy ? undefined : 'Çalışması için listeden başlatın.',
      })
      onClose()
    },
    onError: (err) => toast.error('Kaydedilemedi', { description: errorMessage(err) }),
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const start = fromDatetimeLocal(startAt)
    const end = fromDatetimeLocal(endAt)
    if (!name.trim()) return setError('Ad gerekli.')
    if (!scriptId) return setError('Bir politika scripti seçin.')
    if (mode === 'periodic' && !description) return setError('Geçerli bir cron ifadesi girin.')
    if (!start || !end) return setError('Başlangıç ve bitiş gerekli.')
    if (end <= start) return setError('Bitiş başlangıçtan sonra olmalı.')
    setError(null)
    mutation.mutate()
  }

  return (
    <Modal
      open
      onClose={onClose}
      icon={<CalendarClock className="size-4" />}
      title={policy ? 'Cron politikasını düzenle' : 'Yeni cron politikası'}
      description="Bir politika scriptini zamanlanmış olarak çalıştırır."
      dismissible={!mutation.isPending}
      footer={
        <>
          {error && <span className="mr-auto text-xs text-rose-300">{error}</span>}
          <Button variant="ghost" onClick={onClose}>
            Vazgeç
          </Button>
          <Button variant="primary" type="submit" form="cron-form" loading={mutation.isPending}>
            Kaydet
          </Button>
        </>
      }
    >
      <form id="cron-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Ad" required>
          {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="Günlük sağlık kontrolü" autoFocus />}
        </Field>
        <Field label="Politika scripti" required>
          {(id) => (
            <Select id={id} value={scriptId} onChange={(e) => setScriptId(e.target.value)}>
              {scripts.length === 0 && <option value="">Önce bir script oluşturun</option>}
              {scripts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-medium text-ink-200">Çalışma şekli</span>
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: 'periodic', label: 'Periyodik' },
              { value: 'once', label: 'Tek seferlik' },
            ]}
          />
        </div>
        {mode === 'periodic' && (
          <div className="space-y-2.5 rounded-xl bg-ink-900/50 p-4 ring-1 ring-white/8">
            <Field label="Cron ifadesi">
              {(id) => <Input id={id} value={cron} onChange={(e) => setCron(e.target.value)} className="num" spellCheck={false} />}
            </Field>
            <div className={cn('flex items-center gap-1.5 text-xs', description ? 'text-emerald-300' : 'text-rose-300')}>
              {description ? <CheckCircle2 className="size-3.5" /> : <TriangleAlert className="size-3.5" />}
              {description ?? 'Geçersiz ifade'}
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {cronPresets.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setCron(p.value)}
                  className={cn(
                    'rounded-md px-2 py-1 text-[11.5px] ring-1 transition',
                    cron === p.value ? 'bg-cyan-400/15 text-cyan-200 ring-cyan-400/30' : 'text-ink-300 ring-white/10 hover:bg-white/5',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label={mode === 'once' ? 'Çalışma zamanı' : 'Başlangıç'} required>
            {(id) => <Input id={id} type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />}
          </Field>
          <Field label="Bitiş" required>
            {(id) => <Input id={id} type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />}
          </Field>
        </div>
      </form>
    </Modal>
  )
}
