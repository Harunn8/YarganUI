import cronstrue from 'cronstrue'
import 'cronstrue/locales/tr'

/** Cron ifadesinin Türkçe açıklaması; geçersizse null. */
export function describeCron(expression: string | null | undefined): string | null {
  if (!expression?.trim()) return null
  try {
    return cronstrue.toString(expression.trim(), { locale: 'tr', use24HourTimeFormat: true })
  } catch {
    return null
  }
}

export const cronPresets = [
  { label: 'Her dakika', value: '* * * * *' },
  { label: 'Her 15 dakika', value: '*/15 * * * *' },
  { label: 'Saat başı', value: '0 * * * *' },
  { label: 'Her gün 06:00', value: '0 6 * * *' },
  { label: 'Hafta içi 08:30', value: '30 8 * * 1-5' },
  { label: 'Pazartesi 03:00', value: '0 3 * * 1' },
]
