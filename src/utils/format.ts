export function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters}m`
  return `${(meters / 1000).toFixed(1)}km`
}

export function formatRating(rating: number | undefined): string {
  if (rating == null) return '-----'
  const full = Math.floor(rating)
  const half = rating - full >= 0.25 && rating - full < 0.75 ? 1 : 0
  const empty = 5 - full - half
  return (
    '\u2605'.repeat(full) +
    (half ? '\u00BD' : '') +
    '\u2606'.repeat(empty)
  )
}

export function formatPriceLevel(level: number | undefined): string {
  if (level == null) return ''
  const map: Record<number, string> = {
    0: 'Free',
    1: '$',
    2: '$$',
    3: '$$$',
    4: '$$$$',
  }
  return map[level] ?? ''
}

export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen - 2) + '..'
}

export function padRight(text: string, len: number): string {
  return text.length >= len ? text : text + ' '.repeat(len - text.length)
}
