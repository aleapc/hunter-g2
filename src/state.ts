import { t } from './i18n'
import type { TranslationKey } from './i18n'

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
  labelKey: TranslationKey
  category: PlaceCategory
  hasSubcategories: boolean
}

export const CATEGORY_MENU: CategoryMenuItem[] = [
  { labelKey: 'cat_restaurant', category: 'restaurant', hasSubcategories: true },
  { labelKey: 'cat_cafe', category: 'cafe', hasSubcategories: false },
  { labelKey: 'cat_bar', category: 'bar', hasSubcategories: false },
  { labelKey: 'cat_ice_cream', category: 'ice_cream', hasSubcategories: false },
  { labelKey: 'cat_gas_station', category: 'gas_station', hasSubcategories: false },
  { labelKey: 'cat_pharmacy', category: 'pharmacy', hasSubcategories: false },
  { labelKey: 'cat_supermarket', category: 'supermarket', hasSubcategories: false },
]

export interface SubcategoryItem {
  labelKey: TranslationKey
  type: string
}

// OSM tags: cuisine=* values for restaurant subcategories
export const RESTAURANT_SUBCATEGORIES: SubcategoryItem[] = [
  { labelKey: 'sub_japanese', type: 'cuisine=japanese' },
  { labelKey: 'sub_italian', type: 'cuisine=italian' },
  { labelKey: 'sub_brazilian', type: 'cuisine=brazilian' },
  { labelKey: 'sub_pizza', type: 'cuisine=pizza' },
  { labelKey: 'sub_fast_food', type: 'amenity=fast_food' },
  { labelKey: 'sub_mexican', type: 'cuisine=mexican' },
  { labelKey: 'sub_all', type: 'amenity=restaurant' },
]

// Helper to get translated label
export function getCategoryLabel(category: PlaceCategory): string {
  const item = CATEGORY_MENU.find((c) => c.category === category)
  return item ? t(item.labelKey) : ''
}

export function getSubcategoryLabel(type: string): string {
  const item = RESTAURANT_SUBCATEGORIES.find((s) => s.type === type)
  return item ? t(item.labelKey) : ''
}

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
