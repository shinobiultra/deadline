import fs from 'node:fs'
import path from 'node:path'

type Landmark = {
  id: string
  name: string
  lat: number
  lon: number
  tags: string[]
}

const outputPath = path.resolve('public/data/landmarks_core.json')

// Simple placeholder script: validates schema and rewrites canonical formatting.
const input = JSON.parse(fs.readFileSync(outputPath, 'utf8')) as Landmark[]

for (const entry of input) {
  if (!entry.id || Number.isNaN(entry.lat) || Number.isNaN(entry.lon)) {
    throw new Error(`invalid landmark entry: ${JSON.stringify(entry)}`)
  }
}

fs.writeFileSync(outputPath, `${JSON.stringify(input, null, 2)}\n`)
console.log(`validated ${input.length} landmarks -> ${outputPath}`)
