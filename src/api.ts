import type { Place, PlaceCategory } from './state'
import { CATEGORY_TO_FSQ_IDS } from './state'
import { calculateDistance } from './utils/geo'

const API_KEY = import.meta.env.VITE_FOURSQUARE_API_KEY as string

function getBaseUrl(): string {
  if (import.meta.env.DEV) return '/api/places'
  return 'https://places-api.foursquare.com/places'
}

interface FsqCategory {
  fsq_category_id: string
  name: string
  short_name: string
}

interface FsqPlace {
  fsq_place_id: string
  name: string
  latitude: number
  longitude: number
  categories?: FsqCategory[]
  rating?: number
  price?: number
  hours?: { open_now?: boolean }
  distance?: number
  stats?: { total_ratings?: number }
  location?: {
    formatted_address?: string
    address?: string
    locality?: string
  }
}

interface FsqSearchResponse {
  results: FsqPlace[]
}

function toPlace(result: FsqPlace, category: PlaceCategory): Place {
  return {
    id: result.fsq_place_id,
    name: result.name,
    latitude: result.latitude,
    longitude: result.longitude,
    category,
    rating: result.rating != null ? result.rating / 2 : undefined,
    userRatingsTotal: result.stats?.total_ratings,
    priceLevel: result.price,
    address: result.location?.formatted_address ?? result.location?.address,
    distance: result.distance,
    isOpen: result.hours?.open_now,
  }
}

export async function searchNearby(
  lat: number,
  lng: number,
  category: PlaceCategory,
  radius: number = 2000,
  subcategoryId?: string,
): Promise<Place[]> {
  const categoryIds = subcategoryId
    ? subcategoryId
    : CATEGORY_TO_FSQ_IDS[category]

  const params = new URLSearchParams({
    ll: `${lat},${lng}`,
    radius: String(radius),
    categories: categoryIds,
    limit: '15',
    sort: 'DISTANCE',
  })

  const response = await fetch(`${getBaseUrl()}/search?${params}`, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'X-Places-Api-Version': '2025-06-17',
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    console.error('Foursquare API error:', response.status, await response.text())
    return []
  }

  const data: FsqSearchResponse = await response.json()

  return data.results.map((p) => {
    const place = toPlace(p, category)
    if (place.distance == null && place.latitude && place.longitude) {
      place.distance = calculateDistance(lat, lng, place.latitude, place.longitude)
    }
    return place
  })
}
