import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import type { HunterState } from '../state'
import {
  renderCategories,
  renderSubcategories,
  renderResults,
  renderDetails,
  renderLoading,
} from './screens'

export function renderScreen(bridge: EvenAppBridge, state: HunterState): void {
  if (state.isLoading) {
    renderLoading(bridge, state.isFirstRender)
    return
  }

  switch (state.screen) {
    case 'categories':
      renderCategories(bridge, state)
      break
    case 'subcategories':
      renderSubcategories(bridge, state)
      break
    case 'results':
      renderResults(bridge, state)
      break
    case 'details':
      renderDetails(bridge, state)
      break
  }
}
