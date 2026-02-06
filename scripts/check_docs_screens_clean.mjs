import fs from 'node:fs'
import { execSync } from 'node:child_process'
import { PNG } from 'pngjs'

const MAX_ALLOWED_PIXEL_DRIFT_RATIO = 0.005

function parseStatusEntries(rawStatus) {
  if (!rawStatus.trim()) {
    return []
  }

  return rawStatus
    .trim()
    .split('\n')
    .map((line) => ({
      code: line.slice(0, 2),
      path: line.replace(/^[ MADRCU?!]{1,2}\s+/, '').trim()
    }))
}

function readHeadBuffer(path) {
  try {
    return execSync(`git show HEAD:${path}`, { encoding: 'buffer', stdio: ['pipe', 'pipe', 'ignore'] })
  } catch {
    return null
  }
}

function pngPixelDriftRatio(leftBuffer, rightBuffer) {
  const left = PNG.sync.read(leftBuffer)
  const right = PNG.sync.read(rightBuffer)
  if (left.width !== right.width || left.height !== right.height) {
    return Number.POSITIVE_INFINITY
  }

  let diffPixels = 0
  for (let index = 0; index < left.data.length; index += 4) {
    if (
      left.data[index] !== right.data[index] ||
      left.data[index + 1] !== right.data[index + 1] ||
      left.data[index + 2] !== right.data[index + 2] ||
      left.data[index + 3] !== right.data[index + 3]
    ) {
      diffPixels += 1
    }
  }

  const totalPixels = left.width * left.height
  return totalPixels === 0 ? Number.POSITIVE_INFINITY : diffPixels / totalPixels
}

const rawStatus = execSync('git status --porcelain -- docs/screens', { encoding: 'utf8' })
const entries = parseStatusEntries(rawStatus)

if (entries.length === 0) {
  console.log('docs/screens are up to date')
  process.exit(0)
}

const pixelChanged = []
const minorDrift = []

for (const entry of entries) {
  const path = entry.path

  if (!path.endsWith('.png')) {
    pixelChanged.push(path)
    continue
  }

  if (entry.code.includes('?')) {
    pixelChanged.push(path)
    continue
  }

  const headBuffer = readHeadBuffer(path)
  if (!headBuffer) {
    pixelChanged.push(path)
    continue
  }

  const currentBuffer = fs.readFileSync(path)
  const driftRatio = pngPixelDriftRatio(headBuffer, currentBuffer)
  if (!Number.isFinite(driftRatio)) {
    pixelChanged.push(path)
    continue
  }

  if (driftRatio <= MAX_ALLOWED_PIXEL_DRIFT_RATIO) {
    minorDrift.push({ path, driftRatio })
  } else {
    pixelChanged.push(path)
  }
}

if (pixelChanged.length > 0) {
  console.error(
    'docs/screens changed with visible pixel deltas. run `npm run ui:capture` and commit updates.'
  )
  for (const path of pixelChanged) {
    console.error(`- ${path}`)
  }
  process.exit(1)
}

if (minorDrift.length > 0) {
  console.log(
    `docs/screens drift is within tolerance (<= ${(MAX_ALLOWED_PIXEL_DRIFT_RATIO * 100).toFixed(2)}% pixels).`
  )
  for (const entry of minorDrift) {
    console.log(`- ${entry.path} (${(entry.driftRatio * 100).toFixed(3)}%)`)
  }
}

process.exit(0)
