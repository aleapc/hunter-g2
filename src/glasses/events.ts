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

    state.places = places
  } catch (err) {
    console.error('Search failed:', err)
    state.places = []
  }

  state.isLoading = false
  state.screen = 'results'
}

function goHome(state: HunterState): void {
  state.screen = 'categories'
  state.selectedCategory = null
  state.selectedSubcategory = null
  state.selectedPlace = null
  state.places = []
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

    // Double-click always goes home from any screen
    if (action === 'doubleClick' && state.screen !== 'categories') {
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
            await performSearch(bridge, state)
          }
        }
        break

      case 'subcategories':
        if (action === 'click' && selectedIndex != null) {
          const sub = RESTAURANT_SUBCATEGORIES[selectedIndex]
          if (!sub) break
          state.selectedSubcategory = sub.type
          await performSearch(bridge, state)
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
