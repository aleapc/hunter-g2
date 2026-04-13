import type { EvenAppBridge, EvenHubEvent } from '@evenrealities/even_hub_sdk'
import {
  TextContainerProperty,
  RebuildPageContainer,
} from '@evenrealities/even_hub_sdk'
import type { HunterState } from '../state'
import {
  RESTAURANT_SUBCATEGORIES,
  getEnabledMenu,
  FAVORITES_CATEGORY,
} from '../state'
import { t } from '../i18n'
import { searchNearbyCached } from '../api'
import { calculateDistance } from '../utils/geo'
import { isSerperAvailable, searchSerperPlaces, findMatchingRating } from '../serper'
import { getCategoryLabel } from '../state'
import { loadFavorites, toggleFavorite } from '../favorites'
import { getWalkingRoute } from '../routing'
import { renderScreen } from './renderer'

const SCROLL_COOLDOWN = 300
let lastEventTime = 0

// OsEventTypeList enum values from SDK
const EVT_CLICK = 0
const EVT_SCROLL_TOP = 1
const EVT_SCROLL_BOTTOM = 2
const EVT_DOUBLE_CLICK = 3
const EVT_FOREGROUND_ENTER = 4
const EVT_FOREGROUND_EXIT = 5

type ParsedEvent = {
  action:
    | 'click'
    | 'doubleClick'
    | 'scrollUp'
    | 'scrollDown'
    | 'foregroundEnter'
    | 'foregroundExit'
    | 'unknown'
  containerName?: string
  selectedIndex?: number
}

// Triple-tap detection: 3 clicks within this window triggers graceful exit
const TRIPLE_TAP_WINDOW = 800
let tapTimestamps: number[] = []

export interface EventHandlerCallbacks {
  onForegroundEnter?: () => void
  onForegroundExit?: () => void
  onTripleTap?: () => void
}

// List container names — when sysEvent/jsonData lacks currentSelectItemIndex
// but containerName matches a list, default selectedIndex to 0 (first item).
const LIST_CONTAINER_NAMES = new Set(['catlist', 'sublist', 'reslist'])

function normalizeEventType(raw: unknown): number {
  // eventType 0 (CLICK) is often missing from JSON — treat undefined/null as 0
  if (raw === undefined || raw === null) return 0
  if (typeof raw === 'number') return raw
  if (typeof raw === 'string') {
    // Try numeric first
    const n = parseInt(raw, 10)
    if (!Number.isNaN(n)) return n
    // Named SDK constants
    if (raw === 'FOREGROUND_ENTER_EVENT' || raw === 'FOREGROUND_ENTER') return EVT_FOREGROUND_ENTER
    if (raw === 'FOREGROUND_EXIT_EVENT' || raw === 'FOREGROUND_EXIT') return EVT_FOREGROUND_EXIT
    return 0
  }
  return -1
}

function eventTypeToAction(evtType: number): ParsedEvent['action'] {
  if (evtType === EVT_DOUBLE_CLICK) return 'doubleClick'
  if (evtType === EVT_CLICK) return 'click'
  if (evtType === EVT_SCROLL_TOP) return 'scrollUp'
  if (evtType === EVT_SCROLL_BOTTOM) return 'scrollDown'
  if (evtType === EVT_FOREGROUND_ENTER) return 'foregroundEnter'
  if (evtType === EVT_FOREGROUND_EXIT) return 'foregroundExit'
  return 'unknown'
}

function parseSubEvent(sub: Record<string, unknown> | undefined): ParsedEvent | null {
  if (!sub || typeof sub !== 'object') return null
  const evtType = normalizeEventType(sub.eventType)
  if (evtType < 0 || evtType > 5) return null
  const action = eventTypeToAction(evtType)
  const containerName = sub.containerName != null ? String(sub.containerName) : undefined
  const rawIdx = sub.currentSelectItemIndex
  let selectedIndex: number | undefined
  if (typeof rawIdx === 'number') {
    selectedIndex = rawIdx
  } else if (typeof rawIdx === 'string') {
    const n = parseInt(rawIdx, 10)
    if (!Number.isNaN(n)) selectedIndex = n
  }
  // First-item fallback: on real hardware, the first list item may omit
  // currentSelectItemIndex entirely. If this is a list container, default to 0.
  if (selectedIndex == null && containerName && LIST_CONTAINER_NAMES.has(containerName)) {
    selectedIndex = 0
  }
  return { action, containerName, selectedIndex }
}

