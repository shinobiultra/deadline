import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from '@playwright/test'

const docsScreensDir = path.resolve('docs/screens')
const artifactsDir = path.resolve('artifacts/ui')
const baseUrl = process.env.CAPTURE_BASE_URL || 'http://127.0.0.1:4173'

await fs.mkdir(docsScreensDir, { recursive: true })
await fs.mkdir(artifactsDir, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.addInitScript(() => window.localStorage.clear())

async function shot(name) {
  const docsPath = path.join(docsScreensDir, name)
  const artifactsPath = path.join(artifactsDir, name)
  await page.screenshot({
    path: docsPath,
    fullPage: true,
    animations: 'disabled',
    caret: 'hide',
    scale: 'css'
  })
  await fs.copyFile(docsPath, artifactsPath)
}

await page.goto(`${baseUrl}/?demo=1&capture=1&view=2d`, { waitUntil: 'networkidle' })
await page.waitForSelector('[data-testid="map2d-view"]')
await page.waitForTimeout(250)
await shot('demo-2d.png')

await page.goto(`${baseUrl}/?demo=1&capture=1&view=3d`, { waitUntil: 'networkidle' })
await page.waitForSelector('[data-testid="globe3d-view"][data-globe-ready="1"][data-world-ready="1"]')
await page.waitForTimeout(250)
await shot('demo-3d.png')

await page.evaluate(() => {
  const bridge = window
  if (typeof bridge.__deadlineCaptureSetGlobeView === 'function') {
    bridge.__deadlineCaptureSetGlobeView(7, -114, 1.84)
  }
})
await page.waitForTimeout(140)
await shot('demo-3d-rotated.png')

await page.goto(`${baseUrl}/?demo=1&capture=1&view=detail`, { waitUntil: 'networkidle' })
await page.waitForSelector('[data-testid="detail-map-view"][data-loaded="1"]')
await page.waitForTimeout(250)
await shot('demo-detail.png')

await page.goto(`${baseUrl}/?demo=1&capture=1&debug=1&view=2d`, { waitUntil: 'networkidle' })
await page.waitForSelector('[data-testid="map2d-view"]')
await page.waitForTimeout(250)
await shot('demo-debug.png')

await page.setViewportSize({ width: 390, height: 844 })
await page.goto(`${baseUrl}/?demo=1&capture=1&view=2d`, { waitUntil: 'networkidle' })
await page.waitForSelector('[data-testid="map2d-view"]')
await page.waitForTimeout(250)
await shot('demo-mobile-2d.png')

await browser.close()
console.log(`captured screenshots in ${docsScreensDir}`)
