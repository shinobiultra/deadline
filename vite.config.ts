import path from 'node:path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const ghRepo = process.env.GITHUB_PAGES_REPO?.trim()
const ghBase = ghRepo ? `/${ghRepo}/` : '/'
const appBase = process.env.GITHUB_PAGES === 'true' ? ghBase : './'

export default defineConfig({
  base: appBase,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['data/landmarks_core.json', 'data/cities_ne_min.json'],
      manifest: {
        name: 'deadLINE',
        short_name: 'deadLINE',
        description: 'deadline visualizer across civil and solar time',
        theme_color: '#05070d',
        background_color: '#05070d',
        display: 'standalone',
        start_url: appBase,
        scope: appBase,
        icons: [
          {
            src: 'vite.svg',
            sizes: '192x192',
            type: 'image/svg+xml'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,json,jpg,png,woff2}']
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
    exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html']
    }
  }
})
