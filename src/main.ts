import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk'
import { createRoot } from 'react-dom/client'
import { createElement } from 'react'
import { App } from './app'
import { initialState } from './state'
import type { HunterState, PlaceCategory } from './state'
import { renderScreen } from './glasses/renderer'
import { setupEventHandler } from './glasses/events'
import { getUserLocation } from './utils/geo'

const state: HunterState = { ...initialState }

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

  // Setup glasses event handler
  setupEventHandler(bridge, state)

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
