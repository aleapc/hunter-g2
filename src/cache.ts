import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import type { Place, PlaceCategory } from './state'

// 30 minute fresh TTL — shorter than Serper cache since user may move
const CACHE_TTL_MS = 30 * 60 * 1000
// Stale fallback (network-failure rescue) — up to 24h old
const STALE_TTL_MS = 24 * 60 * 60 * 1000
const MAX_ENTRIES = 20
const CACHE_KEY = 'hunter_search_cache'

interface CacheEntry {
  timestamp: number
  places: Place[]
}

type CacheMap = Record<string, CacheEntry>

type StorageBridge = Pick<EvenAppBridge, 'getLocalStorage' | 'setLocalStorage'>

export function makeCacheKey(
  category: PlaceCategory,
  lat: number,
  lng: number,
  radius: number,
  subcategory?: string,
): string {
  const sub = subcategory ? `|${subcategory}` : ''
  return `${category}${sub}|${lat.toFixed(3)}|${lng.toFixed(3)}|${radius}`
}

async function readCache(bridge: StorageBridge): Promise<CacheMap> {
  try {
    const raw = await bridge.getLocalStorage(CACHE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as CacheMap
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

async function writeCache(bridge: StorageBridge, map: CacheMap): Promise<void> {
  try {
    await bridge.setLocalStorage(CACHE_KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}

/**
 * Return fresh-cached places (within 30 min) or null.
 */
export async function getCached(
  bridge: StorageBridge,
  key: string,
): Promise<Place[] | null> {
  const map = await readCache(bridge)
  const entry = map[key]
  if (!entry) return null
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) return null
  return entry.places
}

/**
 * Return stale-cached places (up to 24h old) or null. Used as a network-failure fallback.
 */
export async function getStale(
  bridge: StorageBridge,
  key: string,
): Promise<Place[] | null> {
  const map = await readCache(bridge)
  const entry = map[key]
  if (!entry) return null
  if (Date.now() - entry.timestamp > STALE_TTL_MS) return null
  return entry.places
}

export async function setCached(
  bridge: StorageBridge,
  key: string,
  places: Place[],
): Promise<void> {
  const map = await readCache(bridge)
  map[key] = { timestamp: Date.now(), places }

  // Evict oldest entries if over MAX_ENTRIES
  const keys = Object.keys(map)
  if (keys.length > MAX_ENTRIES) {
    const sorted = keys.sort((a, b) => map[a].timestamp - map[b].timestamp)
    const toDrop = sorted.slice(0, keys.length - MAX_ENTRIES)
    for (const k of toDrop) delete map[k]
  }

  await writeCache(bridge, map)
}
