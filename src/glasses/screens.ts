import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import {
  TextContainerProperty,
  ListContainerProperty,
  ListItemContainerProperty,
  ImageContainerProperty,
  ImageRawDataUpdate,
  CreateStartUpPageContainer,
  RebuildPageContainer,
} from '@evenrealities/even_hub_sdk'
import type { HunterState } from '../state'
import { RESTAURANT_SUBCATEGORIES, getCategoryLabel, getCategoryDisplayLabel, getSubcategoryLabel, getEnabledMenu } from '../state'
import { formatDistance, formatRating, formatPriceLevel, truncate } from '../utils/format'
import { getCardinalDirection, getDirectionArrow } from '../utils/geo'
import { t } from '../i18n'
import * as L from './layout'
import { generateIconPNG, hasIcon, ICON_IMG_W, ICON_IMG_H } from './icons'

let detailImageBusy = false

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
    imageObject?: ImageContainerProperty[]
  },
): void {
  const totalNum =
    (opts.textObject?.length ?? 0) +
    (opts.listObject?.length ?? 0) +
    (opts.imageObject?.length ?? 0)

  if (isFirst) {
    bridge.createStartUpPageContainer(
      new CreateStartUpPageContainer({
        containerTotalNum: totalNum,
        textObject: opts.textObject,
        listObject: opts.listObject,
        imageObject: opts.imageObject,
      }),
    )
  } else {
    bridge.rebuildPageContainer(
      new RebuildPageContainer({
        containerTotalNum: totalNum,
        textObject: opts.textObject,
        listObject: opts.listObject,
        imageObject: opts.imageObject,
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
  const menu = getEnabledMenu(state)
  const items = menu.map((c) => getCategoryDisplayLabel(c))
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
  let batterySuffix = ''
  if (state.batteryLevel != null) {
    batterySuffix =
      state.batteryLevel < 15
        ? `  [!${state.batteryLevel}%]`
        : `  [${state.batteryLevel}%]`
  }
  const header = makeHeader(`${catLabel}${subLabel} < ${radiusKm}km${batterySuffix}`)

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

export async function renderDetails(
  bridge: EvenAppBridge,
  state: HunterState,
): Promise<void> {
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

  // Try to render with category icon on the left (proven fabioglimb/even-toolkit flow)
  const iconBytes = hasIcon(place.category) ? generateIconPNG(place.category) : null

  if (iconBytes && iconBytes.length > 0 && !detailImageBusy) {
    detailImageBusy = true
    try {
      // Step 1: ensure a dummy page exists first if this is the first send
      if (state.isFirstRender) {
        sendPage(bridge, true, {
          textObject: [
            new TextContainerProperty({
              xPosition: L.PADDING,
              yPosition: 0,
              width: L.DISPLAY_WIDTH - L.PADDING * 2,
              height: L.DISPLAY_HEIGHT,
              borderWidth: 0,
              borderColor: 0,
              paddingLength: L.PADDING,
              containerID: 0,
              containerName: 'dummy',
              content: 'HUNTER',
              isEventCapture: 1,
            }),
          ],
        })
        await new Promise((r) => setTimeout(r, 100))
      }

      // Layout — icon on left, text on right
      const imgX = L.PADDING + 4
      const imgY = Math.floor((L.DISPLAY_HEIGHT - ICON_IMG_H) / 2)
      const textX = imgX + ICON_IMG_W + 12
      const textW = L.DISPLAY_WIDTH - textX - L.PADDING

      const textContainer = new TextContainerProperty({
        xPosition: textX,
        yPosition: L.PADDING,
        width: textW,
        height: L.DISPLAY_HEIGHT - L.PADDING * 2,
        borderWidth: 1,
        borderColor: 8,
        borderRadius: 4,
        paddingLength: 6,
        containerID: 0,
        containerName: 'detail',
        content: lines.join('\n'),
        isEventCapture: 1,
      })

      const imageContainer = new ImageContainerProperty({
        xPosition: imgX,
        yPosition: imgY,
        width: ICON_IMG_W,
        height: ICON_IMG_H,
        containerID: 1,
        containerName: 'icon',
      })

      // Step 2: rebuild declaring the image container
      sendPage(bridge, false, {
        textObject: [textContainer],
        imageObject: [imageContainer],
      })

      // Step 3: small delay before pushing raw image data
      await new Promise((r) => setTimeout(r, 100))

      // Step 4: push the PNG bytes
      try {
        const result = await bridge.updateImageRawData(
          new ImageRawDataUpdate({
            containerID: 1,
            containerName: 'icon',
            imageData: iconBytes,
          }),
        )
        if (result && typeof result === 'string' && result !== 'success') {
          console.warn('updateImageRawData returned:', result)
        }
      } catch (e) {
        console.error('updateImageRawData failed:', e)
        // Fall back to text-only view
        const fallback = new TextContainerProperty({
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
        sendPage(bridge, false, { textObject: [fallback] })
      }
    } finally {
      detailImageBusy = false
    }
    return
  }

  // Fallback: text-only details (no icon available)
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
