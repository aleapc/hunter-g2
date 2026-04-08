export type Locale = 'pt' | 'en' | 'es'

export type TranslationKey =
  | 'cat_restaurant' | 'cat_cafe' | 'cat_bar' | 'cat_ice_cream'
  | 'cat_gas_station' | 'cat_pharmacy' | 'cat_supermarket'
  | 'sub_japanese' | 'sub_italian' | 'sub_brazilian' | 'sub_pizza'
  | 'sub_fast_food' | 'sub_mexican' | 'sub_all'
  | 'no_results' | 'loading' | 'no_location' | 'back_hint'
  | 'open' | 'closed' | 'header_restaurant' | 'price_free'
  | 'app_title' | 'app_subtitle' | 'location_title' | 'use_gps'
  | 'locating' | 'gps_fail' | 'city_placeholder' | 'manual_location'
  | 'search_radius' | 'categories_title' | 'usage_hint'

type Translations = Record<TranslationKey, string>

const pt: Translations = {
  cat_restaurant: 'Restaurante',
  cat_cafe: 'Cafe',
  cat_bar: 'Bar',
  cat_ice_cream: 'Sorvete',
  cat_gas_station: 'Gasolina',
  cat_pharmacy: 'Farmacia',
  cat_supermarket: 'Supermercado',
  sub_japanese: 'Japonesa',
  sub_italian: 'Italiana',
  sub_brazilian: 'Brasileira',
  sub_pizza: 'Pizza',
  sub_fast_food: 'Fast Food',
  sub_mexican: 'Mexicana',
  sub_all: 'Todos',
  no_results: 'Nenhum lugar encontrado',
  loading: 'Buscando lugares...',
  no_location: 'Sem localizacao!\n\nAbra o app no celular\ne configure sua\nlocalizacao primeiro.\n\ndouble-tap = voltar',
  back_hint: 'double-tap = voltar',
  open: 'Aberto',
  closed: 'Fechado',
  header_restaurant: 'RESTAURANTE',
  price_free: 'Gratis',
  app_title: 'Hunter',
  app_subtitle: 'Descubra lugares por perto',
  location_title: 'Localizacao',
  use_gps: 'Usar minha localizacao (GPS)',
  locating: 'Localizando...',
  gps_fail: 'Falha no GPS',
  city_placeholder: 'Ou digite uma cidade...',
  manual_location: 'Localizacao manual',
  search_radius: 'Raio de busca',
  categories_title: 'Categorias disponiveis',
  usage_hint: 'Use os oculos para navegar: swipe para scroll, tap para selecionar, double-tap para voltar ao menu.',
}

const en: Translations = {
  cat_restaurant: 'Restaurant',
  cat_cafe: 'Coffee',
  cat_bar: 'Bar',
  cat_ice_cream: 'Ice Cream',
  cat_gas_station: 'Gas Station',
  cat_pharmacy: 'Pharmacy',
  cat_supermarket: 'Supermarket',
  sub_japanese: 'Japanese',
  sub_italian: 'Italian',
  sub_brazilian: 'Brazilian',
  sub_pizza: 'Pizza',
  sub_fast_food: 'Fast Food',
  sub_mexican: 'Mexican',
  sub_all: 'All',
  no_results: 'No places found',
  loading: 'Searching places...',
  no_location: 'No location set!\n\nOpen the phone app\nand set your\nlocation first.\n\ndouble-tap = back',
  back_hint: 'double-tap = back',
  open: 'Open',
  closed: 'Closed',
  header_restaurant: 'RESTAURANT',
  price_free: 'Free',
  app_title: 'Hunter',
  app_subtitle: 'Discover nearby places',
  location_title: 'Location',
  use_gps: 'Use my location (GPS)',
  locating: 'Locating...',
  gps_fail: 'GPS failed',
  city_placeholder: 'Or type a city...',
  manual_location: 'Manual location',
  search_radius: 'Search radius',
  categories_title: 'Available categories',
  usage_hint: 'Use your glasses to navigate: swipe to scroll, tap to select, double-tap to go back.',
}

const es: Translations = {
  cat_restaurant: 'Restaurante',
  cat_cafe: 'Cafe',
  cat_bar: 'Bar',
  cat_ice_cream: 'Helado',
  cat_gas_station: 'Gasolina',
  cat_pharmacy: 'Farmacia',
  cat_supermarket: 'Supermercado',
  sub_japanese: 'Japonesa',
  sub_italian: 'Italiana',
  sub_brazilian: 'Brasilena',
  sub_pizza: 'Pizza',
  sub_fast_food: 'Comida Rapida',
  sub_mexican: 'Mexicana',
  sub_all: 'Todos',
  no_results: 'No se encontraron lugares',
  loading: 'Buscando lugares...',
  no_location: 'Sin ubicacion!\n\nAbre la app en el celular\ny configura tu\nubicacion primero.\n\ndouble-tap = volver',
  back_hint: 'double-tap = volver',
  open: 'Abierto',
  closed: 'Cerrado',
  header_restaurant: 'RESTAURANTE',
  price_free: 'Gratis',
  app_title: 'Hunter',
  app_subtitle: 'Descubre lugares cercanos',
  location_title: 'Ubicacion',
  use_gps: 'Usar mi ubicacion (GPS)',
  locating: 'Localizando...',
  gps_fail: 'Fallo de GPS',
  city_placeholder: 'O escribe una ciudad...',
  manual_location: 'Ubicacion manual',
  search_radius: 'Radio de busqueda',
  categories_title: 'Categorias disponibles',
  usage_hint: 'Usa tus lentes para navegar: desliza para scroll, toca para seleccionar, doble toque para volver.',
}

const dictionaries: Record<Locale, Translations> = { pt, en, es }

let currentLocale: Locale = detectLocale()

export function detectLocale(): Locale {
  const lang = (navigator.language ?? 'en').toLowerCase()
  if (lang.startsWith('pt')) return 'pt'
  if (lang.startsWith('es')) return 'es'
  return 'en'
}

export function setLocale(locale: Locale): void {
  currentLocale = locale
}

export function getLocale(): Locale {
  return currentLocale
}

export function t(key: TranslationKey): string {
  return dictionaries[currentLocale][key]
}
