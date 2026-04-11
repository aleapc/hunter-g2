// Hunter G2 — Category icons rendered via Canvas 2D → 4-bit indexed PNG (upng-js)
// Follows the battle-tested fabioglimb/even-toolkit approach used across G2 apps.

import UPNG from 'upng-js'
import type { PlaceCategory } from '../state'

// Sprite definitions: 12 cols × 12 rows.
// Palette:
//   '.' transparent/black background
//   'o' dark outline
//   'w' white fill
//   'g' mid grey fill
//   'l' light grey highlight
//   'd' darker grey shadow
const ICONS: Record<string, string[]> = {
  // Fork & plate
  restaurant: [
    '............',
    '..o..o..oo..',
    '..o..o..oo..',
    '..o..o..oo..',
    '..oooo..oo..',
    '...oo...oo..',
    '...oo...oo..',
    '.oooooooooo.',
    'ogggggggggo.',
    '.oooooooooo.',
    '............',
    '............',
  ],
  // Coffee cup with steam
  cafe: [
    '..o..o..o...',
    '...o..o..o..',
    '..o..o..o...',
    '............',
    '.oooooooo...',
    '.owwwwwwoooo',
    '.owggggwo.ow',
    '.owggggwo.ow',
    '.owggggwoooo',
    '.owwwwwwo...',
    '..oooooo....',
    '.oooooooooo.',
  ],
  // Cocktail glass with straw
  bar: [
    '.........o..',
    'oooooooooo..',
    '.owwwwwwo.o.',
    '.odwwwwdo.o.',
    '..odwwdo..o.',
    '...odwdo..o.',
    '....odo...o.',
    '....oo....o.',
    '....oo....o.',
    '....oo......',
    '..oooooo....',
    '.oooooooo...',
  ],
  // Fuel pump
  gas_station: [
    '..oooooo....',
    '..owwwwo....',
    '..owggwo....',
    '..owwwwo.oo.',
    '..oooooooo..',
    '..owggggo...',
    '..owggggo...',
    '..owggggo...',
    '..oooooo....',
    '..oggggo....',
    '.oooooooo...',
    '............',
  ],
  // Medical cross
  pharmacy: [
    '............',
    '....oooo....',
    '....owwo....',
    '....owwo....',
    'oooooowwooo.',
    'owwwwwwwwwo.',
    'owwwwwwwwwo.',
    'oooooowwooo.',
    '....owwo....',
    '....owwo....',
    '....oooo....',
    '............',
  ],
  // Shopping cart
  supermarket: [
    '............',
    'ooo.........',
    'owo.........',
    'owoooooooo..',
    'owwwwwwwwo..',
    'owggggggwo..',
    'owggggggwo..',
    'owwwwwwwwo..',
    '.oooooooo...',
    '..oo..oo....',
    '.owo.owo....',
    '..o...o.....',
  ],
  // Ice cream cone
  ice_cream: [
    '....oooo....',
    '...owwwwo...',
    '..owwllwwo..',
    '..owwwwwwo..',
    '...owwwwo...',
    '...oooooo...',
    '...ogggo....',
    '....ogo.....',
    '....ogo.....',
    '.....o......',
    '.....o......',
    '............',
  ],
  // Bakery: bread loaf
  bakery: [
    '............',
    '..oooooooo..',
    '.owwwwwwwwo.',
    'owgowgowgwo.',
    'owwwwwwwwwo.',
    'owgowgowgwo.',
    'owwwwwwwwwo.',
    'owgowgowgwo.',
    '.owwwwwwwwo.',
    '..oooooooo..',
    '............',
    '............',
  ],
  // Fast food: burger
  fast_food: [
    '..oooooooo..',
    '.owwlwwlwwo.',
    'owwwwwwwwwwo',
    'oggggggggggo',
    'owwwggwwggwo',
    'oggwwwwwwwgo',
    'owggggggggwo',
    'oooooooooooo',
    'owwwwwwwwwwo',
    '.oooooooooo.',
    '............',
    '............',
  ],
  // ATM: card
  atm: [
    '............',
    'oooooooooooo',
    'owwwwwwwwwwo',
    'owgggggggggo',
    'owgggggggggo',
    'owwwwwwwwwwo',
    'owgogogogowo',
    'owwwwwwwwwwo',
    'oooooooooooo',
    '............',
    '............',
    '............',
  ],
  // Bank: columns
  bank: [
    '.....oo.....',
    '....oooo....',
    '...oooooo...',
    '..oooooooo..',
    'oooooooooooo',
    'owo.wo.owo.o',
    'owo.wo.owo.o',
    'owo.wo.owo.o',
    'owo.wo.owo.o',
    'oooooooooooo',
    '.oooooooooo.',
    '............',
  ],
  // Hospital: building with cross
  hospital: [
    '............',
    '.oooooooooo.',
    '.owgoowgogo.',
    '.owwoowwoow.',
    '.ooooooooo..',
    '....owo.....',
    '...owwwo....',
    '..owwwwwo...',
    '...owwwo....',
    '....owo.....',
    '.oooooooooo.',
    '............',
  ],
  // Dentist: tooth
  dentist: [
    '...oooooo...',
    '..owwwwwwo..',
    '.owwwwwwwwo.',
    'owwwwwwwwwwo',
    'owwwwwwwwwwo',
    'owwwoowwwwwo',
    'owwoooowwwwo',
    'owooooowwwwo',
    '.oowwwwoowo.',
    '..owoowoow..',
    '..oo..oo.o..',
    '............',
  ],
  // Post office: envelope
  post_office: [
    '............',
    '............',
    'oooooooooooo',
    'owwwwwwwwwwo',
    'owowwwwwwowo',
    'owoowwwwoowo',
    'owwoowwoowwo',
    'owwwooowwwwo',
    'owwwwwowwwwo',
    'owwwwwwwwwwo',
    'oooooooooooo',
    '............',
  ],
  // Parking: P
  parking: [
    '.oooooooooo.',
    'owwwwwwwwwwo',
    'owwooooowwwo',
    'owwowwwowwwo',
    'owwowwwowwwo',
    'owwooooowwwo',
    'owwowwwwwwwo',
    'owwowwwwwwwo',
    'owwowwwwwwwo',
    'owwwwwwwwwwo',
    '.oooooooooo.',
    '............',
  ],
  // EV charging: lightning bolt
  ev_charging: [
    '..oooooooo..',
    '..owwwwwwo..',
    '..owwooowo..',
    '..owwoowwo..',
    '..owooowwo..',
    '..ooooowwo..',
    '..owwooowo..',
    '..owwooowo..',
    '..owoowwwo..',
    '..owoowwwo..',
    '..oowwwwwo..',
    '...oooooo...',
  ],
  // Car wash / car
  car_wash: [
    '............',
    '............',
    '....oooo....',
    '...owwwwoo..',
    '.ooowwwwwwo.',
    'owwwwwwwwwwo',
    'oooooooooooo',
    'oowooowoowoo',
    'owwoowwowwwo',
    'oowooowoowoo',
    '.oo...o...o.',
    '............',
  ],
  // Car repair: wrench
  car_repair: [
    'oo..........',
    'owoo........',
    'owwo........',
    '.owwoo......',
    '..owwoo.....',
    '...owwoo....',
    '....owwoo...',
    '.....owwoo..',
    '......owwoo.',
    '.......owwoo',
    '........owwo',
    '.........oo.',
  ],
  // Hotel: bed
  hotel: [
    '............',
    '.....oooo...',
    '....owwwwo..',
    '....oooooo..',
    'oooooooooooo',
    'owwoowwwwwwo',
    'owwwwwwwwwwo',
    'oooooooooooo',
    'o..........o',
    'o..........o',
    '............',
    '............',
  ],
  // Gym: dumbbell
  gym: [
    '............',
    '............',
    '.oo......oo.',
    'owwo....owwo',
    'owwooooowwwo',
    'owwwwwwwwwwo',
    'owwwwwwwwwwo',
    'owwooooowwwo',
    'owwo....owwo',
    '.oo......oo.',
    '............',
    '............',
  ],
  // Park: tree
  park: [
    '....oooo....',
    '...owwwwo...',
    '..owwwwwwo..',
    '.owwggwwwwo.',
    'owwwwwwwwwwo',
    'owwwwgwwwwwo',
    '.owwwwwwwo..',
    '..oooooooo..',
    '.....oo.....',
    '.....oo.....',
    '....oooo....',
    '............',
  ],
  // Cinema: film reel
  cinema: [
    '.oooooooooo.',
    'owowowowowwo',
    'owowowowowwo',
    'owwwwwwwwwwo',
    'owgoowwwoogo',
    'owgwwowwwwgo',
    'owgwwowwwwgo',
    'owgoowwwoogo',
    'owwwwwwwwwwo',
    'owowowowowwo',
    '.oooooooooo.',
    '............',
  ],
  // Museum: columns with roof
  museum: [
    '.....oo.....',
    '....oooo....',
    '...oooooo...',
    '..oooooooo..',
    '.oooooooooo.',
    'oooooooooooo',
    '.ooowoowooo.',
    '.owowowowoo.',
    '.owowowowoo.',
    '.ooooooooo..',
    'oooooooooooo',
    '............',
  ],
  // Mall: shop front
  mall: [
    '............',
    'oooooooooooo',
    'owgwgwgwgwgo',
    'oooooooooooo',
    'owwwowwowwwo',
    'owwwowwowwwo',
    'owwwowwowwwo',
    'owwwowwowwwo',
    'owwwowwowwwo',
    'oooooooooooo',
    '............',
    '............',
  ],
  // Electronics: TV/monitor
  electronics: [
    '............',
    'oooooooooooo',
    'owwwwwwwwwwo',
    'owgggggggggo',
    'owgowgowgggo',
    'owgggggggggo',
    'owgggggggggo',
    'owwwwwwwwwwo',
    'oooooooooooo',
    '...oo..oo...',
    '..oooooooo..',
    '............',
  ],
  // Bookstore: book
  bookstore: [
    '.oooooooooo.',
    'owwwwwwwwwwo',
    'owoooooooowo',
    'owwwwwwwwwwo',
    'owoooooooowo',
    'owwwwwwwwwwo',
    'owoooooooowo',
    'owwwwwwwwwwo',
    'owoooooooowo',
    'owwwwwwwwwwo',
    '.oooooooooo.',
    '............',
  ],
  // Pet shop: paw
  pet_shop: [
    '............',
    '..oo....oo..',
    '.owwo..owwo.',
    '.owwo..owwo.',
    '..oo....oo..',
    'oo..oooo..oo',
    'owo.owwo.owo',
    'owo.owwo.owo',
    '.o..owwo..o.',
    '.....oo.....',
    '............',
    '............',
  ],
  // Generic pin marker
  others: [
    '....oooo....',
    '...owwwwo...',
    '..owwwwwwo..',
    '..owwooowo..',
    '..owooowwo..',
    '..owwwwwwo..',
    '...owwwwo...',
    '....owwo....',
    '....owwo....',
    '.....oo.....',
    '.....oo.....',
    '............',
  ],
}

