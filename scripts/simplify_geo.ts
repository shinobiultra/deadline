import fs from 'node:fs'
import path from 'node:path'

const source = path.resolve('public/data/world-110m.topo.json')
const destination = path.resolve('public/data/world-110m.topo.json')

// Placeholder utility hook for future simplification workflow.
const data = fs.readFileSync(source)
fs.writeFileSync(destination, data)
console.log(`copied ${source} -> ${destination}`)
