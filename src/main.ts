import './telemetry' // self-initializes error listeners
import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk'
import { createRoot } from 'react-dom/client'
import { createElement } from 'react'
import { App } from './app'
import { initialState } from './state'
import type { HunterState, PlaceCategory } from './state'
import { renderScreen } from './glasses/renderer'
import {
  setupEventHandler,
  abortInFlightSearch,
  performSearchWith,
} from './glasses/events'
import { getUserLocation } from './utils/geo'
import { loadFavorites } from './favorites'

const state: HunterState = { ...initialState }

const LAST_SEARCH_KEY = 'hunter_last_search'

interface SavedSearch {
  screen: HunterState['screen']
  category: string | null
  subcategory: string | null
}

async function saveLastSearch(bridge: { setLocalStorage: (k: string, v: string) => Promise<boolean> }) {
  const snapshot: SavedSearch = {
    screen: state.screen,
    category: state.selectedCategory,
    subcategory: state.selectedSubcategory,
  }
  try {
    await bridge.setLocalStorage(LAST_SEARCH_KEY, JSON.stringify(snapshot))
  } catch {
    /* ignore */
  }
}

async function restoreLastSearch(bridge: {
  getLocalStorage: (k: string) => Promise<string>
}): Promise<void> {
  try {
    const raw = await bridge.getLocalStorage(LAST_SEARCH_KEY)
    if (!raw) return
    const snap = JSON.parse(raw) as SavedSearch
    if (snap.category) state.selectedCategory = snap.category
    if (snap.subcategory) state.selectedSubcategory = snap.subcategory
    if (snap.screen) state.screen = snap.screen
  } catch {
    /* ignore */
  }
}

async function init() {
  const bridge = await waitForEvenAppBridge()

  // Load persisted location
  const savedLocation = await bridge.getLocalStorage('hunter_location')
  if (savedLocation) {
    try {
      state.userLocation = JSON.parse(savedLocation)
    } catch { /* ignore */ }
  }

  const savedRadius = await bridge.getLocalStorage('hunter_radius')
  if (savedRadius) {
    const r = parseInt(savedRadius, 10)
    if (!isNaN(r)) state.searchRadius = r
  }

  // Load favorites (used for the star indicator on details screen)
  try {
    state.favorites = await loadFavorites(bridge)
  } catch { /* ignore */ }

  // Load enabled categories
  const savedCategories = await bridge.getLocalStorage('hunter_categories')
  if (savedCategories) {
    try {
      const cats = JSON.parse(savedCategories) as PlaceCategory[]
      if (cats.length > 0) state.enabledCategories = cats
    } catch { /* ignore */ }
  }

  // Auto-detect GPS if no saved location
  if (!state.userLocation) {
    try {
      const loc = await getUserLocation()
      loc.label = 'GPS'
      state.userLocation = loc
      await bridge.setLocalStorage('hunter_location', JSON.stringify(loc))
    } catch {
      console.warn('GPS auto-detect failed, user must set location manually')
    }
  }

  // Device info: seed battery + wearing state
  try {
    const device = await bridge.getDeviceInfo()
    if (device?.status) {
      if (typeof device.status.batteryLevel === 'number') {
        state.batteryLevel = device.status.batteryLevel
      }
      if (typeof device.status.isWearing === 'boolean') {
        state.isWearing = device.status.isWearing
      }
    }
  } catch (err) {
    console.warn('getDeviceInfo failed:', err)
  }

  // Subscribe to live status changes
  try {
    bridge.onDeviceStatusChanged((status) => {
      let changed = false
      if (typeof status.batteryLevel === 'number' && status.batteryLevel !== state.batteryLevel) {
        state.batteryLevel = status.batteryLevel
        changed = true
      }
      if (typeof status.isWearing === 'boolean' && status.isWearing !== state.isWearing) {
        state.isWearing = status.isWearing
        changed = true
      }
      // If battery changed and we're currently on results, refresh the header
      if (changed && state.screen === 'results' && !state.isLoading) {
        renderScreen(bridge, state)
      }
    })
  } catch (err) {
    console.warn('onDeviceStatusChanged subscribe failed:', err)
  }

  // Setup glasses event handler with lifecycle callbacks. Double-tap on the
  // root (categories) is the canonical graceful-exit path; triple-tap handler
  // is no longer registered.
  setupEventHandler(bridge, state, {
    onForegroundExit: async () => {
      // Cancel any in-flight search and persist state so we can resume later
      abortInFlightSearch()
      await saveLastSearch(bridge)
    },
    onForegroundEnter: () => {
      restoreLastSearch(bridge).then(() => {
        renderScreen(bridge, state)
      })
    },
  })

  // Launch source handling: if invoked from glasses menu, auto-search nearest
  // of the default category (first enabled category without subcategories).
  let autoSearched = false
  try {
    bridge.onLaunchSource((source) => {
      if (source === 'glassesMenu' && !autoSearched) {
        autoSearched = true
        const defaultCat =
          state.enabledCategories.find(
            (c) => c !== 'restaurant',
          ) ?? state.enabledCategories[0]
        if (defaultCat && state.userLocation) {
          performSearchWith(bridge, state, defaultCat).catch((err) => {
            console.warn('auto-search failed:', err)
          })
          return
        }
      }
    })
  } catch (err) {
    console.warn('onLaunchSource subscribe failed:', err)
  }

  // Render initial screen on glasses
  renderScreen(bridge, state)
  state.isFirstRender = false

  // Mount React settings panel on phone
  const appEl = document.getElementById('app')
  if (appEl) {
    const root = createRoot(appEl)
    root.render(createElement(App, { bridge, state }))
  }
}

init().catch(console.error)
