export type PlaceCategory =
  | 'restaurant'
  | 'cafe'
  | 'bar'
  | 'ice_cream'
  | 'gas_station'
  | 'pharmacy'
  | 'supermarket'

export interface Place {
  id: string
  name: string
  latitude: number
  longitude: number
  category: PlaceCategory
  rating?: number
  userRatingsTotal?: number
  priceLevel?: number
  address?: string
  distance?: number
  isOpen?: boolean
}

export type Screen = 'categories' | 'subcategories' | 'results' | 'details'

export interface UserLocation {
  lat: number
  lng: number
  label?: string
}

export interface HunterState {
  screen: Screen
  selectedCategory: PlaceCategory | null
  selectedSubcategory: string | null
  places: Place[]
  selectedPlace: Place | null
  userLocation: UserLocation | null
  searchRadius: number
  isLoading: boolean
  isFirstRender: boolean
}

export const initialState: HunterState = {
  screen: 'categories',
  selectedCategory: null,
  selectedSubcategory: null,
  places: [],
  selectedPlace: null,
  userLocation: null,
  searchRadius: 2000,
  isLoading: false,
  isFirstRender: true,
}

export interface CategoryMenuItem {
  label: string
  category: PlaceCategory
  hasSubcategories: boolean
}

export const CATEGORY_MENU: CategoryMenuItem[] = [
  { label: 'Restaurante', category: 'restaurant', hasSubcategories: true },
  { label: 'Cafe', category: 'cafe', hasSubcategories: false },
  { label: 'Bar', category: 'bar', hasSubcategories: false },
  { label: 'Sorvete', category: 'ice_cream', hasSubcategories: false },
  { label: 'Gasolina', category: 'gas_station', hasSubcategories: false },
  { label: 'Farmacia', category: 'pharmacy', hasSubcategories: false },
  { label: 'Supermercado', category: 'supermarket', hasSubcategories: false },
]

export interface SubcategoryItem {
  label: string
  type: string
}

// OSM tags: cuisine=* values for restaurant subcategories
export const RESTAURANT_SUBCATEGORIES: SubcategoryItem[] = [
  { label: 'Japonesa', type: 'cuisine=japanese' },
  { label: 'Italiana', type: 'cuisine=italian' },
  { label: 'Brasileira', type: 'cuisine=brazilian' },
  { label: 'Pizza', type: 'cuisine=pizza' },
  { label: 'Fast Food', type: 'amenity=fast_food' },
  { label: 'Mexicana', type: 'cuisine=mexican' },
  { label: 'Todos', type: 'amenity=restaurant' },
]

// OSM amenity/shop tags for each category
export const CATEGORY_TO_OSM_TAGS: Record<PlaceCategory, string[]> = {
  restaurant: ['amenity=restaurant'],
  cafe: ['amenity=cafe'],
  bar: ['amenity=bar', 'amenity=pub'],
  ice_cream: ['amenity=ice_cream', 'cuisine=ice_cream'],
  gas_station: ['amenity=fuel'],
  pharmacy: ['amenity=pharmacy'],
  supermarket: ['shop=supermarket', 'shop=convenience'],
}
