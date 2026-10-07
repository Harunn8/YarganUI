import type { Tone } from '../../components/ui/Badge'
import { PassStatus } from '../../api/types'

export const passStatusMeta: Record<number, { label: string; tone: Tone; bar: string }> = {
  [PassStatus.SelectTracking]: { label: 'İzleme seçildi', tone: 'violet', bar: 'bg-violet-400/60 ring-violet-300/60' },
  [PassStatus.Queued]: { label: 'Kuyrukta', tone: 'cyan', bar: 'bg-cyan-400/80 ring-cyan-200/70' },
  [PassStatus.Tracking]: { label: 'İzleniyor', tone: 'emerald', bar: 'bg-emerald-400/90 ring-emerald-200/80' },
  [PassStatus.Completed]: { label: 'Tamamlandı', tone: 'neutral', bar: 'bg-ink-400/60 ring-ink-300/40' },
  [PassStatus.Failed]: { label: 'Başarısız', tone: 'rose', bar: 'bg-rose-400/80 ring-rose-200/70' },
  [PassStatus.Canceled]: { label: 'İptal edildi', tone: 'neutral', bar: 'bg-ink-500/50 ring-ink-400/40' },
  [PassStatus.Skipped]: { label: 'Atlandı', tone: 'amber', bar: 'hatch ring-amber-300/60' },
}

export const statusOf = (status: number) => passStatusMeta[status] ?? passStatusMeta[PassStatus.SelectTracking]
