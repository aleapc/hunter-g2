import type { Place, PlaceCategory } from './state'
import { CATEGORY_TO_OSM_TAGS } from './state'
import { calculateDistance } from './utils/geo'

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
]

let endpointIndex = 0

function getEndpoint(): string {
  return OVERPASS_ENDPOINTS[endpointIndex]
}

function rotateEndpoint(): void {
  endpointIndex = (endpointIndex + 1) % OVERPASS_ENDPOINTS.length
}

interface OsmElement {
  type: string
  id: number
  lat: number
  lon: number
  tags?: Record<string, string>
  center?: { lat: number; lon: number }
}

interface OverpassResponse {
  elements: OsmElement[]
}

function toPlace(el: OsmElement, category: PlaceCategory): Place {
  const lat = el.lat ?? el.center?.lat ?? 0
  const lon = el.lon ?? el.center?.lon ?? 0
  const tags = el.tags ?? {}

  const addressParts = [
    tags['addr:street'],
    tags['addr:housenumber'],
    tags['addr:city'] ?? tags['addr:suburb'],
  ].filter(Boolean)

  return {
    id: `osm-${el.type}-${el.id}`,
    name: tags.name ?? tags['name:en'] ?? 'Sem nome',
    latitude: lat,
    longitude: lon,
    category,
    address: addressParts.length > 0 ? addressParts.join(', ') : undefined,
    isOpen: undefined,
    rating: undefined,
    userRatingsTotal: undefined,
    priceLevel: undefined,
  }
}

function buildQuery(
  lat: number,
  lng: number,
  tags: string[],
  radius: number,
  limit: number,
): string {
  const filters = tags
    .map((tag) => {
      if (tag.startsWith('cuisine=')) {
        // cuisine subcategory: search restaurants with that cuisine
        const cuisine = tag.split('=')[1]
        return `node["amenity"="restaurant"]["cuisine"~"${cuisine}",i](around:${radius},${lat},${lng});`
      }
      const [key, value] = tag.split('=')
      return `node["${key}"="${value}"](around:${radius},${lat},${lng});`
    })
    .join('\n')

  return `[out:json][timeout:15];
(
${filters}
);
out body ${limit};`
}

/**
 * Fetch with exponential backoff retry (500ms, 1000ms, 2000ms).
 * Throws on final failure. Pattern from openclaw-g2-hud.
 */
async function fetchWithRetry(
  url: string,
  opts: RequestInit,
  maxAttempts = 3,
): Promise<Response> {
  let lastError: Error | null = null
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const resp = await fetch(url, opts)
      if (resp.ok) return resp
      lastError = new Error(`HTTP ${resp.status}`)
      console.warn(`fetchWithRetry attempt ${attempt + 1}/${maxAttempts} to ${url}: ${lastError.message}`)
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e))
      console.warn(`fetchWithRetry attempt ${attempt + 1}/${maxAttempts} to ${url}: ${lastError.message}`)
    }
    // Exponential backoff: 500ms, 1000ms, 2000ms
    if (attempt < maxAttempts - 1) {
      await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)))
    }
  }
  throw lastError ?? new Error('fetchWithRetry failed')
}

export async function searchNearby(
  lat: number,
  lng: number,
  category: PlaceCategory,
  radius: number = 2000,
  subcategoryTag?: string,
): Promise<Place[]> {
  const tags = subcategoryTag
    ? [subcategoryTag]
    : CATEGORY_TO_OSM_TAGS[category] ?? []

  const query = buildQuery(lat, lng, tags, radius, 20)

  let lastError: Error | null = null

  // Retry 3 times per endpoint (with exponential backoff) before rotating.
  for (let attempt = 0; attempt < OVERPASS_ENDPOINTS.length; attempt++) {
    const endpoint = getEndpoint()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12_000)

    try {
      const response = await fetchWithRetry(
        endpoint,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `data=${encodeURIComponent(query)}`,
          signal: controller.signal,
        },
        3,
      )

      clearTimeout(timeout)

      const contentType = response.headers.get('content-type') ?? ''
      if (!contentType.includes('json')) {
        console.warn(`Overpass ${endpoint} returned non-JSON`)
        rotateEndpoint()
        continue
      }

      const data: OverpassResponse = await response.json()

      const places = data.elements
        .filter((el) => el.tags?.name)
        .map((el) => {
          const place = toPlace(el, category)
          place.distance = calculateDistance(lat, lng, place.latitude, place.longitude)
          return place
        })
        .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))

      return places
    } catch (err) {
      clearTimeout(timeout)
      lastError = err instanceof Error ? err : new Error(String(err))
      console.warn(`Overpass ${endpoint} exhausted retries:`, lastError.message)
      rotateEndpoint()
    }
  }

  console.error('All Overpass endpoints failed:', lastError?.message)
  return []
}
