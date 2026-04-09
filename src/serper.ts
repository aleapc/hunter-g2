// Serper.dev integration — enriches places with Google ratings
// Uses the Places endpoint to get ratings from Google Local Pack

const SERPER_API_KEY = import.meta.env.VITE_SERPER_API_KEY as string | undefined
const SERPER_URL = 'https://google.serper.dev/places'

interface SerperPlace {
  title: string
  address?: string
  rating?: number
  ratingCount?: number
  latitude?: number
  longitude?: number
  type?: string
  phoneNumber?: string
  website?: string
}

interface SerperResponse {
  places?: SerperPlace[]
}

// Simple in-memory cache: query → { data, timestamp }
const cache = new Map<string, { places: SerperPlace[]; ts: number }>()
const CACHE_TTL = 2 * 60 * 60 * 1000 // 2 hours

function getCacheKey(query: string, lat: number, lng: number): string {
  return `${query}|${lat.toFixed(3)}|${lng.toFixed(3)}`
}

export function isSerperAvailable(): boolean {
  return !!SERPER_API_KEY
}

export async function searchSerperPlaces(
  query: string,
  lat: number,
  lng: number,
): Promise<SerperPlace[]> {
  if (!SERPER_API_KEY) return []

  const cacheKey = getCacheKey(query, lat, lng)
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.places
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8_000)

    const response = await fetch(SERPER_URL, {
      method: 'POST',
      headers: {
        'X-API-KEY': SERPER_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: query,
        ll: `@${lat},${lng},15z`,
        num: 10,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok) {
      console.warn('Serper API error:', response.status)
      return []
    }

    const data: SerperResponse = await response.json()
    const places = data.places ?? []

    cache.set(cacheKey, { places, ts: Date.now() })
    return places
  } catch (err) {
    console.warn('Serper fetch failed:', err)
    return []
  }
}

// Match a Serper place to an OSM place by name similarity
export function findMatchingRating(
  osmName: string,
  serperPlaces: SerperPlace[],
): { rating: number; ratingCount: number } | null {
  const normalize = (s: string) =>
    s.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')

  const osmNorm = normalize(osmName)

  for (const sp of serperPlaces) {
    const spNorm = normalize(sp.title)
    // Exact or substring match
    if (
      spNorm === osmNorm ||
      spNorm.includes(osmNorm) ||
      osmNorm.includes(spNorm)
    ) {
      if (sp.rating != null) {
        return { rating: sp.rating, ratingCount: sp.ratingCount ?? 0 }
      }
    }
  }

  return null
}
