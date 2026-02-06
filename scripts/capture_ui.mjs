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
  await page.screenshot({ path: docsPath, fullPage: true })
  await fs.copyFile(docsPath, artifactsPath)
}

await page.goto(`${baseUrl}/?demo=1&view=2d`, { waitUntil: 'networkidle' })
await page.waitForTimeout(900)
await shot('demo-2d.png')

await page.goto(`${baseUrl}/?demo=1&view=3d`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1600)
await shot('demo-3d.png')

const globe = page.getByTestId('globe3d-view')
const globeBox = await globe.boundingBox()
if (globeBox) {
  await page.mouse.move(globeBox.x + globeBox.width * 0.52, globeBox.y + globeBox.height * 0.48)
  await page.mouse.down()
  await page.mouse.move(globeBox.x + globeBox.width * 0.7, globeBox.y + globeBox.height * 0.44)
  await page.mouse.up()
}
await page.waitForTimeout(700)
await shot('demo-3d-rotated.png')

await page.goto(`${baseUrl}/?demo=1&view=detail`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1400)
await shot('demo-detail.png')

await page.goto(`${baseUrl}/?demo=1&debug=1&view=2d`, { waitUntil: 'networkidle' })
await page.waitForTimeout(900)
await shot('demo-debug.png')

await page.setViewportSize({ width: 390, height: 844 })
await page.goto(`${baseUrl}/?demo=1&view=2d`, { waitUntil: 'networkidle' })
await page.waitForTimeout(900)
await shot('demo-mobile-2d.png')

await browser.close()
console.log(`captured screenshots in ${docsScreensDir}`)
