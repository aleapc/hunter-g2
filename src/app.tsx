import { useState, useEffect, useCallback } from 'react'
import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import type { HunterState, UserLocation, PlaceCategory } from './state'
import { ALL_CATEGORIES } from './state'
import { getUserLocation } from './utils/geo'
import { renderScreen } from './glasses/renderer'
import { t } from './i18n'

const STORAGE_KEY_LOCATION = 'hunter_location'
const STORAGE_KEY_RADIUS = 'hunter_radius'
const STORAGE_KEY_CATEGORIES = 'hunter_categories'

interface AppProps {
  bridge: EvenAppBridge
  state: HunterState
}

export function App({ bridge, state }: AppProps) {
  const [location, setLocation] = useState<UserLocation | null>(state.userLocation)
  const [radius, setRadius] = useState(state.searchRadius)
  const [cityQuery, setCityQuery] = useState('')
  const [geoStatus, setGeoStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [statusMsg, setStatusMsg] = useState('')
  const [enabledCats, setEnabledCats] = useState<PlaceCategory[]>([...state.enabledCategories])

  useEffect(() => {
    async function loadSettings() {
      const savedLoc = await bridge.getLocalStorage(STORAGE_KEY_LOCATION)
      if (savedLoc) {
        try {
          const loc = JSON.parse(savedLoc) as UserLocation
          setLocation(loc)
          state.userLocation = loc
        } catch { /* ignore */ }
      }
      const savedRadius = await bridge.getLocalStorage(STORAGE_KEY_RADIUS)
      if (savedRadius) {
        const r = parseInt(savedRadius, 10)
        if (!isNaN(r)) {
          setRadius(r)
          state.searchRadius = r
        }
      }
      const savedCats = await bridge.getLocalStorage(STORAGE_KEY_CATEGORIES)
      if (savedCats) {
        try {
          const cats = JSON.parse(savedCats) as PlaceCategory[]
          if (cats.length > 0) {
            setEnabledCats(cats)
            state.enabledCategories = cats
          }
        } catch { /* ignore */ }
      }
    }
    loadSettings()
  }, [bridge, state])

  const handleUseGPS = useCallback(async () => {
    setGeoStatus('loading')
    setStatusMsg(t('locating'))
    try {
      const loc = await getUserLocation()
      loc.label = 'GPS'
      setLocation(loc)
      state.userLocation = loc
      await bridge.setLocalStorage(STORAGE_KEY_LOCATION, JSON.stringify(loc))
      setGeoStatus('success')
      setStatusMsg(`${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`)
      state.isFirstRender = false
      renderScreen(bridge, state)
    } catch (err) {
      setGeoStatus('error')
      setStatusMsg(`${t('gps_fail')}: ${err instanceof Error ? err.message : '?'}`)
    }
  }, [bridge, state])

  const handleSetManualLocation = useCallback(async () => {
    if (!cityQuery.trim()) return
    const loc: UserLocation = {
      lat: 0,
      lng: 0,
      label: cityQuery.trim(),
    }
    setLocation(loc)
    state.userLocation = loc
    await bridge.setLocalStorage(STORAGE_KEY_LOCATION, JSON.stringify(loc))
    setStatusMsg(`${t('manual_location')}: ${cityQuery}`)
    state.isFirstRender = false
    renderScreen(bridge, state)
  }, [bridge, state, cityQuery])

  const handleRadiusChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const r = parseInt(e.target.value, 10)
      setRadius(r)
      state.searchRadius = r
      await bridge.setLocalStorage(STORAGE_KEY_RADIUS, String(r))
    },
    [bridge, state],
  )

  const saveCategories = useCallback(
    async (cats: PlaceCategory[]) => {
      setEnabledCats(cats)
      state.enabledCategories = cats
      await bridge.setLocalStorage(STORAGE_KEY_CATEGORIES, JSON.stringify(cats))
      state.isFirstRender = false
      renderScreen(bridge, state)
    },
    [bridge, state],
  )

  const toggleCategory = useCallback(
    (cat: PlaceCategory) => {
      const isEnabled = enabledCats.includes(cat)
      const updated = isEnabled
        ? enabledCats.filter((c) => c !== cat)
        : [...enabledCats, cat]
      if (updated.length > 0) saveCategories(updated)
    },
    [enabledCats, saveCategories],
  )

  const moveCategory = useCallback(
    (cat: PlaceCategory, direction: -1 | 1) => {
      const idx = enabledCats.indexOf(cat)
      if (idx < 0) return
      const newIdx = idx + direction
      if (newIdx < 0 || newIdx >= enabledCats.length) return
      const updated = [...enabledCats]
      updated[idx] = updated[newIdx]
      updated[newIdx] = cat
      saveCategories(updated)
    },
    [enabledCats, saveCategories],
  )

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>{t('app_title')}</h1>
      <p style={styles.subtitle}>{t('app_subtitle')}</p>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>{t('location_title')}</h2>

        <button onClick={handleUseGPS} disabled={geoStatus === 'loading'} style={styles.button}>
          {geoStatus === 'loading' ? t('locating') : t('use_gps')}
        </button>

        <div style={styles.row}>
          <input
            type="text"
            placeholder={t('city_placeholder')}
            value={cityQuery}
            onChange={(e) => setCityQuery(e.target.value)}
            style={styles.input}
          />
          <button onClick={handleSetManualLocation} style={styles.buttonSmall}>
            OK
          </button>
        </div>

        {statusMsg && <p style={styles.status}>{statusMsg}</p>}

        {location && (
          <p style={styles.info}>
            {location.label ?? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`}
          </p>
        )}
      </section>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>{t('search_radius')}: {(radius / 1000).toFixed(1)} km</h2>
        <input
          type="range"
          min={500}
          max={5000}
          step={250}
          value={radius}
          onChange={handleRadiusChange}
          style={styles.slider}
        />
        <div style={styles.rangeLabels}>
          <span>500m</span>
          <span>5km</span>
        </div>
      </section>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>{t('categories_edit')}</h2>
        <ul style={styles.list}>
          {ALL_CATEGORIES.map((c) => {
            const enabled = enabledCats.includes(c.category)
            const idx = enabledCats.indexOf(c.category)
            return (
              <li key={c.category} style={{ ...styles.catRow, opacity: enabled ? 1 : 0.4 }}>
                <label style={styles.catLabel}>
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={() => toggleCategory(c.category)}
                    style={styles.checkbox}
                  />
                  {t(c.labelKey)}
                </label>
                {enabled && (
                  <span style={styles.catButtons}>
                    <button
                      onClick={() => moveCategory(c.category, -1)}
                      disabled={idx === 0}
                      style={styles.moveBtn}
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => moveCategory(c.category, 1)}
                      disabled={idx === enabledCats.length - 1}
                      style={styles.moveBtn}
                    >
                      ▼
                    </button>
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      <section style={styles.section}>
        <p style={styles.hint}>{t('usage_hint')}</p>
      </section>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    maxWidth: 480,
    margin: '0 auto',
    padding: 16,
    color: '#e0e0e0',
    backgroundColor: '#1a1a1a',
    minHeight: '100vh',
  },
  title: { fontSize: 28, fontWeight: 700, margin: '0 0 4px', color: '#fff' },
  subtitle: { fontSize: 14, color: '#888', margin: '0 0 24px' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: 600, marginBottom: 12, color: '#ccc' },
  button: {
    width: '100%', padding: '12px 16px', fontSize: 15, fontWeight: 600,
    border: 'none', borderRadius: 8, backgroundColor: '#4CAF50',
    color: '#fff', cursor: 'pointer', marginBottom: 12,
  },
  buttonSmall: {
    padding: '10px 16px', fontSize: 14, fontWeight: 600,
    border: 'none', borderRadius: 8, backgroundColor: '#4CAF50',
    color: '#fff', cursor: 'pointer', flexShrink: 0,
  },
  row: { display: 'flex', gap: 8, alignItems: 'center' },
  input: {
    flex: 1, padding: '10px 12px', fontSize: 14,
    border: '1px solid #444', borderRadius: 8,
    backgroundColor: '#2a2a2a', color: '#e0e0e0', outline: 'none',
  },
  slider: { width: '100%', accentColor: '#4CAF50' },
  rangeLabels: { display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#666' },
  status: { fontSize: 13, color: '#aaa', marginTop: 8 },
  info: { fontSize: 13, color: '#4CAF50', marginTop: 4 },
  list: { listStyle: 'none', padding: 0, margin: 0 },
  listItem: { padding: '8px 12px', borderBottom: '1px solid #333', fontSize: 14 },
  catRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '8px 12px', borderBottom: '1px solid #333',
  },
  catLabel: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' },
  checkbox: { accentColor: '#4CAF50', width: 18, height: 18 },
  catButtons: { display: 'flex', gap: 4 },
  moveBtn: {
    width: 28, height: 28, fontSize: 12, border: '1px solid #555',
    borderRadius: 4, backgroundColor: '#333', color: '#ccc', cursor: 'pointer',
  },
  hint: { fontSize: 12, color: '#666', lineHeight: 1.5 },
}