function parseEvent(event: EvenHubEvent): ParsedEvent {
  const e = event as unknown as Record<string, unknown>

  // Try each possible source in priority order. On real G2 hardware,
  // tap/scroll events arrive as sysEvent (not textEvent/listEvent).
  for (const key of ['listEvent', 'sysEvent', 'textEvent', 'jsonData']) {
    const sub = e[key] as Record<string, unknown> | undefined
    const parsed = parseSubEvent(sub)
    if (parsed && parsed.action !== 'unknown') return parsed
  }

  // Legacy fallback: listEvent with only an index (no eventType) → treat as click
  if (event.listEvent) {
    const le = event.listEvent as unknown as Record<string, unknown>
    const idx = le.currentSelectItemIndex
    if (typeof idx === 'number') {
      return { action: 'click', selectedIndex: idx }
    }
  }

  return { action: 'unknown' }
}

let searchAbortController: AbortController | null = null

export function abortInFlightSearch(): void {
  searchAbortController?.abort()
  searchAbortController = null
}

/**
 * Perform a single search using the currently-selected category/subcategory in
 * state, transitioning the screen to results. Exported so main.ts can call it
 * when launched from the glasses menu (auto-search of default category).
 */
export async function performSearchWith(
  bridge: EvenAppBridge,
  state: HunterState,
  category: string,
  subcategory?: string,
): Promise<void> {
  state.selectedCategory = category
  state.selectedSubcategory = subcategory ?? null
  if (category === FAVORITES_CATEGORY) {
    await showFavorites(bridge, state)
    renderScreen(bridge, state)
    return
  }
  await performSearch(bridge, state)
  renderScreen(bridge, state)
}

async function showFavorites(
  bridge: EvenAppBridge,
  state: HunterState,
): Promise<void> {
  const favs = await loadFavorites(bridge)
  if (state.userLocation) {
    favs.forEach((p) => {
      p.distance = calculateDistance(
        state.userLocation!.lat,
        state.userLocation!.lng,
        p.latitude,
        p.longitude,
      )
    })
    favs.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))
  }
  state.favorites = favs
  state.places = favs
  state.viewMode = 'favorites'
  state.screen = 'results'
  state.isLoading = false
}

async function startWalkingRoute(
  bridge: EvenAppBridge,
  state: HunterState,
): Promise<void> {
  if (!state.userLocation || !state.selectedPlace) return
  state.isLoading = true
  renderScreen(bridge, state)
  const route = await getWalkingRoute(
    state.userLocation.lat,
    state.userLocation.lng,
    state.selectedPlace.latitude,
    state.selectedPlace.longitude,
  )
  state.isLoading = false
  if (route && route.steps.length > 0) {
    state.currentRoute = route
    state.currentStep = 0
    state.screen = 'route'
    state.viewMode = 'route'
  } else {
    // Route fetch failed — stay on details
    state.currentRoute = null
  }
}

