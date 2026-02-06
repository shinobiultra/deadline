import fs from 'node:fs/promises'
import path from 'node:path'
import { gzipSync } from 'node:zlib'

const distAssetsDir = path.resolve('dist/assets')
const outputDir = path.resolve('artifacts/perf')
const outputPath = path.join(outputDir, 'perf-report.json')

const thresholds = {
  mainJsBytes: Number(process.env.PERF_MAX_MAIN_JS_BYTES ?? 2_200_000),
  globeJsBytes: Number(process.env.PERF_MAX_GLOBE_JS_BYTES ?? 2_200_000),
  cssBytes: Number(process.env.PERF_MAX_CSS_BYTES ?? 130_000)
}

function toKiB(bytes) {
  return `${(bytes / 1024).toFixed(2)} KiB`
}

const entries = await fs.readdir(distAssetsDir, { withFileTypes: true })
const files = entries.filter((entry) => entry.isFile()).map((entry) => entry.name)

const reports = []
for (const file of files) {
  const fullPath = path.join(distAssetsDir, file)
  const content = await fs.readFile(fullPath)
  reports.push({
    file,
    bytes: content.byteLength,
    gzipBytes: gzipSync(content).byteLength
  })
}

reports.sort((a, b) => b.bytes - a.bytes)

const mainBundle = reports.find((item) => /^index-.*\.js$/.test(item.file))
const globeBundle = reports.find((item) => /^Globe3DView-.*\.js$/.test(item.file))
const cssBundle = reports.find((item) => /^index-.*\.css$/.test(item.file))

const checks = [
  {
    label: 'main-js',
    report: mainBundle,
    limit: thresholds.mainJsBytes
  },
  {
    label: 'globe-js',
    report: globeBundle,
    limit: thresholds.globeJsBytes
  },
  {
    label: 'main-css',
    report: cssBundle,
    limit: thresholds.cssBytes
  }
]

const failures = []
for (const check of checks) {
  if (!check.report) {
    failures.push(`${check.label}: bundle not found`)
    continue
  }

  if (check.report.bytes > check.limit) {
    failures.push(
      `${check.label}: ${check.report.file} is ${check.report.bytes} bytes, limit ${check.limit} bytes`
    )
  }
}

const summary = {
  generatedAt: new Date().toISOString(),
  thresholds,
  topBundles: reports.slice(0, 12),
  keyBundles: {
    main: mainBundle ?? null,
    globe: globeBundle ?? null,
    css: cssBundle ?? null
  },
  failures
}

await fs.mkdir(outputDir, { recursive: true })
await fs.writeFile(outputPath, `${JSON.stringify(summary, null, 2)}\n`)

console.log(`perf report written: ${outputPath}`)
for (const report of reports.slice(0, 8)) {
  console.log(
    `${report.file.padEnd(42)} raw ${toKiB(report.bytes).padStart(12)} | gzip ${toKiB(report.gzipBytes)}`
  )
}

if (failures.length > 0) {
  console.error('\nperformance threshold failures:')
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log('\nperformance thresholds passed')
