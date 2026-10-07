import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Boxes, Server } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { pagApi, pagDeviceApi } from '../../api/device'
import { errorMessage } from '../../api/http'
import type { DeviceResponse, PagDeviceResponse, PagResponse } from '../../api/types'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select, Switch } from '../../components/ui/Form'
import { Modal } from '../../components/ui/Modal'

export function PagModal({ open, ...props }: { open: boolean; onClose: () => void; pag: PagResponse | null }) {
  return open ? <PagModalContent key={props.pag?.id ?? 'new'} {...props} /> : null
}

function PagModalContent({ onClose, pag }: { onClose: () => void; pag: PagResponse | null }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(pag?.name ?? '')
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => (pag ? pagApi.update({ id: pag.id, name: name.trim() }) : pagApi.add({ name: name.trim() })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pags'] })
      toast.success(pag ? 'PAG güncellendi' : 'PAG oluşturuldu')
      onClose()
    },
    onError: (err) => toast.error('İşlem başarısız', { description: errorMessage(err) }),
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return setError('PAG adı gerekli.')
    mutation.mutate()
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      icon={<Boxes className="size-4" />}
      title={pag ? 'PAG’i yeniden adlandır' : 'Yeni PAG'}
      description="PAG, cihazları işlevine göre gruplar (ör. Anten Sistemi, RF Zinciri)."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Vazgeç
          </Button>
          <Button variant="primary" type="submit" form="pag-form" loading={mutation.isPending}>
            Kaydet
          </Button>
        </>
      }
    >
      <form id="pag-form" onSubmit={submit} noValidate>
        <Field label="PAG adı" required error={error}>
          {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Anten Sistemi" />}
        </Field>
      </form>
    </Modal>
  )
}

const hostPattern = /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$|^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/

interface PagDeviceModalProps {
  onClose: () => void
  pagDevice: (PagDeviceResponse & { active?: boolean }) | null
  devices: DeviceResponse[]
  pags: PagResponse[]
}

export function PagDeviceModal({ open, ...props }: PagDeviceModalProps & { open: boolean }) {
  return open ? <PagDeviceModalContent key={props.pagDevice?.id ?? 'new'} {...props} /> : null
}

function PagDeviceModalContent({ onClose, pagDevice, devices, pags }: PagDeviceModalProps) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState(() =>
    pagDevice
      ? {
          name: pagDevice.name,
          deviceId: pagDevice.deviceId,
          pagId: pagDevice.pagId,
          ipAddress: pagDevice.ipAddress,
          port: String(pagDevice.port),
          timeout: String(pagDevice.timeout),
          inMaintenance: pagDevice.active === undefined ? Boolean(pagDevice.inMaitenance) : !pagDevice.active,
        }
      : { name: '', deviceId: '', pagId: '', ipAddress: '', port: '161', timeout: '2000', inMaintenance: false },
  )
  const [error, setError] = useState<string | null>(null)
  // Listeler modal açıldıktan sonra yüklenebilir; boş seçimlerde ilk kaydı varsay.
  const deviceId = form.deviceId || devices[0]?.id || ''
  const pagId = form.pagId || devices.find((d) => d.id === deviceId)?.pagId || pags[0]?.id || ''

  const mutation = useMutation({
    mutationFn: () => {
      const model = {
        name: form.name.trim(),
        deviceId,
        pagId,
        ipAddress: form.ipAddress.trim(),
        port: Number(form.port),
        timeOut: Number(form.timeout),
        inMaintenance: form.inMaintenance,
      }
      return pagDevice ? pagDeviceApi.update({ id: pagDevice.id, ...model }) : pagDeviceApi.add(model)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pagDevices'] })
      toast.success(pagDevice ? 'PAG cihazı güncellendi' : 'PAG cihazı eklendi')
      onClose()
    },
    onError: (err) => toast.error('İşlem başarısız', { description: errorMessage(err) }),
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const port = Number(form.port)
    if (!form.name.trim()) return setError('Ad gerekli.')
    if (!deviceId) return setError('Bir cihaz tanımı seçin.')
    if (!pagId) return setError('Bir PAG seçin.')
    if (!hostPattern.test(form.ipAddress.trim())) return setError('Geçerli bir IP adresi ya da ana bilgisayar adı girin.')
    if (!Number.isInteger(port) || port < 1 || port > 65535) return setError('Port 1–65535 arasında olmalı.')
    if (!(Number(form.timeout) > 0)) return setError('Zaman aşımı pozitif olmalı.')
    setError(null)
    mutation.mutate()
  }

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }))

  return (
    <Modal
      open
      onClose={onClose}
      icon={<Server className="size-4" />}
      title={pagDevice ? 'PAG cihazını düzenle' : 'Yeni PAG cihazı'}
      description="Sahadaki fiziksel cihaz: hangi tanıma ait olduğu ve ağ adresi."
      dismissible={!mutation.isPending}
      footer={
        <>
          {error && <span className="mr-auto text-xs text-rose-300">{error}</span>}
          <Button variant="ghost" onClick={onClose}>
            Vazgeç
          </Button>
          <Button variant="primary" type="submit" form="pagdevice-form" loading={mutation.isPending}>
            Kaydet
          </Button>
        </>
      }
    >
      <form id="pagdevice-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label="Ad" required className="sm:col-span-2">
          {(id) => <Input id={id} value={form.name} onChange={set('name')} placeholder="ACU-01" autoFocus />}
        </Field>
        <Field label="Cihaz tanımı" required>
          {(id) => (
            <Select
              id={id}
              value={deviceId}
              onChange={(e) => {
                const device = devices.find((d) => d.id === e.target.value)
                setForm((f) => ({ ...f, deviceId: e.target.value, pagId: device?.pagId ?? f.pagId }))
              }}
            >
              {devices.length === 0 && <option value="">Önce cihaz tanımı ekleyin</option>}
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="PAG" required>
          {(id) => (
            <Select id={id} value={pagId} onChange={set('pagId')}>
              {pags.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="IP adresi" required>
          {(id) => <Input id={id} value={form.ipAddress} onChange={set('ipAddress')} placeholder="10.20.1.11" className="num" />}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Port" required>
            {(id) => <Input id={id} inputMode="numeric" value={form.port} onChange={set('port')} className="num" />}
          </Field>
          <Field label="Zaman aşımı (ms)">
            {(id) => <Input id={id} inputMode="numeric" value={form.timeout} onChange={set('timeout')} className="num" />}
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Switch
            checked={form.inMaintenance}
            onChange={(inMaintenance) => setForm((f) => ({ ...f, inMaintenance }))}
            label="Bakımda"
            description="Bakımdaki cihazlarla DCM haberleşme kurmaz."
          />
        </div>
      </form>
    </Modal>
  )
}
