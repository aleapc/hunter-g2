import type { UserLocation } from '../state'

const EARTH_RADIUS_M = 6_371_000

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(EARTH_RADIUS_M * c)
}

export function getCardinalDirection(
  from: UserLocation,
  toLat: number,
  toLng: number,
): string {
  const dLat = toLat - from.lat
  const dLng = toLng - from.lng
  const angle = (Math.atan2(dLng, dLat) * 180) / Math.PI
  const normalized = (angle + 360) % 360

  if (normalized < 22.5 || normalized >= 337.5) return 'N'
  if (normalized < 67.5) return 'NE'
  if (normalized < 112.5) return 'E'
  if (normalized < 157.5) return 'SE'
  if (normalized < 202.5) return 'S'
  if (normalized < 247.5) return 'SW'
  if (normalized < 292.5) return 'W'
  return 'NW'
}

const DIRECTION_ARROWS: Record<string, string> = {
  N: '\u2191',   // ↑
  NE: '\u2197',  // ↗
  E: '\u2192',   // →
  SE: '\u2198',  // ↘
  S: '\u2193',   // ↓
  SW: '\u2199',  // ↙
  W: '\u2190',   // ←
  NW: '\u2196',  // ↖
}

export function getDirectionArrow(direction: string): string {
  return DIRECTION_ARROWS[direction] ?? ''
}

export function getUserLocation(): Promise<UserLocation> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        })
      },
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    )
  })
}
