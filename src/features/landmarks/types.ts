export type Landmark = {
  id: string
  name: string
  lat: number
  lon: number
  tags: string[]
}

export type LandmarkCrossing = {
  id: string
  landmark: Landmark
  crossingMs: number
}
