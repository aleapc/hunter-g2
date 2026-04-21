/**
 * Hunter G2 — state and logic tests
 * Run: npx tsx src/test-events.ts
 */

import {
  initialState,
  ALL_CATEGORIES,
  CATEGORY_TO_OSM_TAGS,
  RESTAURANT_SUBCATEGORIES,
  FAVORITES_CATEGORY,
  getEnabledMenu,
  DEFAULT_ENABLED_CATEGORIES,
} from './state'
import type { HunterState, Screen } from './state'
import { calculateDistance, getCardinalDirection, getDirectionArrow } from './utils/geo'
import { formatDistance, formatRating, formatPriceLevel, truncate, padRight } from './utils/format'
import { makeCacheKey } from './cache'
import { setLocale, getLocale, t } from './i18n'
import type { Locale, TranslationKey } from './i18n'

let passed = 0
let failed = 0

function assert(condition: boolean, msg: string): void {
  if (condition) {
    passed++
    console.log(`  PASS: ${msg}`)
  } else {
    failed++
    console.error(`  FAIL: ${msg}`)
  }
}

function group(name: string, fn: () => void): void {
  console.log(`\n[${name}]`)
  fn()
}

function makeState(): HunterState {
  return {
    ...initialState,
    enabledCategories: [...initialState.enabledCategories],
    places: [],
    favorites: [],
  }
}

// ─── State defaults ────────────────────────────────────────

group('State defaults', () => {
  const s = makeState()
  assert(s.screen === 'categories', 'Initial screen is categories')
  assert(s.selectedCategory === null, 'No selected category')
  assert(s.selectedSubcategory === null, 'No selected subcategory')
  assert(s.places.length === 0, 'No places initially')
  assert(s.selectedPlace === null, 'No selected place')
  assert(s.userLocation === null, 'No user location')
  assert(s.searchRadius === 2000, 'Default search radius = 2000')
  assert(s.isLoading === false, 'Not loading initially')
  assert(s.isFirstRender === true, 'First render flag set')
  assert(s.favorites.length === 0, 'No favorites initially')
  assert(s.currentRoute === null, 'No route initially')
  assert(s.currentStep === 0, 'Current step = 0')
  assert(s.viewMode === 'results', 'Default viewMode = results')
})

// ─── Screen transitions ───────────────────────────────────

group('Screen transitions', () => {
  const s = makeState()
  assert(s.screen === 'categories', 'Start at categories')

  s.screen = 'subcategories'
  s.selectedCategory = 'restaurant'
  assert(s.screen === 'subcategories', 'categories -> subcategories')

  s.screen = 'results'
  s.selectedSubcategory = 'cuisine=japanese'
  assert(s.screen === 'results', 'subcategories -> results')

  s.screen = 'details'
  s.selectedPlace = {
    id: '1', name: 'Test Place', latitude: 0, longitude: 0,
    category: 'restaurant', distance: 100,
  }
  assert(s.screen === 'details', 'results -> details')

  s.screen = 'route'
  assert(s.screen === 'route', 'details -> route')

  s.screen = 'categories'
  s.selectedCategory = null
  s.selectedSubcategory = null
  s.selectedPlace = null
  assert(s.screen === 'categories', 'Back to categories')
})

// ─── Haversine distance ───────────────────────────────────

group('Haversine distance', () => {
  assert(calculateDistance(0, 0, 0, 0) === 0, 'Same point = 0m')

  const nyToLa = calculateDistance(40.7128, -74.0060, 34.0522, -118.2437)
  assert(nyToLa > 3900000 && nyToLa < 4000000, `NY-LA ~3950km (got ${nyToLa}m)`)

  const lonToPar = calculateDistance(51.5074, -0.1278, 48.8566, 2.3522)
  assert(lonToPar > 330000 && lonToPar < 360000, `London-Paris ~340km (got ${lonToPar}m)`)

  const oneDeg = calculateDistance(0, 0, 1, 0)
  assert(oneDeg > 110000 && oneDeg < 112000, `1 degree lat ~111km (got ${oneDeg}m)`)
})

// ─── Cardinal direction ───────────────────────────────────

group('Cardinal direction', () => {
  const from = { lat: 0, lng: 0 }
  assert(getCardinalDirection(from, 1, 0) === 'N', 'Due north')
  assert(getCardinalDirection(from, -1, 0) === 'S', 'Due south')
  assert(getCardinalDirection(from, 0, 1) === 'E', 'Due east')
  assert(getCardinalDirection(from, 0, -1) === 'W', 'Due west')
  assert(getCardinalDirection(from, 1, 1) === 'NE', 'Northeast')
  assert(getCardinalDirection(from, -1, 1) === 'SE', 'Southeast')
  assert(getCardinalDirection(from, -1, -1) === 'SW', 'Southwest')
  assert(getCardinalDirection(from, 1, -1) === 'NW', 'Northwest')
})

group('Direction arrows', () => {
  assert(getDirectionArrow('N') === '\u2191', 'N arrow')
  assert(getDirectionArrow('E') === '\u2192', 'E arrow')
  assert(getDirectionArrow('S') === '\u2193', 'S arrow')
  assert(getDirectionArrow('W') === '\u2190', 'W arrow')
  assert(getDirectionArrow('INVALID') === '', 'Invalid direction returns empty')
})

// ─── Format distance ─────────────────────────────────────

