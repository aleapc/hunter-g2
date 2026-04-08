import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk'
import { createRoot } from 'react-dom/client'
import { createElement } from 'react'
import { App } from './app'
import { initialState } from './state'
import type { HunterState } from './state'
import { renderScreen } from './glasses/renderer'
import { setupEventHandler } from './glasses/events'

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
