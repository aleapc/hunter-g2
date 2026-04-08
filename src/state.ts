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

// Foursquare category IDs (BSON hex format, accepted by v3 API)
export const RESTAURANT_SUBCATEGORIES: SubcategoryItem[] = [
  { label: 'Japonesa', type: '4bf58dd8d48988d111941735' },
  { label: 'Italiana', type: '4bf58dd8d48988d110941735' },
  { label: 'Brasileira', type: '4bf58dd8d48988d16b941735' },
  { label: 'Pizza', type: '4bf58dd8d48988d1ca941735' },
  { label: 'Fast Food', type: '4bf58dd8d48988d16e941735' },
  { label: 'Mexicana', type: '4bf58dd8d48988d1c1941735' },
  { label: 'Todos', type: '4bf58dd8d48988d1c4941735' },
]

export const CATEGORY_TO_FSQ_IDS: Record<PlaceCategory, string> = {
  restaurant: '4bf58dd8d48988d1c4941735',
  cafe: '4bf58dd8d48988d16d941735,4bf58dd8d48988d1e0931735',
  bar: '4bf58dd8d48988d116941735,4bf58dd8d48988d11b941735',
  ice_cream: '4bf58dd8d48988d1c9941735',
  gas_station: '4bf58dd8d48988d113951735',
  pharmacy: '4bf58dd8d48988d10f951735',
  supermarket: '52f2ab2ebcbc57f1066b8b46,4bf58dd8d48988d118951735,4d954b0ea243a5684a65b473',
}