async function performSearch(bridge: EvenAppBridge, state: HunterState): Promise<void> {
  if (!state.userLocation) {
    const errText = new TextContainerProperty({
      xPosition: 0,
      yPosition: 0,
      width: 576,
      height: 288,
      borderWidth: 0,
      borderColor: 0,
      paddingLength: 8,
      containerID: 0,
      containerName: 'noloc',
      content: t('no_location'),
      isEventCapture: 1,
    })
    bridge.rebuildPageContainer(
      new RebuildPageContainer({
        containerTotalNum: 1,
        textObject: [errText],
      }),
    )
    state.screen = 'results'
    return
  }

  // Abort any previous in-flight search
  searchAbortController?.abort()
  const controller = new AbortController()
  searchAbortController = controller

  state.isLoading = true
  renderScreen(bridge, state)

  const subcategoryType = state.selectedSubcategory ?? undefined
  const category = state.selectedCategory!

  try {
    const places = await searchNearbyCached(
      bridge,
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

    if (controller.signal.aborted) return

    // Enrich with Google ratings via Serper (if API key available)
    if (isSerperAvailable() && places.length > 0) {
      try {
        const catLabel = getCategoryLabel(category)
        const query = `${catLabel} near me`
        const serperResults = await searchSerperPlaces(
          query,
          state.userLocation!.lat,
          state.userLocation!.lng,
        )
        if (serperResults.length > 0) {
          for (const place of places) {
            const match = findMatchingRating(place.name, serperResults)
            if (match) {
              place.rating = match.rating
              place.userRatingsTotal = match.ratingCount
            }
          }
        }
      } catch {
        // Serper enrichment is optional — silently skip on error
      }
    }

    state.places = places
  } catch (err) {
    console.error('Search failed:', err)
    state.places = []
  }

  if (controller.signal.aborted) return

  state.isLoading = false
  state.screen = 'results'
}

function goHome(state: HunterState): void {
  state.screen = 'categories'
  state.selectedCategory = null
  state.selectedSubcategory = null
  state.selectedPlace = null
  state.places = []
  state.isLoading = false
  state.currentRoute = null
  state.currentStep = 0
  state.viewMode = 'results'
  searchAbortController?.abort()
}

export function setupEventHandler(
  bridge: EvenAppBridge,
  state: HunterState,
  callbacks: EventHandlerCallbacks = {},
): void {
  bridge.onEvenHubEvent(async (event: EvenHubEvent) => {
    const { action, selectedIndex } = parseEvent(event)
    if (action === 'unknown') return

    // Lifecycle events fire independent of the scroll cooldown.
    if (action === 'foregroundEnter') {
      callbacks.onForegroundEnter?.()
      return
    }
    if (action === 'foregroundExit') {
      callbacks.onForegroundExit?.()
      return
    }

    const now = Date.now()
    if (now - lastEventTime < SCROLL_COOLDOWN) return
    lastEventTime = now

    // Triple-tap detection (click x3 inside TRIPLE_TAP_WINDOW).
    // On details screen, triple-tap starts walking route navigation.
    // Elsewhere, triple-tap is a graceful exit.
    if (action === 'click') {
      tapTimestamps.push(now)
      tapTimestamps = tapTimestamps.filter((t) => now - t <= TRIPLE_TAP_WINDOW)
      if (tapTimestamps.length >= 3) {
        tapTimestamps = []
        if (state.screen === 'details' && state.selectedPlace && state.userLocation) {
          startWalkingRoute(bridge, state).then(() => {
            state.isFirstRender = false
            renderScreen(bridge, state)
          }).catch((e) => {
            console.error('[events] route failed:', e)
            state.isLoading = false
            renderScreen(bridge, state)
          })
          return
        }
        callbacks.onTripleTap?.()
        return
      }
    } else {
      tapTimestamps = []
    }

    // Double-click on details: toggle favorite. Elsewhere: go home.
    if (action === 'doubleClick') {
      if (state.screen === 'details' && state.selectedPlace) {
        const place = state.selectedPlace
        toggleFavorite(bridge, place).then(() => {
          return loadFavorites(bridge)
        }).then((favs) => {
          state.favorites = favs
          state.isFirstRender = false
          renderScreen(bridge, state)
        }).catch((e) => {
          console.error('[events] favorite toggle failed:', e)
        })
        return
      }
      if (state.screen !== 'categories' || state.isLoading) {
        goHome(state)
        state.isFirstRender = false
        renderScreen(bridge, state)
        return
      }
    }

    switch (state.screen) {
      case 'categories':
        if (action === 'click' && selectedIndex != null) {
          const enabledMenu = getEnabledMenu(state)
          const menuItem = enabledMenu[selectedIndex]
          if (!menuItem) break
          state.selectedCategory = menuItem.category
          state.selectedSubcategory = null

          if (menuItem.category === FAVORITES_CATEGORY) {
            showFavorites(bridge, state).then(() => {
              state.isFirstRender = false
              renderScreen(bridge, state)
            })
            return
          }

          if (menuItem.hasSubcategories) {
            state.screen = 'subcategories'
          } else {
            state.viewMode = 'results'
            performSearch(bridge, state).then(() => {
              renderScreen(bridge, state)
            })
            return // don't renderScreen below — performSearch handles it
          }
        }
        break

      case 'subcategories':
        if (action === 'click' && selectedIndex != null) {
          const sub = RESTAURANT_SUBCATEGORIES[selectedIndex]
          if (!sub) break
          state.selectedSubcategory = sub.type
          performSearch(bridge, state).then(() => {
            renderScreen(bridge, state)
          })
          return
        }
        break

      case 'results':
        if (action === 'click' && selectedIndex != null) {
          const place = state.places[selectedIndex]
          if (place) {
            state.selectedPlace = place
            state.screen = 'details'
          }
        }
        break

      case 'details':
        if (action === 'click') {
          state.selectedPlace = null
          state.screen = 'results'
          state.currentRoute = null
          state.currentStep = 0
        }
        break

      case 'route':
        // Click advances to the next step; at the end, return to details.
        if (action === 'click') {
          if (state.currentRoute && state.currentStep < state.currentRoute.steps.length - 1) {
            state.currentStep += 1
          } else {
            state.screen = 'details'
            state.currentRoute = null
            state.currentStep = 0
          }
        }
        break
    }

    state.isFirstRender = false
    renderScreen(bridge, state)
  })
}
