// OSRM public instance — walking directions
// https://router.project-osrm.org/route/v1/foot/{lng1},{lat1};{lng2},{lat2}?overview=false&steps=true

const OSRM_BASE = 'https://router.project-osrm.org/route/v1/foot'
const REQUEST_TIMEOUT_MS = 10_000

export interface RouteStep {
  distance: number // meters
  duration: number // seconds
  maneuver: string // 'turn', 'continue', 'arrive', etc.
  modifier?: string // 'left', 'right', 'straight', etc.
  name?: string // street name
}

export interface Route {
  totalDistance: number
  totalDuration: number
  steps: RouteStep[]
}

interface OsrmManeuver {
  type?: string
  modifier?: string
}

interface OsrmStep {
  distance?: number
  duration?: number
  name?: string
  maneuver?: OsrmManeuver
}

interface OsrmLeg {
  distance?: number
  duration?: number
  steps?: OsrmStep[]
}

interface OsrmRoute {
  distance?: number
  duration?: number
  legs?: OsrmLeg[]
}

interface OsrmResponse {
  code?: string
  routes?: OsrmRoute[]
}

async function fetchWithRetry(
  url: string,
  opts: RequestInit,
  maxAttempts = 3,
): Promise<Response> {
  let lastError: Error | null = null
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const resp = await fetch(url, opts)
      if (resp.ok) return resp
      lastError = new Error(`HTTP ${resp.status}`)
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e))
    }
    if (attempt < maxAttempts - 1) {
      await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)))
    }
  }
  throw lastError ?? new Error('fetchWithRetry failed')
}

export async function getWalkingRoute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): Promise<Route | null> {
  const url =
    `${OSRM_BASE}/${fromLng},${fromLat};${toLng},${toLat}` +
    `?overview=false&steps=true`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetchWithRetry(
      url,
      { method: 'GET', signal: controller.signal },
      3,
    )
    clearTimeout(timeout)

    const data = (await response.json()) as OsrmResponse
    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      return null
    }

    const route = data.routes[0]
    const leg = route.legs?.[0]
    const steps: RouteStep[] = (leg?.steps ?? []).map((s) => ({
      distance: s.distance ?? 0,
      duration: s.duration ?? 0,
      maneuver: s.maneuver?.type ?? 'continue',
      modifier: s.maneuver?.modifier,
      name: s.name && s.name.length > 0 ? s.name : undefined,
    }))

    return {
      totalDistance: route.distance ?? 0,
      totalDuration: route.duration ?? 0,
      steps,
    }
  } catch (err) {
    clearTimeout(timeout)
    console.warn('OSRM getWalkingRoute failed:', err)
    return null
  }
}

/**
 * Produce a short display label for a route step.
 * e.g. "-> Continue on Main St" / "<- Turn left on 2nd Ave" / "(.) Arrive"
 */
export function formatStepLabel(step: RouteStep): string {
  let arrow = '->'
  if (step.modifier?.includes('left')) arrow = '<-'
  else if (step.modifier?.includes('right')) arrow = '->'
  else if (step.modifier === 'straight') arrow = '^'
  if (step.maneuver === 'arrive') arrow = '(.)'
  if (step.maneuver === 'depart') arrow = '>>'

  let verb: string
  switch (step.maneuver) {
    case 'turn':
      verb = step.modifier ? `Turn ${step.modifier}` : 'Turn'
      break
    case 'continue':
      verb = 'Continue'
      break
    case 'arrive':
      verb = 'Arrive'
      break
    case 'depart':
      verb = 'Start'
      break
    case 'new name':
      verb = 'Continue'
      break
    case 'roundabout':
    case 'rotary':
      verb = 'Roundabout'
      break
    case 'merge':
      verb = 'Merge'
      break
    case 'fork':
      verb = step.modifier ? `Fork ${step.modifier}` : 'Fork'
      break
    default:
      verb = step.maneuver
  }

  const onStreet = step.name ? ` on ${step.name}` : ''
  return `${arrow} ${verb}${onStreet}`
}

export function formatStepDuration(seconds: number): string {
  const mins = Math.max(1, Math.round(seconds / 60))
  return `${mins} min`
}

export function formatStepDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`
  return `${(meters / 1000).toFixed(1)}km`
}
