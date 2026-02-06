import { useEffect, useMemo, useState } from 'react'

export type CityRecord = {
  name: string
  country: string
  lat: number
  lon: number
  zone: string
}

export function useCities(query: string): CityRecord[] {
  const [cities, setCities] = useState<CityRecord[]>([])

  useEffect(() => {
    let active = true

    fetch('/data/cities_ne_min.json')
      .then((response) => response.json())
      .then((data: CityRecord[]) => {
        if (active) {
          setCities(data)
        }
      })
      .catch(() => {
        if (active) {
          setCities([])
        }
      })

    return () => {
      active = false
    }
  }, [])

  return useMemo(() => {
    if (!query.trim()) {
      return cities.slice(0, 8)
    }

    const normalized = query.trim().toLowerCase()
    return cities
      .filter(
        (city) =>
          city.name.toLowerCase().includes(normalized) ||
          city.country.toLowerCase().includes(normalized) ||
          city.zone.toLowerCase().includes(normalized)
      )
      .slice(0, 8)
  }, [cities, query])
}
