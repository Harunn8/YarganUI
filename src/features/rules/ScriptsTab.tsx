import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FileCode2, Play, Plus, Save, Search, Trash2 } from 'lucide-react'
import { lazy, Suspense, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { errorMessage } from '../../api/http'
import { policyScriptApi } from '../../api/rule'
import type { CronPolicyResponse, PolicyScriptResponse } from '../../api/types'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { useConfirm } from '../../components/ui/Confirm'
import { Input } from '../../components/ui/Form'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/States'
import { cn } from '../../lib/cn'
import { formatRelative, parseApiDate } from '../../lib/format'
import { useNow } from '../../lib/useNow'

const ScriptEditor = lazy(() => import('./ScriptEditor'))

const TEMPLATE = `// Yeni politika scripti
// Kullanılabilir fonksiyonlar: SendMqttMessage(topic, payload), WriteLogToConsole(message), GetData(key)

var value = GetData("PARAMETRE");
if (value == null)
{
    WriteLogToConsole("Parametre okunamadı.");
}
`

const NEW_ID = '__new__'

export function ScriptsTab({
  scripts,
  cronPolicies,
  loading,
  error,
  onRetry,
}: {
  scripts: PolicyScriptResponse[]
  cronPolicies: CronPolicyResponse[]
  loading: boolean
  error: unknown
  onRetry: () => void
}) {
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const now = useNow(60_000)
  const [search, setSearch] = useState('')
  const [chosenId, setChosenId] = useState<string | null>(null)
  /** Kaydedilmemiş düzenlemeler, script kimliğine göre. */
  const [drafts, setDrafts] = useState<Record<string, { name: string; code: string }>>({})

  // Seçim yoksa (ya da seçilen silindiyse) ilk script açılır.
  const selectedId =
    chosenId === NEW_ID || scripts.some((s) => s.id === chosenId) ? chosenId : (scripts[0]?.id ?? null)
  const selected = scripts.find((s) => s.id === selectedId) ?? null
  const isNew = selectedId === NEW_ID
  const saved = isNew ? { name: '', code: TEMPLATE } : selected ? { name: selected.name, code: selected.script } : null
  const current = (selectedId && drafts[selectedId]) || saved
  const name = current?.name ?? ''
  const code = current?.code ?? ''
  const dirty = Boolean(saved && current && (current.name !== saved.name || current.code !== saved.code))

  const edit = (patch: Partial<{ name: string; code: string }>) => {
    if (!selectedId || !current) return
    setDrafts((d) => ({ ...d, [selectedId]: { ...current, ...patch } }))
  }
  const setName = (value: string) => edit({ name: value })
  const setCode = (value: string) => edit({ code: value })
  const discard = (id: string | null) => {
    if (!id) return
    setDrafts(({ [id]: _removed, ...rest }) => rest)
  }

  const usage = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of cronPolicies) map.set(c.policyScriptId, (map.get(c.policyScriptId) ?? 0) + 1)
    return map
  }, [cronPolicies])

  const filtered = scripts.filter((s) => s.name.toLocaleLowerCase('tr-TR').includes(search.trim().toLocaleLowerCase('tr-TR')))

  const open = async (script: PolicyScriptResponse | null) => {
    if (dirty && !(await confirm({ title: 'Kaydedilmemiş değişiklikler var', description: 'Değişiklikler kaybolacak. Devam edilsin mi?', confirmLabel: 'Devam et' }))) return
    discard(selectedId)
    if (!script) discard(NEW_ID)
    setChosenId(script ? script.id : NEW_ID)
  }

  const save = useMutation({
    mutationFn: () =>
      isNew
        ? policyScriptApi.add({ name: name.trim(), script: code })
        : policyScriptApi.update({ id: selectedId!, name: name.trim(), script: code }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['policyScripts'] })
      queryClient.invalidateQueries({ queryKey: ['cronPolicies'] })
      discard(selectedId)
      if (result?.id) setChosenId(result.id)
      toast.success(isNew ? 'Script oluşturuldu' : 'Script kaydedildi')
    },
    onError: (err) => toast.error('Kaydedilemedi', { description: errorMessage(err) }),
  })

  const run = useMutation({
    mutationFn: (id: string) => policyScriptApi.run(id),
    onSuccess: () => toast.success('Script çalıştırılmak üzere Rule Engine’e gönderildi'),
    onError: (err) => toast.error('Çalıştırılamadı', { description: errorMessage(err) }),
  })

  const remove = useMutation({
    mutationFn: (id: string) => policyScriptApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policyScripts'] })
      discard(selectedId)
      setChosenId(null)
      toast.success('Script silindi')
    },
    onError: (err) => toast.error('Silinemedi', { description: errorMessage(err) }),
  })

  if (loading) {
    return (
      <div className="grid gap-4 px-5 pb-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    )
  }
  if (error) return <ErrorState error={error} onRetry={onRetry} />

  return (
    <div className="grid gap-4 px-5 pb-5 lg:grid-cols-[300px_minmax(0,1fr)]">
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Script ara" leading={<Search className="size-4" />} className="h-9" />
          <Button size="icon" variant="primary" onClick={() => open(null)} aria-label="Yeni script" title="Yeni script">
            <Plus className="size-4" />
          </Button>
        </div>
        <ul className="max-h-[540px] space-y-1 overflow-y-auto">
          {isNew && (
            <li className="rounded-xl bg-cyan-400/10 px-3 py-2.5 ring-1 ring-cyan-400/30">
              <div className="text-[13.5px] font-medium text-cyan-100">{name.trim() || 'Adsız script'}</div>
              <div className="text-[11px] text-cyan-300/70">Yeni · kaydedilmedi</div>
            </li>
          )}
          {filtered.map((s) => {
            const active = s.id === selectedId
            const count = usage.get(s.id) ?? 0
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => !active && open(s)}
                  className={cn(
                    'w-full rounded-xl px-3 py-2.5 text-left transition',
                    active ? 'bg-white/[0.06] ring-1 ring-white/12' : 'hover:bg-white/[0.035]',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <FileCode2 className={cn('size-4 shrink-0', active ? 'text-cyan-300' : 'text-ink-500')} />
                      <span className="truncate text-[13.5px] font-medium text-ink-100">{s.name}</span>
                    </span>
                    {count > 0 && <Badge tone="violet">{count} cron</Badge>}
                  </div>
                  <div className="mt-0.5 pl-6 text-[11px] text-ink-500">
                    {parseApiDate(s.updateDate) ? `Güncellendi ${formatRelative(parseApiDate(s.updateDate)!, now)}` : ''}
                  </div>
                </button>
              </li>
            )
          })}
          {filtered.length === 0 && !isNew && <li className="px-3 py-6 text-center text-sm text-ink-500">Script bulunamadı.</li>}
        </ul>
      </div>

      <div className="min-w-0 overflow-hidden rounded-xl bg-ink-950/50 ring-1 ring-white/8">
        {selected || isNew ? (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b border-white/6 px-4 py-3">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Script adı" className="h-9 max-w-sm font-medium" />
              {dirty && <Badge tone="amber">Kaydedilmedi</Badge>}
              <div className="ml-auto flex gap-2">
                {!isNew && (
                  <Button
                    size="sm"
                    variant="success"
                    icon={<Play className="size-3.5" />}
                    loading={run.isPending}
                    disabled={dirty}
                    title={dirty ? 'Önce kaydedin' : 'Bir kez çalıştır'}
                    onClick={async () => {
                      if (await confirm({ title: `${name} şimdi çalıştırılsın mı?`, description: 'Script Rule Engine’de bir kez çalıştırılır.', confirmLabel: 'Çalıştır', tone: 'primary' }))
                        run.mutate(selectedId!)
                    }}
                  >
                    Çalıştır
                  </Button>
                )}
                {!isNew && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="hover:text-rose-300"
                    icon={<Trash2 className="size-3.5" />}
                    onClick={async () => {
                      const used = usage.get(selectedId!) ?? 0
                      if (await confirm({ title: `${name} silinsin mi?`, description: used ? `${used} cron politikası bu scripti kullanıyor.` : 'Bu işlem geri alınamaz.', confirmLabel: 'Sil' }))
                        remove.mutate(selectedId!)
                    }}
                  >
                    Sil
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="primary"
                  icon={<Save className="size-3.5" />}
                  loading={save.isPending}
                  disabled={!dirty || !name.trim() || !code.trim()}
                  onClick={() => save.mutate()}
                >
                  Kaydet
                </Button>
              </div>
            </div>
            <Suspense
              fallback={
                <div className="grid h-[460px] place-items-center text-ink-400">
                  <Spinner />
                </div>
              }
            >
              <ScriptEditor value={code} onChange={setCode} />
            </Suspense>
            <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-white/6 px-4 py-2.5 font-mono text-[11px] text-ink-500">
              <span>
                <span className="text-cyan-300/80">SendMqttMessage</span>(topic, payload)
              </span>
              <span>
                <span className="text-cyan-300/80">WriteLogToConsole</span>(message)
              </span>
              <span>
                <span className="text-cyan-300/80">GetData</span>(key)
              </span>
            </div>
          </>
        ) : (
          <EmptyState
            className="h-full min-h-96"
            icon={<FileCode2 className="size-6" />}
            title="Script seçin"
            description="Düzenlemek için soldan bir script seçin ya da yeni bir tane oluşturun."
            action={
              <Button variant="primary" size="sm" icon={<Plus className="size-3.5" />} onClick={() => open(null)}>
                Yeni script
              </Button>
            }
          />
        )}
      </div>
    </div>
  )
}
