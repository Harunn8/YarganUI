import {
  degreesLat,
  degreesLong,
  eciToEcf,
  eciToGeodetic,
  ecfToLookAngles,
  gstime,
  jday,
  propagate,
  sunPos,
  twoline2satrec,
  type SatRec,
} from 'satellite.js'
import type { TleData, TleResponse } from '../../api/types'

export const EARTH_RADIUS_KM = 6378.137
const DEG = Math.PI / 180

export const SAT_COLORS = [
  '#22d3ee',
  '#a78bfa',
  '#f472b6',
  '#34d399',
  '#fbbf24',
  '#60a5fa',
  '#fb7185',
  '#a3e635',
  '#fb923c',
  '#2dd4bf',
  '#e879f9',
  '#38bdf8',
]

export interface GroundStation {
  name: string
  lat: number
  lon: number
  /** metre */
  altM: number
  minElevation: number
  setupInterval: number
}

export function stationFromTle(tle: TleResponse | null | undefined): GroundStation | null {
  if (!tle) return null
  return {
    name: tle.name || 'Yer istasyonu',
    lat: tle.latitude,
    lon: tle.longitude,
    altM: tle.altitude,
    minElevation: tle.minElevation,
    setupInterval: tle.setupInterval,
  }
}

export interface TrackedSatellite {
  key: string
  name: string
  color: string
  tle: TleData
  satrec: SatRec | null
  noradId: string | null
  epoch: Date | null
  /** dakika */
  periodMin: number | null
  inclinationDeg: number | null
  error?: string
}

export function buildSatellites(tleData: TleData[] | null | undefined): TrackedSatellite[] {
  return (tleData ?? []).map((tle, i) => {
    const name = tle.satelliteName?.trim() || `Uydu ${i + 1}`
    const base = { key: `${i}:${name}`, name, color: SAT_COLORS[i % SAT_COLORS.length], tle }
    try {
      const satrec = twoline2satrec(tle.line1.trim(), tle.line2.trim())
      if (satrec.error || !Number.isFinite(satrec.no) || satrec.no <= 0) {
        return { ...base, satrec: null, noradId: null, epoch: null, periodMin: null, inclinationDeg: null, error: 'TLE geçersiz' }
      }
      return {
        ...base,
        satrec,
        noradId: satrec.satnum?.trim() || null,
        epoch: new Date((satrec.jdsatepoch - 2440587.5) * 86_400_000),
        periodMin: (2 * Math.PI) / satrec.no,
        inclinationDeg: satrec.inclo / DEG,
      }
    } catch {
      return { ...base, satrec: null, noradId: null, epoch: null, periodMin: null, inclinationDeg: null, error: 'TLE ayrıştırılamadı' }
    }
  })
}

export interface SatPosition {
  lat: number
  lon: number
  altKm: number
  speedKmS: number
  azimuth?: number
  elevation?: number
  rangeKm?: number
}

function stationGeodetic(station: GroundStation) {
  return { latitude: station.lat * DEG, longitude: station.lon * DEG, height: station.altM / 1000 }
}

export function positionAt(satrec: SatRec, date: Date, station?: GroundStation | null): SatPosition | null {
  const pv = propagate(satrec, date)
  if (!pv || !Number.isFinite(pv.position.x)) return null
  const gmst = gstime(date)
  const gd = eciToGeodetic(pv.position, gmst)
  const v = pv.velocity
  const result: SatPosition = {
    lat: degreesLat(gd.latitude),
    lon: degreesLong(gd.longitude),
    altKm: gd.height,
    speedKmS: Math.hypot(v.x, v.y, v.z),
  }
  if (station) {
    const look = ecfToLookAngles(stationGeodetic(station), eciToEcf(pv.position, gmst))
    result.azimuth = (look.azimuth / DEG + 360) % 360
    result.elevation = look.elevation / DEG
    result.rangeKm = look.rangeSat
  }
  return result
}

function elevationAt(satrec: SatRec, station: GroundStation, ms: number): number {
  const pv = propagate(satrec, new Date(ms))
  if (!pv || !Number.isFinite(pv.position.x)) return -90
  const gmst = gstime(new Date(ms))
  return ecfToLookAngles(stationGeodetic(station), eciToEcf(pv.position, gmst)).elevation / DEG
}

/** Uydunun yerden görülebildiği alanın (kapsama) merkez açısı, derece. */
export function footprintRadiusDeg(altKm: number, minElevationDeg = 0): number {
  if (!Number.isFinite(altKm) || altKm <= 0) return 0
  const e = minElevationDeg * DEG
  const lambda = Math.acos((EARTH_RADIUS_KM / (EARTH_RADIUS_KM + altKm)) * Math.cos(e)) - e
  return Math.max(0, lambda / DEG)
}