// Greyscale values aligned to G2's 16-level quantization (0, 17, 34, ... 255)
const COLORS: Record<string, number> = {
  '.': 0,     // transparent → black background
  'o': 34,    // dark outline
  'w': 255,   // white fill
  'l': 238,   // light highlight
  'g': 136,   // mid grey fill
  'd': 85,    // dark shadow
}

// Image dimensions: 12x12 scaled 6x = 72x72 (well within 200x100 G2 limit)
const SPRITE_W = 12
const SPRITE_H = 12
const SCALE = 6
export const ICON_IMG_W = SPRITE_W * SCALE // 72
export const ICON_IMG_H = SPRITE_H * SCALE // 72

/** Quantize a greyscale value to one of 16 levels (0, 17, 34, ..., 255) */
function quantize(grey: number): number {
  const idx = Math.min(15, Math.round(grey / 17))
  return idx * 17
}

/**
 * Generate a 4-bit indexed PNG for a category icon.
 * Returns the PNG bytes as number[] (ready for updateImageRawData),
 * or null if the category has no icon or encoding fails.
 */
export function generateIconPNG(category: PlaceCategory): number[] | null {
  try {
    const rows = ICONS[category] ?? ICONS.others
    if (!rows) return null

    // Build RGBA buffer (quantized to 16 grey levels)
    const pixelCount = ICON_IMG_W * ICON_IMG_H
    const rgba = new Uint8Array(pixelCount * 4)

    for (let row = 0; row < SPRITE_H; row++) {
      const line = rows[row] ?? ''
      for (let col = 0; col < SPRITE_W; col++) {
        const ch = line[col] ?? '.'
        const grey = quantize(COLORS[ch] ?? 0)

        // Fill SCALE × SCALE block
        for (let dy = 0; dy < SCALE; dy++) {
          for (let dx = 0; dx < SCALE; dx++) {
            const px = col * SCALE + dx
            const py = row * SCALE + dy
            const idx = (py * ICON_IMG_W + px) * 4
            rgba[idx] = grey
            rgba[idx + 1] = grey
            rgba[idx + 2] = grey
            rgba[idx + 3] = 255
          }
        }
      }
    }

    // Encode as 16-color indexed PNG via upng-js
    const pngBuffer = UPNG.encode([rgba.buffer], ICON_IMG_W, ICON_IMG_H, 16)
    const pngBytes = new Uint8Array(pngBuffer)

    // Convert to number[] (SDK prefers this format)
    const result: number[] = new Array(pngBytes.length)
    for (let i = 0; i < pngBytes.length; i++) {
      result[i] = pngBytes[i]
    }
    return result
  } catch (e) {
    console.error('generateIconPNG failed:', e)
    return null
  }
}

/** Check if an icon sprite exists for the given category */
export function hasIcon(category: PlaceCategory): boolean {
  return category in ICONS
}
