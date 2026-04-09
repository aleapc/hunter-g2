import type { EvenAppBridge, EvenHubEvent } from '@evenrealities/even_hub_sdk'
import {
  TextContainerProperty,
  RebuildPageContainer,
} from '@evenrealities/even_hub_sdk'
import type { HunterState } from '../state'
import { RESTAURANT_SUBCATEGORIES, getEnabledMenu } from '../state'
import { t } from '../i18n'
import { searchNearby } from '../api'
import { calculateDistance } from '../utils/geo'
import { isSerperAvailable, searchSerperPlaces, findMatchingRating } from '../serper'
import { getCategoryLabel } from '../state'
import { renderScreen } from './renderer'

const SCROLL_COOLDOWN = 300
let lastEventTime = 0

// OsEventTypeList enum values from SDK
const EVT_CLICK = 0
const EVT_SCROLL_TOP = 1
const EVT_SCROLL_BOTTOM = 2
const EVT_DOUBLE_CLICK = 3

type ParsedEvent = {
  action: 'click' | 'doubleClick' | 'scrollUp' | 'scrollDown' | 'unknown'
  selectedIndex?: number
}

function parseEvent(event: EvenHubEvent): ParsedEvent {
  // List container events
  if (event.listEvent) {
    const le = event.listEvent
    const evtType = le.eventType as number | undefined
    const idx = le.currentSelectItemIndex

    if (evtType === EVT_DOUBLE_CLICK) {
      return { action: 'doubleClick', selectedIndex: idx }
    }
    if (evtType === EVT_CLICK) {
      return { action: 'click', selectedIndex: idx }
    }
    if (evtType === EVT_SCROLL_TOP) {
      return { action: 'scrollUp' }
    }
    if (evtType === EVT_SCROLL_BOTTOM) {
      return { action: 'scrollDown' }
    }
    // If eventType is missing but we have an index, treat as click
    if (idx != null) {
      return { action: 'click', selectedIndex: idx }
    }
  }

  // Text container events
  if (event.textEvent) {
    const te = event.textEvent
    const evtType = te.eventType as number | undefined

    if (evtType === EVT_DOUBLE_CLICK) return { action: 'doubleClick' }
    if (evtType === EVT_CLICK) return { action: 'click' }
    if (evtType === EVT_SCROLL_TOP) return { action: 'scrollUp' }
    if (evtType === EVT_SCROLL_BOTTOM) return { action: 'scrollDown' }
  }

  // System events
  if (event.sysEvent) {
    const se = event.sysEvent
    const evtType = se.eventType as number | undefined

    if (evtType === EVT_DOUBLE_CLICK) return { action: 'doubleClick' }
    if (evtType === EVT_CLICK) return { action: 'click' }
  }

  // Fallback: check jsonData
  if (event.jsonData) {
    const jd = event.jsonData
    const evtType = (jd.eventType ?? jd.Event_Type) as number | undefined
    const idx = jd.currentSelectItemIndex as number | undefined

    if (evtType === EVT_DOUBLE_CLICK) return { action: 'doubleClick', selectedIndex: idx }
    if (evtType === EVT_CLICK) return { action: 'click', selectedIndex: idx }
    if (evtType === EVT_SCROLL_TOP) return { action: 'scrollUp' }
    if (evtType === EVT_SCROLL_BOTTOM) return { action: 'scrollDown' }
  }

  return { action: 'unknown' }
}

let searchAbortController: AbortController | null = null

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
  searchAbortController?.abort()
}

export function setupEventHandler(
  bridge: EvenAppBridge,
  state: HunterState,
): void {
  bridge.onEvenHubEvent(async (event: EvenHubEvent) => {
    const now = Date.now()
    if (now - lastEventTime < SCROLL_COOLDOWN) return
    lastEventTime = now

    const { action, selectedIndex } = parseEvent(event)
    if (action === 'unknown') return

    // Double-click always goes home (from any screen or during loading)
    if (action === 'doubleClick' && (state.screen !== 'categories' || state.isLoading)) {
      goHome(state)
      state.isFirstRender = false
      renderScreen(bridge, state)
      return
    }

    switch (state.screen) {
      case 'categories':
        if (action === 'click' && selectedIndex != null) {
          const enabledMenu = getEnabledMenu(state)
          const menuItem = enabledMenu[selectedIndex]
          if (!menuItem) break
          state.selectedCategory = menuItem.category
          state.selectedSubcategory = null

          if (menuItem.hasSubcategories) {
            state.screen = 'subcategories'
          } else {
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
        }
        break
    }

    state.isFirstRender = false
    renderScreen(bridge, state)
  })
}