export interface GroundTrack {
  past: [number, number][]
  future: [number, number][]
}

/** Geçmiş ve gelecek yer izi; pencere yörünge periyoduna göre seçilir. */
export function groundTrack(sat: TrackedSatellite, now: Date): GroundTrack {
  const satrec = sat.satrec
  if (!satrec || !sat.periodMin) return { past: [], future: [] }
  const period = sat.periodMin
  const highOrbit = period > 600
  const pastMin = highOrbit ? 90 : period * 0.5
  const futureMin = highOrbit ? 240 : period * 1.05
  const stepSec = highOrbit ? 300 : 30

  const sample = (fromMin: number, toMin: number) => {
    const points: [number, number][] = []
    const start = now.getTime() + fromMin * 60_000
    const end = now.getTime() + toMin * 60_000
    for (let t = start; t <= end; t += stepSec * 1000) {
      const p = positionAt(satrec, new Date(t))
      if (p) points.push([p.lon, p.lat])
    }
    const last = positionAt(satrec, new Date(end))
    if (last) points.push([last.lon, last.lat])
    return points
  }

  return { past: sample(-pastMin, 0), future: sample(0, futureMin) }
}

export interface PredictedPass {
  satKey: string
  name: string
  aos: Date
  los: Date
  maxElevation: number
  maxAt: Date
  aosAzimuth: number
  losAzimuth: number
  /** Pencere boyunca hep ufuk üstünde (ör. GEO uydu). */
  continuous?: boolean
}

function refineCrossing(satrec: SatRec, station: GroundStation, minEl: number, lo: number, hi: number, rising: boolean) {
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2
    const above = elevationAt(satrec, station, mid) >= minEl
    if (above === rising) hi = mid
    else lo = mid
  }
  return (lo + hi) / 2
}

function refineMax(satrec: SatRec, station: GroundStation, lo: number, hi: number) {
  for (let i = 0; i < 20; i++) {
    const m1 = lo + (hi - lo) / 3
    const m2 = hi - (hi - lo) / 3
    if (elevationAt(satrec, station, m1) < elevationAt(satrec, station, m2)) lo = m1
    else hi = m2
  }
  const t = (lo + hi) / 2
  return { t, el: elevationAt(satrec, station, t) }
}

/** Belirtilen pencerede yer istasyonu üzerinden geçişleri bulur. */
export function predictPasses(
  sat: TrackedSatellite,
  station: GroundStation,
  from: Date,
  hours = 24,
  stepSec = 30,
): PredictedPass[] {
  const satrec = sat.satrec
  if (!satrec) return []
  const minEl = station.minElevation
  const step = stepSec * 1000
  const start = from.getTime()
  const end = start + hours * 3_600_000
  const passes: PredictedPass[] = []

  let t = start
  let el = elevationAt(satrec, station, t)
  let aos: number | null = null
  let continuous = false
  let best = { t, el }

  if (el >= minEl) {
    // Geçiş sürüyor: gerçek AOS'u en fazla 2 saat geriye bakarak bul.
    let back = t
    while (back > start - 2 * 3_600_000 && elevationAt(satrec, station, back - step) >= minEl) back -= step
    if (back <= start - 2 * 3_600_000) {
      aos = back
      continuous = true
    } else {
      aos = refineCrossing(satrec, station, minEl, back - step, back, true)
    }
    best = { t, el }
  }

  while (t < end) {
    const t2 = t + step
    const el2 = elevationAt(satrec, station, t2)
    if (aos === null && el2 >= minEl) {
      aos = refineCrossing(satrec, station, minEl, t, t2, true)
      best = { t: t2, el: el2 }
    } else if (aos !== null && el2 >= minEl) {
      if (el2 > best.el) best = { t: t2, el: el2 }
    } else if (aos !== null && el2 < minEl) {
      const los = refineCrossing(satrec, station, minEl, t, t2, false)
      const peak = refineMax(satrec, station, Math.max(aos, best.t - step), Math.min(los, best.t + step))
      passes.push(makePass(sat, station, aos, los, peak, continuous))
      aos = null
      continuous = false
    }
    t = t2
    el = el2
  }

  if (aos !== null) {
    // Pencere sonunda hâlâ görünür.
    const peak = refineMax(satrec, station, Math.max(aos, best.t - step), Math.min(end, best.t + step))
    passes.push(makePass(sat, station, aos, end, peak, continuous || el >= minEl))
  }
  return passes
}

