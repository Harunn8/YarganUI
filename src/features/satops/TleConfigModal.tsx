import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, ClipboardPaste, Globe2, Plus, Search, Settings2, Trash2, TriangleAlert } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { errorMessage } from '../../api/http'
import { tleApi } from '../../api/satops'
import type { SatellitePassFromTle, TleData, TleResponse } from '../../api/types'
import { Button } from '../../components/ui/Button'
import { Field, Input, Textarea } from '../../components/ui/Form'
import { Modal } from '../../components/ui/Modal'
import { cn } from '../../lib/cn'
import { fromDatetimeLocal, toApiDate, toDatetimeLocal } from '../../lib/format'
import { buildSatellites, parseTleText, validateTle, type GroundStation, type TrackedSatellite } from './orbit'

interface FormState {
  name: string
  latitude: string
  longitude: string
  altitude: string
  minElevation: string
  setupInterval: string
  startAt: string
  endAt: string
}

function initialForm(current: TleResponse | null | undefined): FormState {
  const start = new Date()
  start.setSeconds(0, 0)
  const end = new Date(start.getTime() + 24 * 3_600_000)
  return {
    name: current?.name ?? 'Ankara Yer İstasyonu',
    latitude: String(current?.latitude ?? 39.925),
    longitude: String(current?.longitude ?? 32.837),
    altitude: String(current?.altitude ?? 938),
    minElevation: String(current?.minElevation ?? 5),
    setupInterval: String(current?.setupInterval ?? 120),
    startAt: toDatetimeLocal(start),
    endAt: toDatetimeLocal(end),
  }
}

type Errors = Partial<Record<keyof FormState | 'tle', string>>

function validate(form: FormState, entries: TleData[]): Errors {
  const errors: Errors = {}
  const num = (v: string) => (v.trim() === '' ? NaN : Number(v.replace(',', '.')))
  if (!form.name.trim()) errors.name = 'İstasyon adı gerekli.'
  const lat = num(form.latitude)
  if (!(lat >= -90 && lat <= 90)) errors.latitude = '-90 ile 90 arasında olmalı.'
  const lon = num(form.longitude)
  if (!(lon >= -180 && lon <= 180)) errors.longitude = '-180 ile 180 arasında olmalı.'
  if (!Number.isFinite(num(form.altitude))) errors.altitude = 'Sayı girin.'
  const minEl = num(form.minElevation)
  if (!(minEl >= 0 && minEl < 90)) errors.minElevation = '0 ile 89 arasında olmalı.'
  const setup = num(form.setupInterval)
  if (!(setup >= 0 && Number.isInteger(setup))) errors.setupInterval = 'Pozitif tam sayı (saniye).'
  const start = fromDatetimeLocal(form.startAt)
  const end = fromDatetimeLocal(form.endAt)
  if (!start) errors.startAt = 'Başlangıç gerekli.'
  if (!end) errors.endAt = 'Bitiş gerekli.'
  if (start && end && end <= start) errors.endAt = 'Bitiş başlangıçtan sonra olmalı.'
  if (start && end && end.getTime() - start.getTime() > 7 * 86_400_000) errors.endAt = 'Pencere en fazla 7 gün olabilir.'
  if (entries.length === 0) errors.tle = 'En az bir uydu ekleyin.'
  else if (entries.some((e) => validateTle(e.line1, e.line2) || !e.satelliteName.trim())) errors.tle = 'Hatalı TLE kayıtlarını düzeltin.'
  return errors
}

interface TleConfigModalProps {
  onClose: () => void
  current: TleResponse | null | undefined
  onPassesComputed: (passes: SatellitePassFromTle[], context: { satellites: TrackedSatellite[]; station: GroundStation }) => void
}

export function TleConfigModal({ open, ...props }: TleConfigModalProps & { open: boolean }) {
  return open ? <TleConfigModalContent {...props} /> : null
}

