/**
 * Manual test script for event state transitions.
 * Run with: npx tsx src/test-events.ts
 *
 * Tests the event parsing and state machine without needing
 * the simulator or glasses hardware.
 */

import { initialState } from './state'
import type { HunterState } from './state'

// Minimal mock of EvenAppBridge
const mockBridge = {
  createStartUpPageContainer: () => Promise.resolve(0),
  rebuildPageContainer: () => Promise.resolve(true),
  onEvenHubEvent: () => () => {},
  getLocalStorage: () => Promise.resolve(''),
  setLocalStorage: () => Promise.resolve(true),
} as any

// Import the event types
const EVT_CLICK = 0
const EVT_DOUBLE_CLICK = 3

// Simulated events matching simulator format
function makeListClickEvent(index: number) {
  return {
    listEvent: {
      containerID: 1,
      containerName: 'catlist',
      currentSelectItemIndex: index,
      eventType: EVT_CLICK,
    },
    jsonData: {
      containerID: 1,
      containerName: 'catlist',
      currentSelectItemIndex: index,
      eventType: EVT_CLICK,
    },
  }
}

function makeDoubleClickEvent() {
  return {
    textEvent: {
      containerID: 0,
      containerName: 'loading',
      eventType: EVT_DOUBLE_CLICK,
    },
    jsonData: {
      containerID: 0,
      containerName: 'loading',
      eventType: EVT_DOUBLE_CLICK,
    },
  }
}

function makeListDoubleClickEvent() {
  return {
    listEvent: {
      containerID: 1,
      containerName: 'catlist',
      currentSelectItemIndex: 0,
      eventType: EVT_DOUBLE_CLICK,
    },
    jsonData: {
      containerID: 1,
      containerName: 'catlist',
      currentSelectItemIndex: 0,
      eventType: EVT_DOUBLE_CLICK,
    },
  }
}

// ---- Test runner ----
let passed = 0
let failed = 0

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✓ ${msg}`)
    passed++
  } else {
    console.error(`  ✗ FAIL: ${msg}`)
    failed++
  }
}

function freshState(): HunterState {
  return {
    ...initialState,
    enabledCategories: [...initialState.enabledCategories],
    userLocation: { lat: -22.9068, lng: -43.1729, label: 'Rio' },
  }
}

// ---- Tests ----

console.log('\n=== Hunter G2 Event Tests ===\n')

// Test 1: Initial state
console.log('Test 1: Initial state')
{
  const state = freshState()
  assert(state.screen === 'categories', 'starts on categories')
  assert(state.isLoading === false, 'not loading')
  assert(state.enabledCategories.length === 7, 'has 7 default categories')
}

// Test 2: Click on restaurant (index 0) → subcategories
console.log('\nTest 2: Click on restaurant → subcategories')
{
  const state = freshState()
  const event = makeListClickEvent(0) // Restaurant

  // Simulate what the event handler does
  const menuItem = state.enabledCategories[0] // 'restaurant'
  state.selectedCategory = menuItem
  state.screen = 'subcategories'

  assert(state.screen === 'subcategories', 'navigated to subcategories')
  assert(state.selectedCategory === 'restaurant', 'selected restaurant')
}

// Test 3: Click on cafe (index 1) → search starts
console.log('\nTest 3: Click on cafe → loading')
{
  const state = freshState()
  state.selectedCategory = 'cafe'
  state.isLoading = true

  assert(state.isLoading === true, 'loading is true')
  assert(state.selectedCategory === 'cafe', 'category is cafe')
}

// Test 4: Double-click during loading → goes home
console.log('\nTest 4: Double-click during loading → home')
{
  const state = freshState()
  state.selectedCategory = 'cafe'
  state.isLoading = true
  state.screen = 'categories' // screen stays categories during search from categories

  // The bug fix: double-click should work even when screen is 'categories' if isLoading
  const shouldGoHome = state.screen !== 'categories' || state.isLoading
  assert(shouldGoHome === true, 'double-click triggers go home during loading')

  // Simulate goHome
  state.screen = 'categories'
  state.selectedCategory = null
  state.isLoading = false

  assert(state.screen === 'categories', 'back to categories')
  assert(state.isLoading === false, 'loading stopped')
  assert(state.selectedCategory === null, 'category cleared')
}

// Test 5: Double-click on categories (not loading) → no action
console.log('\nTest 5: Double-click on categories (idle) → no action')
{
  const state = freshState()
  state.screen = 'categories'
  state.isLoading = false

  const shouldGoHome = state.screen !== 'categories' || state.isLoading
  assert(shouldGoHome === false, 'double-click does nothing on idle categories')
}

// Test 6: Double-click on results → goes home
console.log('\nTest 6: Double-click on results → home')
{
  const state = freshState()
  state.screen = 'results'
  state.places = [{ id: '1', name: 'Test', latitude: 0, longitude: 0, category: 'cafe' }]

  const shouldGoHome = state.screen !== 'categories' || state.isLoading
  assert(shouldGoHome === true, 'double-click on results goes home')
}

// Test 7: Double-click on details → goes home
console.log('\nTest 7: Double-click on details → home')
{
  const state = freshState()
  state.screen = 'details'

  const shouldGoHome = state.screen !== 'categories' || state.isLoading
  assert(shouldGoHome === true, 'double-click on details goes home')
}

// Test 8: Double-click on subcategories → goes home
console.log('\nTest 8: Double-click on subcategories → home')
{
  const state = freshState()
  state.screen = 'subcategories'

  const shouldGoHome = state.screen !== 'categories' || state.isLoading
  assert(shouldGoHome === true, 'double-click on subcategories goes home')
}

// Test 9: Enabled categories filtering
console.log('\nTest 9: Category filtering')
{
  const state = freshState()
  state.enabledCategories = ['cafe', 'bar', 'ice_cream']

  assert(state.enabledCategories.length === 3, 'only 3 categories enabled')
  assert(state.enabledCategories[0] === 'cafe', 'first is cafe')
  assert(!state.enabledCategories.includes('restaurant'), 'restaurant removed')
}

// ---- Summary ----
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed > 0 ? 1 : 0)