function makePass(
  sat: TrackedSatellite,
  station: GroundStation,
  aos: number,
  los: number,
  peak: { t: number; el: number },
  continuous: boolean,
): PredictedPass {
  const satrec = sat.satrec!
  const aosPos = positionAt(satrec, new Date(aos), station)
  const losPos = positionAt(satrec, new Date(los), station)
  return {
    satKey: sat.key,
    name: sat.name,
    aos: new Date(aos),
    los: new Date(los),
    maxElevation: peak.el,
    maxAt: new Date(peak.t),
    aosAzimuth: aosPos?.azimuth ?? 0,
    losAzimuth: losPos?.azimuth ?? 0,
    continuous,
  }
}

export interface SkyPoint {
  t: Date
  az: number
  el: number
}

/** Bir geçiş boyunca azimut/elevasyon örnekleri (gök haritası ve grafik için). */
export function passProfile(satrec: SatRec, station: GroundStation, aos: Date, los: Date, samples = 72): SkyPoint[] {
  const points: SkyPoint[] = []
  const span = los.getTime() - aos.getTime()
  if (span <= 0) return points
  for (let i = 0; i <= samples; i++) {
    const t = new Date(aos.getTime() + (span * i) / samples)
    const p = positionAt(satrec, t, station)
    if (p?.azimuth !== undefined && p.elevation !== undefined) points.push({ t, az: p.azimuth, el: p.elevation })
  }
  return points
}

/** Güneşin tam tepede olduğu nokta [boylam, enlem]. */
export function subsolarPoint(date: Date): [number, number] {
  const { rtasc, decl } = sunPos(jday(date))
  const lon = ((((rtasc - gstime(date)) / DEG + 540) % 360) + 360) % 360 - 180
  return [lon, decl / DEG]
}

/** Belirli bir uydu için en yakın geçişin maksimum elevasyonu (planlamaya eklerken). */
export function maxElevationBetween(satrec: SatRec, station: GroundStation, aos: Date, los: Date): number {
  const span = los.getTime() - aos.getTime()
  if (span <= 0) return 0
  let best = -90
  let bestT = aos.getTime()
  for (let i = 0; i <= 40; i++) {
    const t = aos.getTime() + (span * i) / 40
    const el = elevationAt(satrec, station, t)
    if (el > best) {
      best = el
      bestT = t
    }
  }
  const step = span / 40
  return refineMax(satrec, station, Math.max(aos.getTime(), bestT - step), Math.min(los.getTime(), bestT + step)).el
}

export function tleAgeDays(epoch: Date | null, now: Date): number | null {
  return epoch ? (now.getTime() - epoch.getTime()) / 86_400_000 : null
}

const tleLineLength = 69

function tleChecksum(line: string): number {
  let sum = 0
  for (const ch of line.slice(0, 68)) {
    if (ch >= '0' && ch <= '9') sum += Number(ch)
    else if (ch === '-') sum += 1
  }
  return sum % 10
}

/** TLE satırlarını doğrular; sorun yoksa null döner. */
export function validateTle(line1: string, line2: string): string | null {
  const l1 = line1.trim()
  const l2 = line2.trim()
  if (!l1.startsWith('1 ') || !l2.startsWith('2 ')) return 'Satırlar "1 " ve "2 " ile başlamalı.'
  if (l1.length < tleLineLength || l2.length < tleLineLength) return `Her satır ${tleLineLength} karakter olmalı.`
  if (l1.slice(2, 7) !== l2.slice(2, 7)) return 'İki satırın katalog numarası farklı.'
  if (tleChecksum(l1) !== Number(l1[68]) || tleChecksum(l2) !== Number(l2[68])) return 'Sağlama toplamı (checksum) tutmuyor.'
  try {
    const satrec = twoline2satrec(l1, l2)
    if (satrec.error) return 'SGP4 bu elemanları işleyemedi.'
  } catch {
    return 'TLE ayrıştırılamadı.'
  }
  return null
}

/** "AD / satır1 / satır2" bloklarından oluşan metni ayrıştırır (2 ya da 3 satırlık formatlar). */
export function parseTleText(text: string): TleData[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0)
  const result: TleData[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line.startsWith('1 ') && lines[i + 1]?.trim().startsWith('2 ')) {
      const prev = i > 0 ? lines[i - 1].trim() : ''
      const name = prev && !prev.startsWith('1 ') && !prev.startsWith('2 ') ? prev.replace(/^0\s+/, '') : `NORAD ${line.slice(2, 7).trim()}`
      result.push({ satelliteName: name, line1: line, line2: lines[i + 1].trim() })
      i++
    }
  }
  return result
}
