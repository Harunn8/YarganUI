import { useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Bot, Play, Square } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { errorMessage } from '../../api/http'
import { passApi } from '../../api/satops'
import { Button } from '../../components/ui/Button'
import { useConfirm } from '../../components/ui/Confirm'
import { formatHm } from '../../lib/format'

const KEY = 'yargan.scheduler.last'

interface LastAction {
  status: boolean
  at: string
}

function readLast(): LastAction | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as LastAction) : null
  } catch {
    return null
  }
}

/**
 * Otomatik planlayıcıyı başlatır/durdurur. Backend mevcut durumu sorgulayan bir uç
 * sunmadığı için bu tarayıcıdan verilen son komut gösterilir.
 */
export function SchedulerControl() {
  const confirm = useConfirm()
  const queryClient = useQueryClient()
  const [last, setLast] = useState<LastAction | null>(readLast)

  const mutation = useMutation({
    mutationFn: (status: boolean) => passApi.autoSchedule(status),
    onSuccess: (_, status) => {
      const action = { status, at: new Date().toISOString() }
      setLast(action)
      try {
        localStorage.setItem(KEY, JSON.stringify(action))
      } catch {
        // yok say
      }
      queryClient.invalidateQueries({ queryKey: ['passes'] })
      toast.success(status ? 'Otomatik planlayıcı başlatıldı' : 'Otomatik planlayıcı durduruldu')
    },
    onError: (err, status) => {
      const noPasses = axios.isAxiosError(err) && err.response?.status === 400
      toast.error(status ? 'Planlayıcı başlatılamadı' : 'Planlayıcı durdurulamadı', {
        description: noPasses
          ? status
            ? 'Planlanacak geçiş yok (“İzleme seçildi” durumunda ve AOS’u gelecekte olan geçiş gerekir).'
            : 'Durdurulacak aktif geçiş yok.'
          : errorMessage(err),
      })
    },
  })

  const run = async (status: boolean) => {
    const ok = await confirm(
      status
        ? {
            title: 'Otomatik planlayıcı başlatılsın mı?',
            description: 'İzleme seçilmiş geçişler için çakışma kontrolü yapılır ve her geçiş için Rule API’de script ve cron işi oluşturulur.',
            confirmLabel: 'Başlat',
            tone: 'primary',
          }
        : {
            title: 'Otomatik planlayıcı durdurulsun mu?',
            description: 'Kuyruktaki ve izlenmekte olan tüm geçişler iptal edilecek.',
            confirmLabel: 'Durdur',
          },
    )
    if (ok) mutation.mutate(status)
  }

  return (
    <div className="flex items-center gap-1 rounded-xl bg-ink-900/70 py-1 pr-1 pl-3 ring-1 ring-white/8">
      <Bot className="size-4 text-violet-300" />
      <div className="mr-2 ml-1 leading-tight">
        <div className="text-[12.5px] font-medium text-ink-100">Otomatik planlayıcı</div>
        <div className="text-[10.5px] text-ink-400">
          {last ? `${last.status ? 'Başlatıldı' : 'Durduruldu'} · ${formatHm(new Date(last.at))}` : 'Komut verilmedi'}
        </div>
      </div>
      <Button
        size="sm"
        variant="success"
        icon={<Play className="size-3.5" />}
        loading={mutation.isPending && mutation.variables === true}
        onClick={() => run(true)}
      >
        Başlat
      </Button>
      <Button
        size="sm"
        variant="ghost"
        icon={<Square className="size-3.5" />}
        loading={mutation.isPending && mutation.variables === false}
        onClick={() => run(false)}
      >
        Durdur
      </Button>
    </div>
  )
}
