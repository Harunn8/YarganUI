import { CalendarClock, Star } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import type { SatellitePassResponse } from '../../api/types'
import { Badge } from '../../components/ui/Badge'
import { Segmented } from '../../components/ui/Form'
import { EmptyState } from '../../components/ui/States'
import { Table, TD, TH, THead, TR } from '../../components/ui/Table'
import { formatCountdown, formatDateTime, formatDuration, formatRelative, parseApiDate } from '../../lib/format'
import type { TrackedSatellite } from './orbit'
import { statusOf } from './passStatus'

type Filter = 'upcoming' | 'all' | 'past'

export function PassTable({
  passes,
  satellites,
  now,
  emptyAction,
}: {
  passes: SatellitePassResponse[]
  satellites: TrackedSatellite[]
  now: Date
  emptyAction?: ReactNode
}) {
  const [filter, setFilter] = useState<Filter>('upcoming')
  const colorOf = useMemo(
    () => new Map(satellites.map((s) => [s.name.toLocaleLowerCase('tr-TR'), s.color])),
    [satellites],
  )

  const rows = useMemo(() => {
    const t = now.getTime()
    return passes
      .map((p) => ({ pass: p, aos: parseApiDate(p.aos), los: parseApiDate(p.los) }))
      .filter(({ los }) => {
        if (filter === 'all' || !los) return true
        return filter === 'upcoming' ? los.getTime() >= t : los.getTime() < t
      })
      .sort((a, b) => {
        const diff = (a.aos?.getTime() ?? 0) - (b.aos?.getTime() ?? 0)
        return filter === 'past' ? -diff : diff
      })
  }, [passes, filter, now])

  return (
    <div>
      <div className="flex items-center justify-between px-5 pb-3">
        <Segmented
          size="sm"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'upcoming', label: 'Yaklaşan' },
            { value: 'past', label: 'Geçmiş' },
            { value: 'all', label: 'Tümü' },
          ]}
        />
        <span className="text-xs text-ink-400">{rows.length} geçiş</span>
      </div>
      {rows.length === 0 ? (
        <EmptyState
          icon={<CalendarClock className="size-6" />}
          title={filter === 'past' ? 'Geçmiş geçiş yok' : 'Planlanmış geçiş yok'}
          description="TLE yapılandırmasından geçişleri hesaplayıp planlamaya ekleyebilirsiniz."
          action={emptyAction}
        />
      ) : (
        <div className="max-h-[420px] overflow-y-auto">
          <Table>
            <THead>
              <tr>
                <TH>Uydu</TH>
                <TH>AOS</TH>
                <TH>LOS</TH>
                <TH>Süre</TH>
                <TH>Durum</TH>
                <TH className="text-right">Zaman</TH>
              </tr>
            </THead>
            <tbody>
              {rows.map(({ pass, aos, los }) => {
                const meta = statusOf(pass.status)
                const t = now.getTime()
                const live = aos && los && aos.getTime() <= t && t < los.getTime()
                return (
                  <TR key={pass.id}>
                    <TD>
                      <div className="flex items-center gap-2">
                        <span
                          className="size-2 rounded-full"
                          style={{ background: colorOf.get(pass.name.toLocaleLowerCase('tr-TR')) ?? '#94a3b8' }}
                        />
                        <span className="font-medium text-ink-100">{pass.name}</span>
                        {pass.isImportant && <Star className="size-3.5 fill-amber-300 text-amber-300" />}
                      </div>
                    </TD>
                    <TD className="num text-[13px]">{formatDateTime(aos)}</TD>
                    <TD className="num text-[13px]">{formatDateTime(los)}</TD>
                    <TD className="num text-[13px]">
                      {aos && los ? formatDuration((los.getTime() - aos.getTime()) / 1000) : `${pass.duration} dk`}
                    </TD>
                    <TD>
                      <Badge tone={meta.tone} dot pulse={pass.status === 2}>
                        {meta.label}
                      </Badge>
                    </TD>
                    <TD className="num text-right text-[13px]">
                      {live ? (
                        <span className="text-emerald-300">LOS’a {formatCountdown(los!.getTime() - t)}</span>
                      ) : aos && aos.getTime() > t ? (
                        <span className="text-cyan-200">AOS’a {formatCountdown(aos.getTime() - t)}</span>
                      ) : los ? (
                        <span className="text-ink-500">{formatRelative(los, now)}</span>
                      ) : (
                        '—'
                      )}
                    </TD>
                  </TR>
                )
              })}
            </tbody>
          </Table>
        </div>
      )}
    </div>
  )
}