function TleConfigModalContent({ onClose, current, onPassesComputed }: TleConfigModalProps) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<FormState>(() => initialForm(current))
  const [entries, setEntries] = useState<TleData[]>(() => current?.tleData?.map((e) => ({ ...e })) ?? [])
  const [submitted, setSubmitted] = useState(false)
  const [query, setQuery] = useState('')
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')

  const errors = useMemo(() => validate(form, entries), [form, entries])
  const shownErrors = submitted ? errors : {}
  const set = (key: keyof FormState) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const search = useMutation({
    mutationFn: (name: string) => tleApi.search(name),
    onError: (err) => toast.error('TLE araması başarısız', { description: errorMessage(err) }),
  })

  const save = useMutation({
    mutationFn: () => {
      const n = (v: string) => Number(v.replace(',', '.'))
      return tleApi.save({
        name: form.name.trim(),
        latitude: n(form.latitude),
        longitude: n(form.longitude),
        altitude: n(form.altitude),
        minElevation: n(form.minElevation),
        setupInterval: n(form.setupInterval),
        startAt: toApiDate(fromDatetimeLocal(form.startAt)!),
        endAt: toApiDate(fromDatetimeLocal(form.endAt)!),
        tleData: entries.map((e) => ({ satelliteName: e.satelliteName.trim(), line1: e.line1.trim(), line2: e.line2.trim() })),
      })
    },
    onSuccess: (passes) => {
      queryClient.invalidateQueries({ queryKey: ['tle'] })
      queryClient.invalidateQueries({ queryKey: ['tle-passes'] })
      toast.success('TLE yapılandırması kaydedildi', { description: `${passes?.length ?? 0} geçiş hesaplandı.` })
      const n = (v: string) => Number(v.replace(',', '.'))
      onPassesComputed(passes ?? [], {
        satellites: buildSatellites(entries),
        station: {
          name: form.name.trim(),
          lat: n(form.latitude),
          lon: n(form.longitude),
          altM: n(form.altitude),
          minElevation: n(form.minElevation),
          setupInterval: n(form.setupInterval),
        },
      })
    },
    onError: (err) => toast.error('Kaydedilemedi', { description: errorMessage(err) }),
  })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (Object.keys(errors).length === 0) save.mutate()
  }

  const addEntries = (items: TleData[]) => {
    setEntries((prev) => {
      const seen = new Set(prev.map((p) => p.line1.trim()))
      const fresh = items.filter((i) => !seen.has(i.line1.trim()))
      if (fresh.length < items.length) toast.info(`${items.length - fresh.length} kayıt zaten listede`)
      return [...prev, ...fresh]
    })
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      icon={<Settings2 className="size-4" />}
      title="TLE yapılandırması"
      description="Yer istasyonu konumu, hesaplama penceresi ve takip edilecek uydular. Kaydetmek mevcut yapılandırmanın yerine geçer."
      dismissible={!save.isPending}
      footer={
        <>
          {submitted && Object.keys(errors).length > 0 && (
            <span className="mr-auto inline-flex items-center gap-1.5 text-xs text-rose-300">
              <TriangleAlert className="size-3.5" /> Formdaki hataları düzeltin
            </span>
          )}
          <Button variant="ghost" onClick={onClose} disabled={save.isPending}>
            Vazgeç
          </Button>
          <Button variant="primary" type="submit" form="tle-form" loading={save.isPending}>
            Kaydet ve geçişleri hesapla
          </Button>
        </>
      }
    >
      <form id="tle-form" onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]" noValidate>
        <div className="space-y-4">
          <div className="label-caps flex items-center gap-2">
            <Globe2 className="size-3.5" /> Yer istasyonu
          </div>
          <Field label="İstasyon adı" required error={shownErrors.name}>
            {(id) => <Input id={id} value={form.name} onChange={set('name')} />}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Enlem (°)" required error={shownErrors.latitude}>
              {(id) => <Input id={id} inputMode="decimal" value={form.latitude} onChange={set('latitude')} className="num" />}
            </Field>
            <Field label="Boylam (°)" required error={shownErrors.longitude}>
              {(id) => <Input id={id} inputMode="decimal" value={form.longitude} onChange={set('longitude')} className="num" />}
            </Field>
            <Field label="Rakım (m)" error={shownErrors.altitude}>
              {(id) => <Input id={id} inputMode="decimal" value={form.altitude} onChange={set('altitude')} className="num" />}
            </Field>
            <Field label="Min. elevasyon (°)" error={shownErrors.minElevation}>
              {(id) => <Input id={id} inputMode="decimal" value={form.minElevation} onChange={set('minElevation')} className="num" />}
            </Field>
          </div>
          <Field label="Hazırlık süresi (sn)" hint="AOS’tan önce antenin konumlanması için ayrılan süre." error={shownErrors.setupInterval}>
            {(id) => <Input id={id} inputMode="numeric" value={form.setupInterval} onChange={set('setupInterval')} className="num" />}
          </Field>
          <div className="label-caps pt-2">Hesaplama penceresi</div>
          <Field label="Başlangıç" error={shownErrors.startAt}>
            {(id) => <Input id={id} type="datetime-local" value={form.startAt} onChange={set('startAt')} />}
          </Field>
          <Field label="Bitiş" error={shownErrors.endAt}>
            {(id) => <Input id={id} type="datetime-local" value={form.endAt} onChange={set('endAt')} />}
          </Field>
        </div>

        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="label-caps">Uydular ({entries.length})</div>
            <div className="flex gap-2">
              <Button size="xs" variant="outline" icon={<ClipboardPaste className="size-3.5" />} onClick={() => setPasteOpen((v) => !v)}>
                TLE yapıştır
              </Button>
              <Button
                size="xs"
                variant="outline"
                icon={<Plus className="size-3.5" />}
                onClick={() => setEntries((prev) => [...prev, { satelliteName: '', line1: '', line2: '' }])}
              >
                Boş satır
              </Button>
            </div>
          </div>

          <div className="rounded-xl bg-ink-900/60 p-3 ring-1 ring-white/8">
            <div className="flex gap-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    if (query.trim()) search.mutate(query.trim())
                  }
                }}
                placeholder="Uydu adıyla güncel TLE ara (ör. ISS, NOAA 19, GOKTURK)"
                leading={<Search className="size-4" />}
              />
              <Button onClick={() => query.trim() && search.mutate(query.trim())} loading={search.isPending}>
                Ara
              </Button>
            </div>
            {search.data && (
              <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                {search.data.length === 0 && <li className="px-1 py-2 text-xs text-ink-400">Sonuç bulunamadı.</li>}
                {search.data.map((r) => {
                  const added = entries.some((e) => e.line1.trim() === r.line1.trim())
                  return (
                    <li key={r.line1} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-white/[0.04]">
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-medium text-ink-100">{r.satelliteName}</div>
                        <div className="num truncate text-[10.5px] whitespace-pre text-ink-500">{r.line1}</div>
                      </div>
                      <Button
                        size="xs"
                        variant={added ? 'ghost' : 'success'}
                        disabled={added}
                        icon={added ? <CheckCircle2 className="size-3.5" /> : <Plus className="size-3.5" />}
                        onClick={() => addEntries([{ satelliteName: r.satelliteName, line1: r.line1, line2: r.line2 }])}
                      >
                        {added ? 'Ekli' : 'Ekle'}
                      </Button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {pasteOpen && (
            <div className="space-y-2 rounded-xl bg-ink-900/60 p-3 ring-1 ring-white/8">
              <Textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={'ISS (ZARYA)\n1 25544U 98067A   ...\n2 25544  51.6400 ...'}
                className="num min-h-28 text-[11.5px]"
              />
              <div className="flex justify-end gap-2">
                <Button size="xs" variant="ghost" onClick={() => setPasteOpen(false)}>
                  Kapat
                </Button>
                <Button
                  size="xs"
                  variant="primary"
                  onClick={() => {
                    const parsed = parseTleText(pasteText)
                    if (parsed.length === 0) {
                      toast.error('Metinde TLE bulunamadı')
                      return
                    }
                    addEntries(parsed)
                    toast.success(`${parsed.length} uydu eklendi`)
                    setPasteText('')
                    setPasteOpen(false)
                  }}
                >
                  Ayrıştır ve ekle
                </Button>
              </div>
            </div>
          )}

          {shownErrors.tle && <p className="text-xs text-rose-300">{shownErrors.tle}</p>}

          <div className="space-y-2">
            {entries.length === 0 && (
              <p className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-ink-400">
                Henüz uydu yok. Yukarıdan arayın ya da TLE metni yapıştırın.
              </p>
            )}
            {entries.map((entry, i) => {
              const problem = entry.line1 || entry.line2 ? validateTle(entry.line1, entry.line2) : 'TLE satırları boş.'
              return (
                <div
                  key={i}
                  className={cn('rounded-xl bg-ink-900/40 p-3 ring-1', problem ? 'ring-rose-400/30' : 'ring-white/8')}
                >
                  <div className="flex items-center gap-2">
                    <Input
                      value={entry.satelliteName}
                      onChange={(e) =>
                        setEntries((prev) => prev.map((p, j) => (j === i ? { ...p, satelliteName: e.target.value } : p)))
                      }
                      placeholder="Uydu adı"
                      className="h-8 font-medium"
                    />
                    {problem ? (
                      <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-rose-300">
                        <TriangleAlert className="size-3.5" />
                      </span>
                    ) : (
                      <CheckCircle2 className="size-4 shrink-0 text-emerald-300" />
                    )}
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => setEntries((prev) => prev.filter((_, j) => j !== i))}
                      aria-label="Kaldır"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                  {(['line1', 'line2'] as const).map((key) => (
                    <input
                      key={key}
                      value={entry[key]}
                      onChange={(e) =>
                        setEntries((prev) => prev.map((p, j) => (j === i ? { ...p, [key]: e.target.value } : p)))
                      }
                      spellCheck={false}
                      placeholder={key === 'line1' ? '1 NNNNNU ...' : '2 NNNNN ...'}
                      className="num mt-1.5 h-7 w-full rounded-md bg-ink-950/60 px-2 text-[11px] text-ink-200 ring-1 ring-white/6 outline-none focus:ring-cyan-400/50"
                    />
                  ))}
                  {problem && (entry.line1 || entry.line2) && <p className="mt-1.5 text-[11px] text-rose-300">{problem}</p>}
                </div>
              )
            })}
          </div>
        </div>
      </form>
    </Modal>
  )
}
