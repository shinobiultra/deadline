const GA_TRACKING_ID = 'G-VM89N0KP5H'

type EventValue = string | number | boolean | null | undefined
type EventParams = Record<string, EventValue>

function isDoNotTrackEnabled() {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    return false
  }

  const nav = navigator as Navigator & { msDoNotTrack?: string }
  return (
    navigator.doNotTrack === '1' ||
    window.doNotTrack === '1' ||
    nav.msDoNotTrack === '1' ||
    navigator.doNotTrack === 'yes'
  )
}

function isLocalHost() {
  if (typeof window === 'undefined') {
    return true
  }

  return (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '[::1]'
  )
}

export function analyticsEnabled() {
  if (typeof window === 'undefined') {
    return false
  }

  return import.meta.env.PROD && !isLocalHost() && !isDoNotTrackEnabled()
}

export function initAnalytics() {
  if (!analyticsEnabled()) {
    return
  }

  if (typeof window.gtag === 'function') {
    return
  }

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_TRACKING_ID}`
  document.head.appendChild(script)

  window.dataLayer = window.dataLayer || []
  window.gtag = (...args: unknown[]) => {
    window.dataLayer?.push(args)
  }

  window.gtag('js', new Date())
  window.gtag('config', GA_TRACKING_ID, {
    anonymize_ip: true
  })
}

export function trackEvent(name: string, params?: EventParams) {
  if (!analyticsEnabled() || typeof window.gtag !== 'function') {
    return
  }

  window.gtag('event', name, params ?? {})
}
