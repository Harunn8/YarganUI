import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Cpu, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { deviceApi } from '../../api/device'
import { errorMessage } from '../../api/http'
import { CommunicationType, type DeviceResponse, type PagResponse, type QueryModel } from '../../api/types'
import { Button } from '../../components/ui/Button'
import { Field, Input, Segmented, Select } from '../../components/ui/Form'
import { Modal } from '../../components/ui/Modal'
import { buildCommunicationData, parseCommunication, queriesOf } from './communication'

type Protocol = 'snmp' | 'tcp'

interface FormState {
  protocol: Protocol
  name: string
  pagId: string
  version: string
  versionNote: string
  snmpVersion: number
  readCommunity: string
  writeCommunity: string
  queries: QueryModel[]
}

const newQuery = (): QueryModel => ({ query: '', parameterName: '', parameterId: crypto.randomUUID() })

function initial(device: DeviceResponse | null, pags: PagResponse[]): FormState {
  if (!device) {
    return {
      protocol: 'snmp',
      name: '',
      pagId: pags[0]?.id ?? '',
      version: '',
      versionNote: '',
      snmpVersion: 2,
      readCommunity: 'public',
      writeCommunity: '',
      queries: [newQuery()],
    }
  }
  const data = parseCommunication(device)
  return {
    protocol: device.communicationType === CommunicationType.SNMP ? 'snmp' : 'tcp',
    name: device.name,
    pagId: device.pagId,
    version: data.Version ?? '',
    versionNote: data.VersionNote ?? '',
    snmpVersion: data.SNMPVersion ?? 2,
    readCommunity: data.ReadCommunity ?? '',
    writeCommunity: data.WriteCommunity ?? '',
    queries: queriesOf(device).length ? queriesOf(device) : [newQuery()],
  }
}

interface DeviceModalProps {
  onClose: () => void
  device: DeviceResponse | null
  pags: PagResponse[]
}

export function DeviceModal({ open, ...props }: DeviceModalProps & { open: boolean }) {
  // İçerik her açılışta yeniden kurulur; form durumu böylece kendiliğinden sıfırlanır.
  return open ? <DeviceModalContent key={props.device?.id ?? 'new'} {...props} /> : null
}

