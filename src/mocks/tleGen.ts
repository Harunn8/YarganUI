import { gstime } from 'satellite.js'
import type { TleData } from '../api/types'

// Demo modu için sentetik TLE üretir. Epoch açılış anı olduğundan konumlar her
// zaman "taze" görünür; gerçek uyduların gerçek yörüngeleri DEĞİLDİR.

const DEG = Math.PI / 180

export interface OrbitSpec {
  name: string
  norad: number
  intl: string
  inclination: number
  /** tur/gün */
  meanMotion: number
  eccentricity: number
  /** Epoch anında uydunun bulunacağı yer (enlem, boylam) ve hareket yönü. */
  at: { lat: number; lon: number; ascending: boolean }
  bstar?: string
}

const pad = (value: string, width: number) => value.padStart(width, ' ')

function checksum(line: string): number {
  let sum = 0
  for (const ch of line.slice(0, 68)) {
    if (ch >= '0' && ch <= '9') sum += Number(ch)
    else if (ch === '-') sum += 1
  }
  return sum % 10
}

const norm360 = (deg: number) => ((deg % 360) + 360) % 360

/** Dairesel yörüngede uyduyu epoch anında istenen enlem/boylama yerleştiren RAAN ve argüman. */
function placement(spec: OrbitSpec, epoch: Date) {
  const i = spec.inclination * DEG
  if (spec.inclination < 1) {
    // Ekvatoral (GEO): boylam ≈ RAAN + ω + M − GMST
    const m = norm360(spec.at.lon + gstime(epoch) / DEG)
    return { raan: 0, argp: 0, meanAnomaly: m }
  }
  const lat = Math.max(-spec.inclination + 0.5, Math.min(spec.inclination - 0.5, spec.at.lat)) * DEG
  let u = Math.asin(Math.sin(lat) / Math.sin(i))
  if (!spec.at.ascending) u = Math.PI - u
  const alpha = spec.at.lon * DEG + gstime(epoch)
  const raan = alpha - Math.atan2(Math.cos(i) * Math.sin(u), Math.cos(u))
  return { raan: norm360(raan / DEG), argp: 90, meanAnomaly: norm360(u / DEG - 90) }
}

export function makeTle(spec: OrbitSpec, epoch: Date): TleData {
  const year = epoch.getUTCFullYear()
  const doy = (epoch.getTime() - Date.UTC(year, 0, 1)) / 86_400_000 + 1
  const { raan, argp, meanAnomaly } = placement(spec, epoch)
  const norad = String(spec.norad).padStart(5, '0')

  let line1 =
    `1 ${norad}U ${spec.intl.padEnd(8, ' ')} ${String(year % 100).padStart(2, '0')}${doy.toFixed(8).padStart(12, '0')} ` +
    ` .00001000  00000+0 ${spec.bstar ?? ' 10270-3'} 0  999`
  line1 = line1.slice(0, 68)
  line1 += checksum(line1)

  let line2 =
    `2 ${norad} ${pad(spec.inclination.toFixed(4), 8)} ${pad(raan.toFixed(4), 8)} ` +
    `${Math.round(spec.eccentricity * 1e7).toString().padStart(7, '0')} ${pad(argp.toFixed(4), 8)} ` +
    `${pad(meanAnomaly.toFixed(4), 8)} ${pad(spec.meanMotion.toFixed(8), 11)}${pad('1234', 5)}`
  line2 = line2.slice(0, 68)
  line2 += checksum(line2)

  return { satelliteName: spec.name, line1, line2 }
}

export const trackedSpecs: OrbitSpec[] = [
  { name: 'İMECE', norad: 56178, intl: '23054A', inclination: 97.98, meanMotion: 14.84, eccentricity: 0.0011, at: { lat: 36.5, lon: 30.2, ascending: false } },
  { name: 'ISS (ZARYA)', norad: 25544, intl: '98067A', inclination: 51.64, meanMotion: 15.5, eccentricity: 0.0004, at: { lat: 24, lon: 2, ascending: true } },
  { name: 'GÖKTÜRK-2', norad: 39030, intl: '12073A', inclination: 97.86, meanMotion: 14.73, eccentricity: 0.0013, at: { lat: -18, lon: 52, ascending: true } },
  { name: 'NOAA 19', norad: 33591, intl: '09005A', inclination: 99.19, meanMotion: 14.13, eccentricity: 0.0014, at: { lat: 12, lon: 118, ascending: true } },
  { name: 'METOP-B', norad: 38771, intl: '12049A', inclination: 98.7, meanMotion: 14.21, eccentricity: 0.0002, at: { lat: -48, lon: -24, ascending: false } },
  { name: 'RASAT', norad: 37791, intl: '11044D', inclination: 98.1, meanMotion: 14.65, eccentricity: 0.0021, at: { lat: 58, lon: -38, ascending: false } },
  { name: 'TÜRKSAT 5A', norad: 47306, intl: '21001A', inclination: 0.04, meanMotion: 1.00271, eccentricity: 0.0002, at: { lat: 0, lon: 31, ascending: true }, bstar: ' 00000+0' },
]

/** TLE aramasında dönen ek uydular. */
export const catalogSpecs: OrbitSpec[] = [
  ...trackedSpecs,
  { name: 'NOAA 18', norad: 28654, intl: '05018A', inclination: 99.0, meanMotion: 14.13, eccentricity: 0.0013, at: { lat: -5, lon: -150, ascending: true } },
  { name: 'NOAA 15', norad: 25338, intl: '98030A', inclination: 98.6, meanMotion: 14.26, eccentricity: 0.001, at: { lat: 40, lon: 160, ascending: false } },
  { name: 'SENTINEL-2A', norad: 40697, intl: '15028A', inclination: 98.57, meanMotion: 14.31, eccentricity: 0.0001, at: { lat: 20, lon: -80, ascending: false } },
  { name: 'TERRA', norad: 25994, intl: '99068A', inclination: 98.2, meanMotion: 14.59, eccentricity: 0.0001, at: { lat: -30, lon: 100, ascending: false } },
  { name: 'GÖKTÜRK-1A', norad: 41875, intl: '16073A', inclination: 98.1, meanMotion: 14.62, eccentricity: 0.0001, at: { lat: 65, lon: 70, ascending: true } },
  { name: 'TÜRKSAT 4A', norad: 39522, intl: '14007A', inclination: 0.05, meanMotion: 1.00272, eccentricity: 0.0003, at: { lat: 0, lon: 42, ascending: true }, bstar: ' 00000+0' },
]
