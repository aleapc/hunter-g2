import { t } from './i18n'
import type { TranslationKey } from './i18n'

// PlaceCategory is a string to allow extensibility
export type PlaceCategory = string

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
  enabledCategories: PlaceCategory[]
  isLoading: boolean
  isFirstRender: boolean
  batteryLevel: number | null
  isWearing: boolean | null
}

export const DEFAULT_ENABLED_CATEGORIES: PlaceCategory[] = [
  'restaurant', 'cafe', 'bar', 'ice_cream',
  'gas_station', 'pharmacy', 'supermarket',
]

export const initialState: HunterState = {
  screen: 'categories',
  selectedCategory: null,
  selectedSubcategory: null,
  places: [],
  selectedPlace: null,
  userLocation: null,
  searchRadius: 2000,
  enabledCategories: [...DEFAULT_ENABLED_CATEGORIES],
  isLoading: false,
  isFirstRender: true,
  batteryLevel: null,
  isWearing: null,
}

export interface CategoryMenuItem {
  labelKey?: TranslationKey
  label?: string
  category: PlaceCategory
  hasSubcategories: boolean
}

// Full catalog of available categories
export const ALL_CATEGORIES: CategoryMenuItem[] = [
  // Food & Drink
  { labelKey: 'cat_restaurant', category: 'restaurant', hasSubcategories: true },
  { labelKey: 'cat_cafe', category: 'cafe', hasSubcategories: false },
  { labelKey: 'cat_bar', category: 'bar', hasSubcategories: false },
  { labelKey: 'cat_ice_cream', category: 'ice_cream', hasSubcategories: false },
  { label: 'Bakery', category: 'bakery', hasSubcategories: false },
  { label: 'Fast Food', category: 'fast_food', hasSubcategories: false },
  // Services
  { labelKey: 'cat_gas_station', category: 'gas_station', hasSubcategories: false },
  { labelKey: 'cat_pharmacy', category: 'pharmacy', hasSubcategories: false },
  { labelKey: 'cat_supermarket', category: 'supermarket', hasSubcategories: false },
  { label: 'ATM', category: 'atm', hasSubcategories: false },
  { label: 'Bank', category: 'bank', hasSubcategories: false },
  { label: 'Hospital', category: 'hospital', hasSubcategories: false },
  { label: 'Dentist', category: 'dentist', hasSubcategories: false },
  { label: 'Post Office', category: 'post_office', hasSubcategories: false },
  // Transport
  { label: 'Parking', category: 'parking', hasSubcategories: false },
  { label: 'EV Charging', category: 'ev_charging', hasSubcategories: false },
  { label: 'Car Wash', category: 'car_wash', hasSubcategories: false },
  { label: 'Car Repair', category: 'car_repair', hasSubcategories: false },
  // Leisure
  { label: 'Hotel', category: 'hotel', hasSubcategories: false },
  { label: 'Gym', category: 'gym', hasSubcategories: false },
  { label: 'Park', category: 'park', hasSubcategories: false },
  { label: 'Cinema', category: 'cinema', hasSubcategories: false },
  { label: 'Museum', category: 'museum', hasSubcategories: false },
  // Shopping
  { label: 'Mall', category: 'mall', hasSubcategories: false },
  { label: 'Electronics', category: 'electronics', hasSubcategories: false },
  { label: 'Bookstore', category: 'bookstore', hasSubcategories: false },
  { label: 'Pet Shop', category: 'pet_shop', hasSubcategories: false },
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

// Get active categories in user's order
export function getEnabledMenu(state: HunterState): CategoryMenuItem[] {
  return state.enabledCategories
    .map((cat) => ALL_CATEGORIES.find((c) => c.category === cat))
    .filter((c): c is CategoryMenuItem => c != null)
}

// Helper to get translated label
export function getCategoryLabel(category: PlaceCategory): string {
  const item = ALL_CATEGORIES.find((c) => c.category === category)
  if (!item) return category
  return item.labelKey ? t(item.labelKey) : (item.label ?? category)
}

export function getCategoryDisplayLabel(item: CategoryMenuItem): string {
  return item.labelKey ? t(item.labelKey) : (item.label ?? item.category)
}

export function getSubcategoryLabel(type: string): string {
  const item = RESTAURANT_SUBCATEGORIES.find((s) => s.type === type)
  return item ? t(item.labelKey) : ''
}

// OSM amenity/shop tags for each category
export const CATEGORY_TO_OSM_TAGS: Record<string, string[]> = {
  restaurant: ['amenity=restaurant'],
  cafe: ['amenity=cafe'],
  bar: ['amenity=bar', 'amenity=pub'],
  ice_cream: ['amenity=ice_cream', 'cuisine=ice_cream'],
  gas_station: ['amenity=fuel'],
  pharmacy: ['amenity=pharmacy'],
  supermarket: ['shop=supermarket', 'shop=convenience'],
  bakery: ['shop=bakery'],
  fast_food: ['amenity=fast_food'],
  atm: ['amenity=atm'],
  bank: ['amenity=bank'],
  hospital: ['amenity=hospital', 'amenity=clinic'],
  dentist: ['amenity=dentist'],
  post_office: ['amenity=post_office'],
  parking: ['amenity=parking'],
  ev_charging: ['amenity=charging_station'],
  car_wash: ['amenity=car_wash'],
  car_repair: ['shop=car_repair', 'amenity=car_repair'],
  hotel: ['tourism=hotel', 'tourism=hostel'],
  gym: ['leisure=fitness_centre'],
  park: ['leisure=park'],
  cinema: ['amenity=cinema'],
  museum: ['tourism=museum'],
  mall: ['shop=mall', 'shop=department_store'],
  electronics: ['shop=electronics'],
  bookstore: ['shop=books'],
  pet_shop: ['shop=pet'],
}