function DeviceModalContent({ onClose, device, pags }: DeviceModalProps) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<FormState>(() => initial(device, pags))
  const [error, setError] = useState<string | null>(null)
  const editing = device !== null
  const pagId = form.pagId || pags[0]?.id || ''

  const mutation = useMutation({
    mutationFn: async () => {
      const queries = form.queries
        .filter((q) => q.query.trim() || q.parameterName.trim())
        .map((q) => ({ ...q, query: q.query.trim(), parameterName: q.parameterName.trim() }))
      const version = form.version.trim() || null
      const versionNote = form.versionNote.trim() || null
      if (editing) {
        return deviceApi.update({
          id: device.id,
          name: form.name.trim(),
          pagId,
          communicationType: form.protocol === 'snmp' ? CommunicationType.SNMP : CommunicationType.TCP,
          version,
          versionNote,
          communicationData: buildCommunicationData({
            name: form.name.trim(),
            pagId,
            protocol: form.protocol,
            snmpVersion: form.snmpVersion,
            readCommunity: form.readCommunity.trim(),
            writeCommunity: form.writeCommunity.trim() || null,
            version,
            versionNote,
            queries,
          }),
        })
      }
      if (form.protocol === 'snmp') {
        return deviceApi.addSnmp({
          name: form.name.trim(),
          pagId,
          snmpVersion: form.snmpVersion as 1 | 2 | 3,
          readCommunity: form.readCommunity.trim(),
          writeCommunity: form.writeCommunity.trim() || null,
          version,
          versionNote,
          queries,
        })
      }
      return deviceApi.addTcp({ name: form.name.trim(), pagId, queries, version, versionNote })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] })
      queryClient.invalidateQueries({ queryKey: ['pags'] })
      toast.success(editing ? 'Cihaz tanımı güncellendi' : 'Cihaz tanımı eklendi')
      onClose()
    },
    onError: (err) => toast.error(editing ? 'Güncellenemedi' : 'Eklenemedi', { description: errorMessage(err) }),
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return setError('Cihaz adı gerekli.')
    if (!pagId) return setError('Bir PAG seçin.')
    if (form.protocol === 'snmp' && !form.readCommunity.trim()) return setError('SNMP read community gerekli.')
    setError(null)
    mutation.mutate()
  }

  const setQuery = (index: number, patch: Partial<QueryModel>) =>
    setForm((f) => ({ ...f, queries: f.queries.map((q, i) => (i === index ? { ...q, ...patch } : q)) }))

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      icon={<Cpu className="size-4" />}
      title={editing ? 'Cihaz tanımını düzenle' : 'Yeni cihaz tanımı'}
      description="Cihaz tipi, haberleşme protokolü ve izlenecek parametreler."
      dismissible={!mutation.isPending}
      footer={
        <>
          {error && <span className="mr-auto text-xs text-rose-300">{error}</span>}
          <Button variant="ghost" onClick={onClose}>
            Vazgeç
          </Button>
          <Button variant="primary" type="submit" form="device-form" loading={mutation.isPending}>
            {editing ? 'Kaydet' : 'Ekle'}
          </Button>
        </>
      }
    >
      <form id="device-form" onSubmit={submit} className="space-y-5" noValidate>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] font-medium text-ink-200">Protokol</span>
          <Segmented
            value={form.protocol}
            onChange={(protocol) => !editing && setForm((f) => ({ ...f, protocol }))}
            options={[
              { value: 'snmp', label: 'SNMP' },
              { value: 'tcp', label: 'TCP' },
            ]}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Cihaz adı" required>
            {(id) => <Input id={id} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="ACU-7 Anten Kontrol Ünitesi" />}
          </Field>
          <Field label="PAG" required>
            {(id) => (
              <Select id={id} value={pagId} onChange={(e) => setForm((f) => ({ ...f, pagId: e.target.value }))}>
                {pags.length === 0 && <option value="">Önce bir PAG oluşturun</option>}
                {pags.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Sürüm">
            {(id) => <Input id={id} value={form.version} onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))} placeholder="1.0" />}
          </Field>
          <Field label="Sürüm notu">
            {(id) => <Input id={id} value={form.versionNote} onChange={(e) => setForm((f) => ({ ...f, versionNote: e.target.value }))} />}
          </Field>
        </div>

        {form.protocol === 'snmp' && (
          <div className="grid gap-4 rounded-xl bg-ink-900/50 p-4 ring-1 ring-white/8 sm:grid-cols-3">
            <Field label="SNMP sürümü">
              {(id) => (
                <Select id={id} value={form.snmpVersion} onChange={(e) => setForm((f) => ({ ...f, snmpVersion: Number(e.target.value) }))}>
                  <option value={1}>v1</option>
                  <option value={2}>v2c</option>
                  <option value={3}>v3</option>
                </Select>
              )}
            </Field>
            <Field label="Read community" required>
              {(id) => <Input id={id} value={form.readCommunity} onChange={(e) => setForm((f) => ({ ...f, readCommunity: e.target.value }))} />}
            </Field>
            <Field label="Write community">
              {(id) => <Input id={id} value={form.writeCommunity} onChange={(e) => setForm((f) => ({ ...f, writeCommunity: e.target.value }))} />}
            </Field>
          </div>
        )}

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[13px] font-medium text-ink-200">
              İzlenecek parametreler{' '}
              <span className="text-ink-500">({form.protocol === 'snmp' ? 'OID' : 'komut'})</span>
            </span>
            <Button size="xs" variant="outline" icon={<Plus className="size-3.5" />} onClick={() => setForm((f) => ({ ...f, queries: [...f.queries, newQuery()] }))}>
              Parametre
            </Button>
          </div>
          <div className="space-y-2">
            {form.queries.map((q, i) => (
              <div key={q.parameterId} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] gap-2">
                <Input value={q.parameterName} onChange={(e) => setQuery(i, { parameterName: e.target.value })} placeholder="Parametre adı" className="h-9" />
                <Input
                  value={q.query}
                  onChange={(e) => setQuery(i, { query: e.target.value })}
                  placeholder={form.protocol === 'snmp' ? '1.3.6.1.4.1.…' : ':MEAS:POW?'}
                  className="num h-9 text-[12.5px]"
                  spellCheck={false}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setForm((f) => ({ ...f, queries: f.queries.filter((_, j) => j !== i) }))}
                  aria-label="Parametreyi kaldır"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  )
}
