import { DateTime } from 'luxon'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AmbiguousPreference, LocationPoint, PreviewMode } from './types'

export type DeadlineStore = {
  deadlineDate: string
  deadlineTime: string
  deadlineZone: string
  ambiguousPreference: AmbiguousPreference
  location: LocationPoint | null
  showTimezones: boolean
  showSolarTime: boolean
  showDayNight: boolean
  previewMode: PreviewMode
  useApparentSolar: boolean
  useTimezonePolygons: boolean
  civilGlowMinutes: number
  alertThresholdMinutes: number[]
  enableCrossingAlerts: boolean
  enableBrowserNotifications: boolean
  setDeadlineDate: (value: string) => void
  setDeadlineTime: (value: string) => void
  setDeadlineZone: (value: string) => void
  setAmbiguousPreference: (value: AmbiguousPreference) => void
  setLocation: (location: LocationPoint | null) => void
  setShowTimezones: (value: boolean) => void
  setShowSolarTime: (value: boolean) => void
  setShowDayNight: (value: boolean) => void
  setPreviewMode: (value: PreviewMode) => void
  setUseApparentSolar: (value: boolean) => void
  setUseTimezonePolygons: (value: boolean) => void
  setCivilGlowMinutes: (value: number) => void
  setAlertThresholds: (minutes: number[]) => void
  setEnableCrossingAlerts: (value: boolean) => void
  setEnableBrowserNotifications: (value: boolean) => void
}

const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

const tomorrow = DateTime.now().plus({ day: 1 })

export const useDeadlineStore = create<DeadlineStore>()(
  persist(
    (set) => ({
      deadlineDate: tomorrow.toISODate() ?? '2026-12-31',
      deadlineTime: '22:00',
      deadlineZone: localZone,
      ambiguousPreference: 'earlier',
      location: null,
      showTimezones: true,
      showSolarTime: true,
      showDayNight: true,
      previewMode: 'now',
      useApparentSolar: false,
      useTimezonePolygons: false,
      civilGlowMinutes: 15,
      alertThresholdMinutes: [1440, 360, 60, 15, 5, 1],
      enableCrossingAlerts: true,
      enableBrowserNotifications: false,
      setDeadlineDate: (value) => set({ deadlineDate: value }),
      setDeadlineTime: (value) => set({ deadlineTime: value }),
      setDeadlineZone: (value) => set({ deadlineZone: value }),
      setAmbiguousPreference: (value) => set({ ambiguousPreference: value }),
      setLocation: (location) => set({ location }),
      setShowTimezones: (value) => set({ showTimezones: value }),
      setShowSolarTime: (value) => set({ showSolarTime: value }),
      setShowDayNight: (value) => set({ showDayNight: value }),
      setPreviewMode: (value) => set({ previewMode: value }),
      setUseApparentSolar: (value) => set({ useApparentSolar: value }),
      setUseTimezonePolygons: (value) => set({ useTimezonePolygons: value }),
      setCivilGlowMinutes: (value) => set({ civilGlowMinutes: value }),
      setAlertThresholds: (minutes) => set({ alertThresholdMinutes: minutes }),
      setEnableCrossingAlerts: (value) => set({ enableCrossingAlerts: value }),
      setEnableBrowserNotifications: (value) => set({ enableBrowserNotifications: value })
    }),
    {
      name: 'deadline-state-v1',
      partialize: (state) => ({
        deadlineDate: state.deadlineDate,
        deadlineTime: state.deadlineTime,
        deadlineZone: state.deadlineZone,
        ambiguousPreference: state.ambiguousPreference,
        location: state.location,
        showTimezones: state.showTimezones,
        showSolarTime: state.showSolarTime,
        showDayNight: state.showDayNight,
        previewMode: state.previewMode,
        useApparentSolar: state.useApparentSolar,
        useTimezonePolygons: state.useTimezonePolygons,
        civilGlowMinutes: state.civilGlowMinutes,
        alertThresholdMinutes: state.alertThresholdMinutes,
        enableCrossingAlerts: state.enableCrossingAlerts,
        enableBrowserNotifications: state.enableBrowserNotifications
      })
    }
  )
)