group('formatDistance', () => {
  assert(formatDistance(500) === '500m', '500m')
  assert(formatDistance(0) === '0m', '0m')
  assert(formatDistance(999) === '999m', '999m')
  assert(formatDistance(1000) === '1.0km', '1000m = 1.0km')
  assert(formatDistance(2500) === '2.5km', '2500m = 2.5km')
  assert(formatDistance(10300) === '10.3km', '10300m = 10.3km')
})

// ─── Format rating ────────────────────────────────────────

group('formatRating', () => {
  assert(formatRating(undefined) === '-----', 'undefined = dashes')
  assert(formatRating(5).includes('\u2605'), '5 stars has full star char')
  assert(formatRating(0).length === 5, '0 rating = 5 empty stars')
  const r3 = formatRating(3)
  assert(r3.startsWith('\u2605\u2605\u2605'), '3.0 starts with 3 full stars')
})

// ─── Format price level ───────────────────────────────────

group('formatPriceLevel', () => {
  assert(formatPriceLevel(undefined) === '', 'undefined = empty')
  assert(formatPriceLevel(0) === 'Free', '0 = Free')
  assert(formatPriceLevel(2) === '$$', '2 = $$')
  assert(formatPriceLevel(4) === '$$$$', '4 = $$$$')
})

// ─── Truncate + padRight ──────────────────────────────────

group('truncate', () => {
  assert(truncate('hello', 10) === 'hello', 'Short text unchanged')
  assert(truncate('hello world!', 7) === 'hello..', '12 chars -> 7 with ..')
  assert(truncate('ab', 2) === 'ab', 'Exact length unchanged')
})

group('padRight', () => {
  assert(padRight('hi', 5) === 'hi   ', 'Padded to 5')
  assert(padRight('hello', 3) === 'hello', 'Longer text unchanged')
  assert(padRight('', 3) === '   ', 'Empty -> 3 spaces')
})

// ─── Category-to-OSM tag coverage ─────────────────────────

group('Category-to-OSM tag coverage', () => {
  let allHaveTags = true
  for (const cat of ALL_CATEGORIES) {
    const tags = CATEGORY_TO_OSM_TAGS[cat.category]
    if (!tags || tags.length === 0) {
      console.error(`  Missing OSM tags for category: ${cat.category}`)
      allHaveTags = false
    }
  }
  assert(allHaveTags, 'All categories have OSM tags')
  assert(Object.keys(CATEGORY_TO_OSM_TAGS).length >= ALL_CATEGORIES.length,
    'Tag map covers all categories')
})

// ─── Cache key generation ─────────────────────────────────

group('Cache key generation', () => {
  const k1 = makeCacheKey('restaurant', 40.7128, -74.006, 2000)
  assert(k1.includes('restaurant'), 'Contains category')
  assert(k1.includes('40.713'), 'Lat rounded to 3 decimals')
  assert(k1.includes('2000'), 'Contains radius')

  const k2 = makeCacheKey('restaurant', 40.7128, -74.006, 2000, 'cuisine=japanese')
  assert(k2.includes('cuisine=japanese'), 'Contains subcategory')
  assert(k1 !== k2, 'Different keys with/without subcategory')

  const k3 = makeCacheKey('restaurant', 41.0, -74.006, 2000)
  assert(k1 !== k3, 'Different lat = different key')
})

// ─── Enabled menu ─────────────────────────────────────────

group('Enabled menu', () => {
  const s = makeState()
  const menu = getEnabledMenu(s)
  assert(menu[0].category === FAVORITES_CATEGORY, 'First item is Favorites')
  assert(menu.length === DEFAULT_ENABLED_CATEGORIES.length + 1, 'All enabled + Favorites')
})

// ─── i18n key coverage ────────────────────────────────────

const ALL_KEYS: TranslationKey[] = [
  'cat_restaurant', 'cat_cafe', 'cat_bar', 'cat_ice_cream',
  'cat_gas_station', 'cat_pharmacy', 'cat_supermarket',
  'sub_japanese', 'sub_italian', 'sub_brazilian', 'sub_pizza',
  'sub_fast_food', 'sub_mexican', 'sub_all',
  'no_results', 'loading', 'no_location', 'back_hint',
  'open', 'closed', 'header_restaurant', 'price_free',
  'app_title', 'app_subtitle', 'location_title', 'use_gps',
  'locating', 'gps_fail', 'city_placeholder', 'manual_location',
  'search_radius', 'categories_title', 'categories_edit', 'usage_hint',
]
const LOCALES: Locale[] = ['pt', 'en', 'es']

group('i18n key coverage (all 3 locales)', () => {
  const original = getLocale()
  let totalMissing = 0
  for (const loc of LOCALES) {
    setLocale(loc)
    let missing = 0
    for (const key of ALL_KEYS) {
      const v = t(key)
      if (!v || typeof v !== 'string') missing++
    }
    assert(missing === 0, `${loc}: all ${ALL_KEYS.length} keys present`)
    totalMissing += missing
  }
  assert(totalMissing === 0, 'No missing keys across all locales')
  setLocale(original)
})

group('i18n setLocale / getLocale roundtrip', () => {
  setLocale('pt')
  assert(getLocale() === 'pt', 'pt set')
  setLocale('en')
  assert(getLocale() === 'en', 'en set')
  setLocale('es')
  assert(getLocale() === 'es', 'es set')
  setLocale('en')
})

// ─── Summary ──────────────────────────────────────────────

console.log(`\n${'='.repeat(40)}`)
console.log(`Results: ${passed} passed, ${failed} failed`)
console.log(`${'='.repeat(40)}\n`)

process.exit(failed > 0 ? 1 : 0)
