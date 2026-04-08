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

export async function searchNearby(
  lat: number,
  lng: number,
  category: PlaceCategory,
  radius: number = 2000,
  subcategoryTag?: string,
): Promise<Place[]> {
  const tags = subcategoryTag
    ? [subcategoryTag]
    : CATEGORY_TO_OSM_TAGS[category]

  const query = buildQuery(lat, lng, tags, radius, 20)

  let lastError: Error | null = null

  for (let attempt = 0; attempt < OVERPASS_ENDPOINTS.length; attempt++) {
    const endpoint = getEndpoint()

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
      })

      if (!response.ok) {
        console.warn(`Overpass ${endpoint} returned ${response.status}`)
        rotateEndpoint()
        continue
      }

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
      lastError = err instanceof Error ? err : new Error(String(err))
      console.warn(`Overpass ${endpoint} failed:`, lastError.message)
      rotateEndpoint()
    }
  }

  console.error('All Overpass endpoints failed:', lastError?.message)
  return []
}
