import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, UserPlus, UserRoundPen } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { errorMessage } from '../../api/http'
import { EMPTY_GUID, type UserResponse } from '../../api/types'
import { userApi } from '../../api/user'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Form'
import { Modal } from '../../components/ui/Modal'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Errors = Partial<Record<'name' | 'surname' | 'userName' | 'email' | 'password' | 'roleId', string>>

export function UserModal({ open, ...props }: { open: boolean; onClose: () => void; user: UserResponse | null }) {
  return open ? <UserModalContent key={props.user?.id ?? 'new'} {...props} /> : null
}

function UserModalContent({ onClose, user }: { onClose: () => void; user: UserResponse | null }) {
  const queryClient = useQueryClient()
  const editing = user !== null
  const [form, setForm] = useState(() => ({
    name: user?.name ?? '',
    surname: user?.surname ?? '',
    userName: user?.userName ?? '',
    email: user?.email ?? '',
    password: '',
    roleId: user && user.roleId !== EMPTY_GUID ? user.roleId : '',
  }))
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<Errors>({})

  const mutation = useMutation({
    mutationFn: () => {
      const model = {
        name: form.name.trim(),
        surname: form.surname.trim(),
        userName: form.userName.trim(),
        email: form.email.trim(),
        roleId: form.roleId.trim() || EMPTY_GUID,
      }
      if (editing) {
        // UpdateUser tüm kaydı yazar: şifre değişmiyorsa mevcut hash'i geri gönder.
        return userApi.update({ id: user.id, ...model, password: form.password || user.password || '' })
      }
      return userApi.add({ ...model, password: form.password })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success(editing ? 'Kullanıcı güncellendi' : 'Kullanıcı eklendi')
      onClose()
    },
    onError: (err) => toast.error(editing ? 'Güncellenemedi' : 'Eklenemedi', { description: errorMessage(err) }),
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const next: Errors = {}
    if (!form.name.trim()) next.name = 'Ad gerekli.'
    if (!form.userName.trim()) next.userName = 'Kullanıcı adı gerekli.'
    if (!emailPattern.test(form.email.trim())) next.email = 'Geçerli bir e-posta girin.'
    if (!editing && form.password.length < 6) next.password = 'En az 6 karakter.'
    if (editing && form.password && form.password.length < 6) next.password = 'En az 6 karakter.'
    if (form.roleId.trim() && !guidPattern.test(form.roleId.trim())) next.roleId = 'GUID biçiminde olmalı.'
    setErrors(next)
    if (Object.keys(next).length === 0) mutation.mutate()
  }

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }))

  return (
    <Modal
      open
      onClose={onClose}
      icon={editing ? <UserRoundPen className="size-4" /> : <UserPlus className="size-4" />}
      title={editing ? 'Kullanıcıyı düzenle' : 'Yeni kullanıcı'}
      dismissible={!mutation.isPending}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Vazgeç
          </Button>
          <Button variant="primary" type="submit" form="user-form" loading={mutation.isPending}>
            {editing ? 'Kaydet' : 'Ekle'}
          </Button>
        </>
      }
    >
      <form id="user-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label="Ad" required error={errors.name}>
          {(id) => <Input id={id} value={form.name} onChange={set('name')} autoFocus />}
        </Field>
        <Field label="Soyad" error={errors.surname}>
          {(id) => <Input id={id} value={form.surname} onChange={set('surname')} />}
        </Field>
        <Field label="Kullanıcı adı" required error={errors.userName}>
          {(id) => <Input id={id} value={form.userName} onChange={set('userName')} autoComplete="off" />}
        </Field>
        <Field label="E-posta" required error={errors.email}>
          {(id) => <Input id={id} type="email" value={form.email} onChange={set('email')} />}
        </Field>
        <Field
          label={editing ? 'Yeni şifre' : 'Şifre'}
          required={!editing}
          hint={editing ? 'Değiştirmeyecekseniz boş bırakın.' : 'En az 6 karakter.'}
          error={errors.password}
        >
          {(id) => (
            <div className="relative">
              <Input id={id} type={showPassword ? 'text' : 'password'} value={form.password} onChange={set('password')} autoComplete="new-password" className="pr-10" />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-1 text-ink-400 hover:text-ink-200"
                aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          )}
        </Field>
        <Field label="Rol kimliği" hint="Rol tanımları henüz backend’de yok; GUID olarak saklanır." error={errors.roleId}>
          {(id) => <Input id={id} value={form.roleId} onChange={set('roleId')} placeholder={EMPTY_GUID} className="num text-[12px]" />}
        </Field>
      </form>
    </Modal>
  )
}
