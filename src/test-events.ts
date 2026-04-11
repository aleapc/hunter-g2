/**
 * Hunter G2 — state and logic tests.
 * Run with: npx tsx src/test-events.ts
 */

import {
  initialState,
  DEFAULT_ENABLED_CATEGORIES,
  ALL_CATEGORIES,
  RESTAURANT_SUBCATEGORIES,
  CATEGORY_TO_OSM_TAGS,
  FAVORITES_CATEGORY,
  FAVORITES_MENU_ITEM,
  getEnabledMenu,
  getCategoryLabel,
} from './state'
import type { HunterState, Place } from './state'
import {
  makeCacheKey,
  getCached,
  getStale,
  setCached,
} from './cache'
import {
  loadFavorites,
  addFavorite,
  removeFavorite,
  isFavorite,
  toggleFavorite,
} from './favorites'
import { calculateDistance, getCardinalDirection, getDirectionArrow } from './utils/geo'
import { setLocale, getLocale, t } from './i18n'
import type { Locale, TranslationKey } from './i18n'

// ── Test runner ──

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

function group(name: string, fn: () => void | Promise<void>): void | Promise<void> {
  console.log(`\n[${name}]`)
  return fn()
}

function freshState(): HunterState {
  return {
    ...initialState,
    enabledCategories: [...initialState.enabledCategories],
    favorites: [],
    places: [],
    userLocation: { lat: -22.9068, lng: -43.1729, label: 'Rio' },
  }
}

// ── Mock storage bridge ──

function makeMockBridge() {
  const store = new Map<string, string>()
  return {
    getLocalStorage: (key: string) => Promise.resolve(store.get(key) ?? ''),
    setLocalStorage: (key: string, value: string) => {
      store.set(key, value)
      return Promise.resolve(true)
    },
    _store: store,
  } as any
}

// ── Tests ──

