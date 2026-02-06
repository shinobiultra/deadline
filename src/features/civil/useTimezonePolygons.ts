import { useEffect, useState } from 'react'
import {
  loadTimezonePolygonDataset,
  type TimezonePolygonFeature,
  type TimezonePolygonStatus
} from './timezonePolygons'

type TimezonePolygonsResult = {
  status: TimezonePolygonStatus
  features: TimezonePolygonFeature[]
}

export function useTimezonePolygons(enabled: boolean): TimezonePolygonsResult {
  const [status, setStatus] = useState<TimezonePolygonStatus>('idle')
  const [features, setFeatures] = useState<TimezonePolygonFeature[]>([])

  useEffect(() => {
    if (!enabled) {
      setStatus('idle')
      setFeatures([])
      return
    }

    let active = true
    setStatus('loading')

    void loadTimezonePolygonDataset().then((result) => {
      if (!active) {
        return
      }

      setStatus(result.status)
      setFeatures(result.features)
    })

    return () => {
      active = false
    }
  }, [enabled])

  return { status, features }
}
