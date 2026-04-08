import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api/places': {
        target: 'https://places-api.foursquare.com/places',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/places/, ''),
      },
    },
  },
  build: {
    outDir: 'dist',
  },
})
