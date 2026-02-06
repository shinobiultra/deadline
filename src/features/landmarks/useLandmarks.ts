import { useEffect, useState } from 'react'
import { assetUrl } from '@/lib/assets'
import type { Landmark } from './types'

export function useLandmarks(): Landmark[] {
  const [landmarks, setLandmarks] = useState<Landmark[]>([])

  useEffect(() => {
    let active = true

    fetch(assetUrl('data/landmarks_core.json'))
      .then((response) => response.json())
      .then((data: Landmark[]) => {
        if (active) {
          setLandmarks(data)
        }
      })
      .catch(() => {
        if (active) {
          setLandmarks([])
        }
      })

    return () => {
      active = false
    }
  }, [])

  return landmarks
}
