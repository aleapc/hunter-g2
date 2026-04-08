import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import type { HunterState } from '../state'
import { CATEGORY_MENU, RESTAURANT_SUBCATEGORIES } from '../state'
import { searchNearby } from '../api'
import { calculateDistance } from '../utils/geo'
import { renderScreen } from './renderer'

const SCROLL_COOLDOWN = 300
let lastEventTime = 0

type EventType =
  | 'click'
  | 'doubleClick'
  | 'topScroll'
  | 'bottomScroll'
  | 'unknown'

function resolveEventType(event: Record<string, unknown>): {
  type: EventType
  selectedIndex?: number
} {
  // List container events
  if (event.listEvent != null) {
    const le = event.listEvent as Record<string, unknown>
    if (le.selectedIndex != null) {
      return { type: 'click', selectedIndex: le.selectedIndex as number }
    }
  }

  // Text container events
  if (event.textEvent != null) {
    const te = event.textEvent as Record<string, unknown>
    const code = te.eventType as number | string | undefined
    if (code === 1 || code === 'click') return { type: 'click' }
    if (code === 2 || code === 'doubleClick') return { type: 'doubleClick' }
    if (code === 3 || code === 'topScroll') return { type: 'topScroll' }
    if (code === 4 || code === 'bottomScroll') return { type: 'bottomScroll' }
  }

  // System events
  if (event.sysEvent != null) {
    const se = event.sysEvent as Record<string, unknown>
    if (se.eventType === 'doubleClick' || se.eventType === 2) {
      return { type: 'doubleClick' }
    }
  }

  // Flat event format
  if (event.eventType != null) {
    const code = event.eventType as number | string
    if (code === 1 || code === 'click') {
      return {
        type: 'click',
        selectedIndex: event.selectedIndex as number | undefined,
      }
    }
    if (code === 2 || code === 'doubleClick') return { type: 'doubleClick' }
    if (code === 3 || code === 'topScroll') return { type: 'topScroll' }
    if (code === 4 || code === 'bottomScroll') return { type: 'bottomScroll' }
  }

  return { type: 'unknown' }
}

async function performSearch(state: HunterState): Promise<void> {
  if (!state.userLocation) return
  state.isLoading = true

  const subcategoryType = state.selectedSubcategory ?? undefined
  const category = state.selectedCategory!

  const places = await searchNearby(
    state.userLocation.lat,
    state.userLocation.lng,
    category,
    state.searchRadius,
    subcategoryType,
  )

  places.forEach((p) => {
    p.distance = calculateDistance(
      state.userLocation!.lat,
      state.userLocation!.lng,
      p.latitude,
      p.longitude,
    )
  })
  places.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))

  state.places = places
  state.isLoading = false
  state.screen = 'results'
}

export function setupEventHandler(
  bridge: EvenAppBridge,
  state: HunterState,
): void {
  bridge.onEvenHubEvent(async (event: Record<string, unknown>) => {
    const now = Date.now()
    if (now - lastEventTime < SCROLL_COOLDOWN) return
    lastEventTime = now

    const { type, selectedIndex } = resolveEventType(event)

    switch (state.screen) {
      case 'categories':
        if (type === 'click' && selectedIndex != null) {
          const menuItem = CATEGORY_MENU[selectedIndex]
          if (!menuItem) break
          state.selectedCategory = menuItem.category
          state.selectedSubcategory = null

          if (menuItem.hasSubcategories) {
            state.screen = 'subcategories'
          } else {
            await performSearch(state)
          }
        }
        break

      case 'subcategories':
        if (type === 'click' && selectedIndex != null) {
          const sub = RESTAURANT_SUBCATEGORIES[selectedIndex]
          if (!sub) break
          state.selectedSubcategory = sub.type
          await performSearch(state)
        }
        if (type === 'doubleClick') {
          state.screen = 'categories'
        }
        break

      case 'results':
        if (type === 'click' && selectedIndex != null) {
          const place = state.places[selectedIndex]
          if (place) {
            state.selectedPlace = place
            state.screen = 'details'
          }
        }
        if (type === 'doubleClick') {
          state.screen = 'categories'
          state.selectedCategory = null
          state.selectedSubcategory = null
          state.places = []
        }
        break

      case 'details':
        if (type === 'click' || type === 'doubleClick') {
          state.selectedPlace = null
          state.screen = 'results'
        }
        break
    }

    state.isFirstRender = false
    renderScreen(bridge, state)
  })
}
