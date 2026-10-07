import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Mail, Pencil, Search, Trash2, UserPlus, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { errorMessage } from '../api/http'
import { EMPTY_GUID, type UserResponse } from '../api/types'
import { userApi } from '../api/user'
import { useAuth } from '../auth/AuthContext'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { useConfirm } from '../components/ui/Confirm'
import { Input } from '../components/ui/Form'
import { PageHeader } from '../components/ui/PageHeader'
import { EmptyState, ErrorState, TableSkeleton } from '../components/ui/States'
import { Table, TD, TH, THead, TR } from '../components/ui/Table'
import { UserModal } from '../features/users/UserModal'
import { shortId } from '../lib/format'

const avatarGradients = [
  'from-cyan-400 to-sky-600',
  'from-violet-400 to-fuchsia-600',
  'from-emerald-400 to-teal-600',
  'from-amber-300 to-orange-500',
  'from-rose-400 to-pink-600',
]

function hashIndex(value: string, size: number) {
  let h = 0
  for (const ch of value) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h % size
}

export default function UsersPage() {
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const { userName: currentUser } = useAuth()
  const users = useQuery({ queryKey: ['users'], queryFn: userApi.getAll })
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<UserResponse | null>(null)
  const [open, setOpen] = useState(false)

  const rows = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr-TR')
    return (users.data ?? [])
      .filter((u) => !q || [u.name, u.surname, u.userName, u.email].some((v) => v?.toLocaleLowerCase('tr-TR').includes(q)))
      .sort((a, b) => `${a.name} ${a.surname}`.localeCompare(`${b.name} ${b.surname}`, 'tr'))
  }, [users.data, search])

  const roles = useMemo(() => {
    const ids = [...new Set((users.data ?? []).map((u) => u.roleId).filter((r) => r && r !== EMPTY_GUID))]
    return new Map(ids.map((id, i) => [id, `Rol ${String.fromCharCode(65 + i)}`]))
  }, [users.data])

  const remove = useMutation({
    mutationFn: (id: string) => userApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('Kullanıcı silindi')
    },
    onError: (err) => toast.error('Silinemedi', { description: errorMessage(err) }),
  })

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="User API"
        title="Kullanıcılar"
        description="Arayüze ve API’lere erişebilecek operatör hesapları."
        actions={
          <Button
            variant="primary"
            icon={<UserPlus className="size-4" />}
            onClick={() => {
              setEditing(null)
              setOpen(true)
            }}
          >
            Yeni kullanıcı
          </Button>
        }
      />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="w-full max-w-sm">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ad, kullanıcı adı ya da e-posta ara" leading={<Search className="size-4" />} className="h-9" />
          </div>
          <span className="text-xs text-ink-400">{rows.length} kullanıcı</span>
        </div>

        {users.isLoading ? (
          <TableSkeleton />
        ) : users.isError ? (
          <ErrorState error={users.error} onRetry={() => users.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState icon={<Users className="size-6" />} title="Kullanıcı bulunamadı" description={search ? 'Aramayı değiştirin.' : 'İlk kullanıcıyı ekleyin.'} />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Kullanıcı</TH>
                <TH>Kullanıcı adı</TH>
                <TH>E-posta</TH>
                <TH>Rol</TH>
                <TH className="text-right">İşlemler</TH>
              </tr>
            </THead>
            <tbody>
              {rows.map((u) => {
                const initials = `${u.name?.[0] ?? ''}${u.surname?.[0] ?? ''}`.toLocaleUpperCase('tr-TR') || u.userName[0]?.toUpperCase()
                const isMe = u.userName === currentUser
                return (
                  <TR key={u.id}>
                    <TD>
                      <div className="flex items-center gap-3">
                        <div className={`grid size-9 place-items-center rounded-xl bg-gradient-to-br text-xs font-bold text-ink-950 ${avatarGradients[hashIndex(u.userName, avatarGradients.length)]}`}>
                          {initials}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 font-medium text-ink-100">
                            {u.name} {u.surname}
                            {isMe && <Badge tone="cyan">Siz</Badge>}
                          </div>
                          <div className="num text-[11px] text-ink-500">#{shortId(u.id)}</div>
                        </div>
                      </div>
                    </TD>
                    <TD className="num text-[13px]">{u.userName}</TD>
                    <TD>
                      <a href={`mailto:${u.email}`} className="inline-flex items-center gap-1.5 text-[13px] text-ink-300 hover:text-cyan-200">
                        <Mail className="size-3.5" />
                        {u.email}
                      </a>
                    </TD>
                    <TD>
                      {u.roleId && u.roleId !== EMPTY_GUID ? (
                        <Badge tone="violet">
                          <span title={u.roleId}>{roles.get(u.roleId)}</span>
                        </Badge>
                      ) : (
                        <Badge>Atanmamış</Badge>
                      )}
                    </TD>
                    <TD>
                      <div className="flex justify-end gap-1 opacity-70 transition group-hover:opacity-100">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => {
                            setEditing(u)
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
                          disabled={isMe}
                          title={isMe ? 'Kendi hesabınızı silemezsiniz' : undefined}
                          onClick={async () => {
                            if (await confirm({ title: `${u.name} ${u.surname} silinsin mi?`, description: 'Kullanıcı arayüze ve API’lere erişemez.', confirmLabel: 'Sil' })) remove.mutate(u.id)
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
      </Card>

      <UserModal open={open} onClose={() => setOpen(false)} user={editing} />
    </div>
  )
}
