import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from '@playwright/test'

const outputDir = path.resolve('artifacts/ui')
const baseUrl = process.env.CAPTURE_BASE_URL || 'http://127.0.0.1:4173'
await fs.mkdir(outputDir, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.addInitScript(() => window.localStorage.clear())

await page.goto(`${baseUrl}/?debug=1`, { waitUntil: 'networkidle' })
await page.screenshot({ path: path.join(outputDir, 'desktop-debug.png'), fullPage: true })

await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
await page.screenshot({ path: path.join(outputDir, 'desktop-2d-default.png'), fullPage: true })

await page.getByRole('button', { name: '3d globe' }).click()
await page.waitForTimeout(1800)
await page.screenshot({ path: path.join(outputDir, 'desktop-3d-view-a.png'), fullPage: true })

const globe = page.getByTestId('globe3d-view')
const globeBox = await globe.boundingBox()
if (globeBox) {
  await page.mouse.move(globeBox.x + globeBox.width * 0.55, globeBox.y + globeBox.height * 0.48)
  await page.mouse.down()
  await page.mouse.move(globeBox.x + globeBox.width * 0.72, globeBox.y + globeBox.height * 0.5)
  await page.mouse.up()
  await page.mouse.wheel(0, -180)
}

await page.waitForTimeout(1000)
await page.screenshot({ path: path.join(outputDir, 'desktop-3d-view-b.png'), fullPage: true })

await page.getByRole('button', { name: 'detail zoom' }).click()
await page.waitForTimeout(1500)

const detail = page.getByTestId('detail-map-view')
const detailBox = await detail.boundingBox()
if (detailBox) {
  await page.mouse.move(detailBox.x + detailBox.width * 0.56, detailBox.y + detailBox.height * 0.58)
  await page.mouse.wheel(0, -2200)
  await page.waitForTimeout(1400)
}

await page.screenshot({ path: path.join(outputDir, 'desktop-detail-map.png'), fullPage: true })

await page.setViewportSize({ width: 390, height: 844 })
await page.goto(`${baseUrl}/?debug=1`, { waitUntil: 'networkidle' })
await page.screenshot({ path: path.join(outputDir, 'mobile-debug.png'), fullPage: true })

await browser.close()
console.log(`captured screenshots in ${outputDir}`)
