import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import type { Place } from './state'

const FAVORITES_KEY = 'hunter_favorites'

type StorageBridge = Pick<EvenAppBridge, 'getLocalStorage' | 'setLocalStorage'>

export async function loadFavorites(bridge: StorageBridge): Promise<Place[]> {
  try {
    const raw = await bridge.getLocalStorage(FAVORITES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Place[]
    if (!Array.isArray(parsed)) return []
    // Deduplicate by id
    const seen = new Set<string>()
    const out: Place[] = []
    for (const p of parsed) {
      if (p && p.id && !seen.has(p.id)) {
        seen.add(p.id)
        out.push(p)
      }
    }
    return out
  } catch {
    return []
  }
}

async function save(bridge: StorageBridge, list: Place[]): Promise<void> {
  try {
    await bridge.setLocalStorage(FAVORITES_KEY, JSON.stringify(list))
  } catch {
    /* ignore */
  }
}

export async function addFavorite(bridge: StorageBridge, place: Place): Promise<void> {
  const list = await loadFavorites(bridge)
  if (list.some((p) => p.id === place.id)) return
  list.push(place)
  await save(bridge, list)
}

export async function removeFavorite(bridge: StorageBridge, place: Place): Promise<void> {
  const list = await loadFavorites(bridge)
  const filtered = list.filter((p) => p.id !== place.id)
  await save(bridge, filtered)
}

export async function isFavorite(bridge: StorageBridge, place: Place): Promise<boolean> {
  const list = await loadFavorites(bridge)
  return list.some((p) => p.id === place.id)
}

export async function toggleFavorite(
  bridge: StorageBridge,
  place: Place,
): Promise<boolean> {
  const list = await loadFavorites(bridge)
  const idx = list.findIndex((p) => p.id === place.id)
  if (idx >= 0) {
    list.splice(idx, 1)
    await save(bridge, list)
    return false
  }
  list.push(place)
  await save(bridge, list)
  return true
}
