const pad = (n: number, width = 2) => String(Math.trunc(Math.abs(n))).padStart(width, '0')

/**
 * Backend tarihleri "timestamp without time zone" olarak saklıyor ve JSON'a ofsetsiz
 * yazıyor (ör. 2026-10-07T14:30:00.1234567). Bunlar sunucunun yerel saati olduğu için
 * tarayıcıda da yerel saat olarak yorumlanır. Kesir 3 haneye kısaltılır.
 */
export function parseApiDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const normalized = value.replace(/(\.\d{3})\d+/, '$1')
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}

/** Backend'e gönderilecek ofsetsiz yerel tarih (yyyy-MM-ddTHH:mm:ss). */
export function toApiDate(date: Date): string {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  )
}

/** input[type=datetime-local] değeri. */
export function toDatetimeLocal(date: Date): string {
  return toApiDate(date).slice(0, 16)
}

export function fromDatetimeLocal(value: string): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const dateTimeFmt = new Intl.DateTimeFormat('tr-TR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})
const shortDateTimeFmt = new Intl.DateTimeFormat('tr-TR', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})
const timeFmt = new Intl.DateTimeFormat('tr-TR', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})
const hmFmt = new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' })
const dayFmt = new Intl.DateTimeFormat('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })

export const formatDateTime = (d: Date | null) => (d ? dateTimeFmt.format(d) : '—')
export const formatShortDateTime = (d: Date | null) => (d ? shortDateTimeFmt.format(d) : '—')
export const formatTime = (d: Date | null) => (d ? timeFmt.format(d) : '—')
export const formatHm = (d: Date | null) => (d ? hmFmt.format(d) : '—')
export const formatDay = (d: Date) => dayFmt.format(d)

export function formatUtcTime(d: Date): string {
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
}

/** Gün yılın kaçıncı günü (UTC) — operasyon merkezlerinde yaygın DOY gösterimi. */
export function dayOfYearUtc(d: Date): number {
  const start = Date.UTC(d.getUTCFullYear(), 0, 0)
  return Math.floor((d.getTime() - start) / 86_400_000)
}

/** 754 sn → "12 dk 34 sn", 4000 sn → "1 sa 06 dk" */
export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds)) return '—'
  const s = Math.max(0, Math.round(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h >= 48) return `${Math.floor(h / 24)} gün ${h % 24} sa`
  if (h > 0) return `${h} sa ${pad(m)} dk`
  if (m > 0) return `${m} dk ${pad(sec)} sn`
  return `${sec} sn`
}

/** Geri sayım: 00:12:34, gün varsa 1g 02:03:04 */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const d = Math.floor(total / 86400)
  const h = Math.floor((total % 86400) / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const hms = `${pad(h)}:${pad(m)}:${pad(s)}`
  return d > 0 ? `${d}g ${hms}` : hms
}

export function formatRelative(target: Date, now: Date): string {
  const diff = target.getTime() - now.getTime()
  const abs = Math.abs(diff)
  const minutes = Math.round(abs / 60_000)
  let text: string
  if (abs < 45_000) return 'şimdi'
  if (minutes < 60) text = `${minutes} dk`
  else if (minutes < 60 * 24) text = `${Math.floor(minutes / 60)} sa ${minutes % 60} dk`
  else text = `${Math.floor(minutes / 1440)} gün`
  return diff > 0 ? `${text} sonra` : `${text} önce`
}

export function formatLat(lat: number): string {
  return `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'K' : 'G'}`
}

export function formatLon(lon: number): string {
  return `${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? 'D' : 'B'}`
}

export function formatNumber(value: number, digits = 0): string {
  return value.toLocaleString('tr-TR', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

export function shortId(id: string | null | undefined): string {
  return id ? id.slice(0, 8) : '—'
}

export function greeting(now: Date): string {
  const h = now.getHours()
  if (h < 6) return 'İyi geceler'
  if (h < 12) return 'Günaydın'
  if (h < 18) return 'İyi günler'
  return 'İyi akşamlar'
}
