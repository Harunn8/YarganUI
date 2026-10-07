import { useMemo } from 'react'
import type { TleResponse } from '../../api/types'
import { useNow } from '../../lib/useNow'
import type { MapSatellite } from './WorldMap'
import {
  buildSatellites,
  footprintRadiusDeg,
  groundTrack,
  positionAt,
  predictPasses,
  stationFromTle,
  subsolarPoint,
  type GroundTrack,
  type PredictedPass,
  type SatPosition,
} from './orbit'

const TRACK_REFRESH_MS = 30_000
const PASS_REFRESH_MS = 5 * 60_000

/**
 * TLE yapılandırmasından canlı uydu durumunu üretir:
 * konumlar her saniye, yer izleri 30 sn'de, geçiş tahminleri 5 dk'da bir yenilenir.
 */
export function useSatelliteTracker(tle: TleResponse | null | undefined, options?: { predict?: boolean }) {
  const predict = options?.predict ?? true
  const now = useNow(1000)
  const station = useMemo(() => stationFromTle(tle), [tle])
  const satellites = useMemo(() => buildSatellites(tle?.tleData), [tle])

  const positions = useMemo(() => {
    const result: Record<string, SatPosition | null> = {}
    for (const s of satellites) result[s.key] = s.satrec ? positionAt(s.satrec, now, station) : null
    return result
  }, [satellites, station, now])

  const trackBucket = Math.floor(now.getTime() / TRACK_REFRESH_MS)
  const tracks = useMemo(() => {
    const result: Record<string, GroundTrack> = {}
    const at = new Date(trackBucket * TRACK_REFRESH_MS)
    for (const s of satellites) result[s.key] = groundTrack(s, at)
    return result
  }, [satellites, trackBucket])

  const passBucket = Math.floor(now.getTime() / PASS_REFRESH_MS)
  const predicted = useMemo<PredictedPass[]>(() => {
    if (!station || !predict) return []
    const from = new Date(passBucket * PASS_REFRESH_MS)
    return satellites
      .flatMap((s) => predictPasses(s, station, from, 24.5))
      .sort((a, b) => a.aos.getTime() - b.aos.getTime())
  }, [satellites, station, passBucket, predict])

  const sunBucket = Math.floor(now.getTime() / 60_000)
  const sun = useMemo(() => subsolarPoint(new Date(sunBucket * 60_000)), [sunBucket])

  const mapSatellites = useMemo<MapSatellite[]>(
    () =>
      satellites.flatMap((s) => {
        const p = positions[s.key]
        if (!p) return []
        return [
          {
            key: s.key,
            name: s.name,
            color: s.color,
            lat: p.lat,
            lon: p.lon,
            altKm: p.altKm,
            footprintDeg: footprintRadiusDeg(p.altKm, station?.minElevation ?? 0),
            visible: station ? (p.elevation ?? -90) >= station.minElevation : false,
          },
        ]
      }),
    [satellites, positions, station],
  )

  return { now, station, satellites, positions, tracks, predicted, sun, mapSatellites }
}

export type SatelliteTracker = ReturnType<typeof useSatelliteTracker>

/** Uydunun şu anki ya da sıradaki geçişi. */
export function nextPassFor(predicted: PredictedPass[], satKey: string, now: Date): PredictedPass | null {
  const t = now.getTime()
  return predicted.find((p) => p.satKey === satKey && p.los.getTime() > t) ?? null
}
