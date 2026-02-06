import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from '@playwright/test'

const outputDir = path.resolve('artifacts/ui')
await fs.mkdir(outputDir, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://127.0.0.1:4173/?debug=1', { waitUntil: 'networkidle' })
await page.screenshot({ path: path.join(outputDir, 'desktop-debug.png'), fullPage: true })

await page.setViewportSize({ width: 390, height: 844 })
await page.goto('http://127.0.0.1:4173/?debug=1', { waitUntil: 'networkidle' })
await page.screenshot({ path: path.join(outputDir, 'mobile-debug.png'), fullPage: true })

await browser.close()
console.log(`captured screenshots in ${outputDir}`)
