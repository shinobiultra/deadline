/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

type GtagCommand = 'js' | 'config' | 'event'

interface Window {
  dataLayer?: unknown[][]
  gtag?: (command: GtagCommand, target: string | Date, params?: Record<string, unknown>) => void
  doNotTrack?: string
}