async function run(): Promise<void> {
  console.log('\n=== Hunter G2 State & Logic Tests ===')

  group('State defaults', () => {
    const s = freshState()
    assert(s.screen === 'categories', 'starts on categories')
    assert(s.isLoading === false, 'not loading')
    assert(s.isFirstRender === true, 'first render flag set')
    assert(s.enabledCategories.length === 7, '7 default enabled categories')
    assert(s.searchRadius === 2000, 'default radius 2000')
    assert(s.places.length === 0, 'no places')
    assert(s.favorites.length === 0, 'no favorites')
    assert(s.selectedCategory === null, 'no category selected')
    assert(s.viewMode === 'results', 'viewMode = results')
    assert(s.batteryLevel === null, 'battery null')
    assert(s.isWearing === null, 'isWearing null')
  })

  group('DEFAULT_ENABLED_CATEGORIES content', () => {
    assert(DEFAULT_ENABLED_CATEGORIES.includes('restaurant'), 'has restaurant')
    assert(DEFAULT_ENABLED_CATEGORIES.includes('cafe'), 'has cafe')
    assert(DEFAULT_ENABLED_CATEGORIES.includes('pharmacy'), 'has pharmacy')
    assert(DEFAULT_ENABLED_CATEGORIES.length === 7, 'exactly 7')
  })

  group('Screen transitions: categories → subcategories → results → details', () => {
    const s = freshState()
    assert(s.screen === 'categories', 'start: categories')

    s.selectedCategory = 'restaurant'
    s.screen = 'subcategories'
    assert(s.screen === 'subcategories', 'categories → subcategories')

    s.selectedSubcategory = 'cuisine=japanese'
    s.places = [
      { id: '1', name: 'Sushi A', latitude: 0, longitude: 0, category: 'restaurant' },
      { id: '2', name: 'Sushi B', latitude: 0, longitude: 0, category: 'restaurant' },
    ]
    s.screen = 'results'
    assert(s.screen === 'results', 'subcategories → results')

    s.selectedPlace = s.places[0]
    s.screen = 'details'
    assert(s.screen === 'details', 'results → details')
    assert(s.selectedPlace?.name === 'Sushi A', 'selected place tracked')

    // Double-tap → home
    s.screen = 'categories'
    s.selectedCategory = null
    s.selectedPlace = null
    assert(s.screen === 'categories', 'double-tap returns to categories')
  })

  // ── Event parsing (replicated logic mirroring glasses/events.ts) ──

  function normalizeEventType(raw: unknown): number {
    if (raw === undefined || raw === null) return 0 // SDK quirk: missing → click
    if (typeof raw === 'number') return raw
    if (typeof raw === 'string') {
      const n = parseInt(raw, 10)
      if (!Number.isNaN(n)) return n
      if (raw === 'FOREGROUND_ENTER_EVENT' || raw === 'FOREGROUND_ENTER') return 4
      if (raw === 'FOREGROUND_EXIT_EVENT' || raw === 'FOREGROUND_EXIT') return 5
      return 0
    }
    return -1
  }

  function evtTypeToAction(t: number): string {
    if (t === 3) return 'doubleClick'
    if (t === 0) return 'click'
    if (t === 1) return 'scrollUp'
    if (t === 2) return 'scrollDown'
    if (t === 4) return 'foregroundEnter'
    if (t === 5) return 'foregroundExit'
    return 'unknown'
  }

  group('Event parsing: normalizeEventType', () => {
    assert(normalizeEventType(undefined) === 0, 'undefined → 0 (click)')
    assert(normalizeEventType(null) === 0, 'null → 0')
    assert(normalizeEventType(3) === 3, '3 → 3')
    assert(normalizeEventType('3') === 3, '"3" → 3')
    assert(normalizeEventType('FOREGROUND_ENTER') === 4, 'named string → 4')
    assert(normalizeEventType({}) === -1, 'object → -1')
  })

  group('Event parsing: action mapping', () => {
    assert(evtTypeToAction(0) === 'click', '0 → click')
    assert(evtTypeToAction(3) === 'doubleClick', '3 → doubleClick')
    assert(evtTypeToAction(1) === 'scrollUp', '1 → scrollUp')
    assert(evtTypeToAction(2) === 'scrollDown', '2 → scrollDown')
  })

  group('sysEvent fallback', () => {
    // sysEvent with eventType 0 = click on first item
    const ev = { sysEvent: { eventType: 0, currentSelectItemIndex: 0, containerName: 'catlist' } }
    const action = evtTypeToAction(normalizeEventType((ev as any).sysEvent.eventType))
    assert(action === 'click', 'sysEvent eventType 0 → click')

    // sysEvent missing eventType → defaults to click (SDK quirk)
    const ev2 = { sysEvent: { containerName: 'catlist', currentSelectItemIndex: 0 } }
    const action2 = evtTypeToAction(normalizeEventType((ev2 as any).sysEvent.eventType))
    assert(action2 === 'click', 'sysEvent missing eventType → click')

    // List container missing index falls back to 0
    const sub: any = ev2.sysEvent
    const idx = sub.currentSelectItemIndex ?? (['catlist', 'sublist', 'reslist'].includes(sub.containerName) ? 0 : undefined)
    assert(idx === 0, 'list-container index defaults to 0')
  })

  // ── Scroll cooldown ──

  group('Scroll cooldown (300ms)', () => {
    const COOLDOWN = 300
    let lastEventTime = 0

    function tryScroll(now: number): boolean {
      if (now - lastEventTime < COOLDOWN) return false
      lastEventTime = now
      return true
    }

    assert(tryScroll(1000) === true, 'first scroll accepted')
    assert(tryScroll(1100) === false, 'scroll @+100ms ignored (cooldown)')
    assert(tryScroll(1299) === false, 'scroll @+299ms ignored')
    assert(tryScroll(1301) === true, 'scroll @+301ms accepted')
    assert(tryScroll(1500) === false, 'scroll @+199ms after last accepted ignored')
  })

  // ── Cache logic ──

  await group('Cache: makeCacheKey + set/get/miss/TTL', async () => {
    const bridge = makeMockBridge()
    const key = makeCacheKey('cafe', -22.9068, -43.1729, 2000)
    assert(typeof key === 'string' && key.length > 0, 'key generated')
    assert(key.includes('cafe'), 'key contains category')
    assert(key.includes('2000'), 'key contains radius')

    // Subcategory variant
    const k2 = makeCacheKey('restaurant', 0, 0, 1000, 'cuisine=japanese')
    assert(k2.includes('cuisine=japanese'), 'subcategory in key')
    assert(k2 !== makeCacheKey('restaurant', 0, 0, 1000), 'subcategory key differs')

    // Miss
    const miss = await getCached(bridge, key)
    assert(miss === null, 'cold cache miss returns null')

    // Set + hit
    const places: Place[] = [
      { id: 'a', name: 'A', latitude: 0, longitude: 0, category: 'cafe' },
    ]
    await setCached(bridge, key, places)
    const hit = await getCached(bridge, key)
    assert(hit !== null && hit.length === 1, 'cache hit returns places')
    assert(hit?.[0].id === 'a', 'cached place data preserved')

    // Stale within 24h still returns
    const stale = await getStale(bridge, key)
    assert(stale !== null && stale.length === 1, 'stale fetch returns within 24h')

    // Simulated TTL expiry: rewrite the entry with old timestamp
    const raw = await bridge.getLocalStorage('hunter_search_cache')
    const map = JSON.parse(raw)
    map[key].timestamp = Date.now() - (31 * 60 * 1000) // 31 min ago > 30min TTL
    await bridge.setLocalStorage('hunter_search_cache', JSON.stringify(map))
    const expired = await getCached(bridge, key)
    assert(expired === null, 'TTL-expired entry returns null')
    const stillStale = await getStale(bridge, key)
    assert(stillStale !== null, 'still within stale window after fresh TTL expires')
  })

  // ── Favorites ──

  await group('Favorites: add/remove/isFavorite/dedup', async () => {
    const bridge = makeMockBridge()
    const place: Place = { id: 'p1', name: 'P', latitude: 1, longitude: 2, category: 'cafe' }

    let list = await loadFavorites(bridge)
    assert(list.length === 0, 'empty initially')

    await addFavorite(bridge, place)
    list = await loadFavorites(bridge)
    assert(list.length === 1, 'add → 1 favorite')

    // Dedup: adding same id twice keeps 1
    await addFavorite(bridge, { ...place, name: 'duplicated' })
    list = await loadFavorites(bridge)
    assert(list.length === 1, 'dedup by id (no second copy)')

    assert((await isFavorite(bridge, place)) === true, 'isFavorite true')

    // Toggle off
    const after = await toggleFavorite(bridge, place)
    assert(after === false, 'toggle off returns false')
    list = await loadFavorites(bridge)
    assert(list.length === 0, 'list empty after toggle off')

    // Toggle on
    const after2 = await toggleFavorite(bridge, place)
    assert(after2 === true, 'toggle on returns true')
    list = await loadFavorites(bridge)
    assert(list.length === 1, '1 favorite after toggle on')

    await removeFavorite(bridge, place)
    list = await loadFavorites(bridge)
    assert(list.length === 0, 'remove clears it')
    assert((await isFavorite(bridge, place)) === false, 'isFavorite false after remove')
  })

  // ── Geo ──

  group('Geo: haversine distance', () => {
    // Same point
    assert(calculateDistance(0, 0, 0, 0) === 0, 'same point = 0')

    // Approx 111km per degree latitude
    const d1 = calculateDistance(0, 0, 1, 0)
    assert(Math.abs(d1 - 111195) < 100, '~111km per degree lat')

    // Rio → São Paulo ~360km
    const dRioSp = calculateDistance(-22.9068, -43.1729, -23.5505, -46.6333)
    assert(dRioSp > 350_000 && dRioSp < 400_000, 'Rio→SP ≈ 360km')
  })

  group('Geo: cardinal direction', () => {
    const from = { lat: 0, lng: 0 }
    assert(getCardinalDirection(from, 1, 0) === 'N', 'N (lat+)')
    assert(getCardinalDirection(from, -1, 0) === 'S', 'S (lat-)')
    assert(getCardinalDirection(from, 0, 1) === 'E', 'E (lng+)')
    assert(getCardinalDirection(from, 0, -1) === 'W', 'W (lng-)')
    assert(getCardinalDirection(from, 1, 1) === 'NE', 'NE (lat+, lng+)')
    assert(getCardinalDirection(from, -1, 1) === 'SE', 'SE')
    assert(getCardinalDirection(from, -1, -1) === 'SW', 'SW')
    assert(getCardinalDirection(from, 1, -1) === 'NW', 'NW')

    assert(getDirectionArrow('N').length > 0, 'N arrow exists')
    assert(getDirectionArrow('NE').length > 0, 'NE arrow exists')
    assert(getDirectionArrow('XYZ') === '', 'unknown → empty')
  })

  // ── Category-to-OSM mapping ──

  group('CATEGORY_TO_OSM_TAGS coverage', () => {
    let missing = 0
    for (const item of ALL_CATEGORIES) {
      const tags = CATEGORY_TO_OSM_TAGS[item.category]
      if (!tags || tags.length === 0) {
        missing++
        console.error(`  missing OSM tag for: ${item.category}`)
      }
    }
    assert(missing === 0, `all ${ALL_CATEGORIES.length} categories map to OSM tags`)
    assert(CATEGORY_TO_OSM_TAGS.restaurant[0] === 'amenity=restaurant', 'restaurant → amenity=restaurant')
    assert(CATEGORY_TO_OSM_TAGS.bar.length === 2, 'bar maps to 2 tags (bar+pub)')
  })

  group('getEnabledMenu pins favorites on top', () => {
    const s = freshState()
    const menu = getEnabledMenu(s)
    assert(menu[0].category === FAVORITES_CATEGORY, 'first item is favorites')
    assert(menu.length === s.enabledCategories.length + 1, 'menu = enabled + 1 (favorites)')
    assert(FAVORITES_MENU_ITEM.category === FAVORITES_CATEGORY, 'favorites menu item exists')
  })

  group('getCategoryLabel', () => {
    setLocale('en')
    assert(getCategoryLabel('restaurant').length > 0, 'restaurant has label')
    assert(getCategoryLabel('atm') === 'ATM', 'atm uses literal label')
    assert(getCategoryLabel('nonexistent') === 'nonexistent', 'unknown returns key')
  })

  group('RESTAURANT_SUBCATEGORIES content', () => {
    assert(RESTAURANT_SUBCATEGORIES.length === 7, '7 subcategories')
    const types = RESTAURANT_SUBCATEGORIES.map((s) => s.type)
    assert(types.includes('cuisine=japanese'), 'has japanese')
    assert(types.includes('amenity=fast_food'), 'has fast_food')
    assert(types.includes('amenity=restaurant'), 'has all (catch-all)')
  })

  // ── i18n ──

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
    for (const loc of LOCALES) {
      setLocale(loc)
      let missing = 0
      for (const key of ALL_KEYS) {
        const v = t(key)
        if (!v || typeof v !== 'string') missing++
      }
      assert(missing === 0, `${loc}: all ${ALL_KEYS.length} keys present`)
    }
    setLocale(original)
  })

  group('i18n setLocale roundtrip', () => {
    setLocale('pt')
    assert(getLocale() === 'pt', 'pt set')
    setLocale('en')
    assert(getLocale() === 'en', 'en set')
    setLocale('es')
    assert(getLocale() === 'es', 'es set')
  })

  // ── Summary ──

  console.log(`\n${'='.repeat(40)}`)
  console.log(`Results: ${passed} passed, ${failed} failed`)
  console.log(`${'='.repeat(40)}\n`)

  process.exit(failed > 0 ? 1 : 0)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
