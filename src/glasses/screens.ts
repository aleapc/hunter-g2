import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import {
  TextContainerProperty,
  ListContainerProperty,
  ListItemContainerProperty,
  CreateStartUpPageContainer,
  RebuildPageContainer,
} from '@evenrealities/even_hub_sdk'
import type { HunterState } from '../state'
import { CATEGORY_MENU, RESTAURANT_SUBCATEGORIES, getCategoryLabel, getSubcategoryLabel } from '../state'
import { formatDistance, formatRating, formatPriceLevel, truncate } from '../utils/format'
import { getCardinalDirection, getDirectionArrow } from '../utils/geo'
import { t } from '../i18n'
import * as L from './layout'

function makeListContainer(
  items: string[],
  opts: { containerID: number; containerName: string; y: number; height: number },
): ListContainerProperty {
  return new ListContainerProperty({
    xPosition: 0,
    yPosition: opts.y,
    width: L.LIST_WIDTH,
    height: opts.height,
    containerID: opts.containerID,
    containerName: opts.containerName,
    itemContainer: new ListItemContainerProperty({
      itemCount: items.length,
      itemName: items,
      isItemSelectBorderEn: 1,
    }),
    isEventCapture: 1,
  })
}

function makeHeader(text: string): TextContainerProperty {
  return new TextContainerProperty({
    xPosition: L.PADDING,
    yPosition: 0,
    width: L.DISPLAY_WIDTH - L.PADDING * 2,
    height: L.HEADER_HEIGHT,
    borderWidth: 0,
    borderColor: 0,
    paddingLength: L.PADDING,
    containerID: 0,
    containerName: 'header',
    content: text,
    isEventCapture: 0,
  })
}

function sendPage(
  bridge: EvenAppBridge,
  isFirst: boolean,
  opts: {
    textObject?: TextContainerProperty[]
    listObject?: ListContainerProperty[]
  },
): void {
  const totalNum =
    (opts.textObject?.length ?? 0) +
    (opts.listObject?.length ?? 0)

  if (isFirst) {
    bridge.createStartUpPageContainer(
      new CreateStartUpPageContainer({
        containerTotalNum: totalNum,
        textObject: opts.textObject,
        listObject: opts.listObject,
      }),
    )
  } else {
    bridge.rebuildPageContainer(
      new RebuildPageContainer({
        containerTotalNum: totalNum,
        textObject: opts.textObject,
        listObject: opts.listObject,
      }),
    )
  }
}

export function renderCategories(
  bridge: EvenAppBridge,
  state: HunterState,
): void {
  const locationLabel = state.userLocation?.label ?? 'GPS'
  const header = makeHeader(`HUNTER  ${locationLabel}`)
  const items = CATEGORY_MENU.map((c) => t(c.labelKey))
  const list = makeListContainer(items, {
    containerID: 1,
    containerName: 'catlist',
    y: L.LIST_Y,
    height: L.LIST_HEIGHT,
  })

  sendPage(bridge, state.isFirstRender, {
    textObject: [header],
    listObject: [list],
  })
}

export function renderSubcategories(
  bridge: EvenAppBridge,
  _state: HunterState,
): void {
  const header = makeHeader(t('header_restaurant'))
  const items = RESTAURANT_SUBCATEGORIES.map((s) => t(s.labelKey))
  const list = makeListContainer(items, {
    containerID: 1,
    containerName: 'sublist',
    y: L.LIST_Y,
    height: L.LIST_HEIGHT,
  })

  sendPage(bridge, false, {
    textObject: [header],
    listObject: [list],
  })
}

export function renderResults(
  bridge: EvenAppBridge,
  state: HunterState,
): void {
  const catLabel = getCategoryLabel(state.selectedCategory!)
  const subLabel = state.selectedSubcategory
    ? ` ${getSubcategoryLabel(state.selectedSubcategory)}`
    : ''
  const radiusKm = (state.searchRadius / 1000).toFixed(1)
  const header = makeHeader(`${catLabel}${subLabel} < ${radiusKm}km`)

  const items =
    state.places.length > 0
      ? state.places.map((p) => {
          const name = truncate(p.name, 20)
          const rating = formatRating(p.rating)
          const dist = p.distance != null ? formatDistance(p.distance) : '?'
          return `${name} ${rating} ${dist}`
        })
      : [t('no_results')]

  const list = makeListContainer(items, {
    containerID: 1,
    containerName: 'reslist',
    y: L.LIST_Y,
    height: L.LIST_HEIGHT,
  })

  sendPage(bridge, false, {
    textObject: [header],
    listObject: [list],
  })
}

export function renderDetails(
  bridge: EvenAppBridge,
  state: HunterState,
): void {
  const place = state.selectedPlace
  if (!place) return

  const rating = formatRating(place.rating)
  const reviews = place.userRatingsTotal != null ? `(${place.userRatingsTotal})` : ''
  const price = formatPriceLevel(place.priceLevel, t('price_free'))
  const dist = place.distance != null ? formatDistance(place.distance) : ''
  const direction =
    state.userLocation && place.distance != null
      ? getCardinalDirection(state.userLocation, place.latitude, place.longitude)
      : ''
  const arrow = getDirectionArrow(direction)
  const openStatus =
    place.isOpen === true ? t('open') : place.isOpen === false ? t('closed') : ''
  const catLabel = getCategoryLabel(place.category)

  const lines = [
    place.name,
    `${rating} ${reviews}`,
    [catLabel, price].filter(Boolean).join(' \u00B7 '),
    place.address ?? '',
    [dist, direction, arrow].filter(Boolean).join(' '),
    openStatus,
    '',
    t('back_hint'),
  ]

  const text = new TextContainerProperty({
    xPosition: L.PADDING,
    yPosition: 0,
    width: L.DISPLAY_WIDTH - L.PADDING * 2,
    height: L.DISPLAY_HEIGHT,
    borderWidth: 1,
    borderColor: 8,
    borderRadius: 4,
    paddingLength: 8,
    containerID: 0,
    containerName: 'detail',
    content: lines.join('\n'),
    isEventCapture: 1,
  })

  sendPage(bridge, false, { textObject: [text] })
}

export function renderLoading(bridge: EvenAppBridge, isFirst: boolean): void {
  const text = new TextContainerProperty({
    xPosition: 0,
    yPosition: 0,
    width: L.DISPLAY_WIDTH,
    height: L.DISPLAY_HEIGHT,
    borderWidth: 0,
    borderColor: 0,
    paddingLength: L.PADDING,
    containerID: 0,
    containerName: 'loading',
    content: `\n\n       ${t('loading')}`,
    isEventCapture: 1,
  })

  sendPage(bridge, isFirst, { textObject: [text] })
}
