import { expect, test, type Locator, type Page } from '@playwright/test'

function extractLonLat(readout: string) {
  const match = readout.match(/lon\s*(-?\d+(?:\.\d+)?)°\s*·\s*lat\s*(-?\d+(?:\.\d+)?)°/i)
  if (!match) {
    return null
  }

  const lon = Number(match[1])
  const lat = Number(match[2])
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
    return null
  }

  return { lon, lat }
}

function circularLonDelta(a: number, b: number) {
  return Math.abs(((((a - b + 540) % 360) + 360) % 360) - 180)
}

async function waitForLonLat(locator: Locator, page: Page) {
  for (let i = 0; i < 20; i += 1) {
    const text = await locator.innerText()
    const parsed = extractLonLat(text)
    if (parsed) {
      return parsed
    }
    await page.waitForTimeout(100)
  }
  return null
}

async function openDeadlineDrawer(page: Page) {
  await page.getByTestId('deadline-chip').click()
  await expect(page.getByTestId('deadline-drawer')).toBeVisible()
}

test('map-first default layout shows only minimal always-visible surfaces', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear())
  await page.goto('/')

  await expect(page.getByTestId('map2d-view')).toBeVisible()
  await expect(page.getByTestId('deadline-chip')).toBeVisible()
  await expect(page.getByTestId('countdown-hud')).toBeVisible()
  await expect(page.getByTestId('layers-button')).toBeVisible()
  await expect(page.getByRole('button', { name: '2d', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '3d', exact: true })).toBeVisible()

  await expect(page.getByText(/^workflow$/i)).toHaveCount(0)
  await expect(page.getByTestId('info-drawer')).toHaveCount(0)
  await expect(page.getByTestId('deadline-drawer')).toHaveCount(0)
})

test('deadline drawer uses safe draft/apply flow and supports AoE + unwind controls', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear())
  await page.goto('/')

  await openDeadlineDrawer(page)
  await page.locator('input[type="date"]').first().fill('2026-02-05')
  await page.locator('input[type="time"]').first().fill('21:00')
  await page.getByRole('button', { name: 'aoe' }).click()
  await page.getByRole('button', { name: 'now+24h' }).click()
  await page.getByRole('button', { name: '+1d' }).click()

  await expect(page.getByRole('button', { name: /apply draft deadline|apply/i })).toBeVisible()
  await page.getByRole('button', { name: /apply draft deadline|apply/i }).click()
  await page.getByRole('button', { name: /close deadline drawer/i }).click()

  await expect(page.getByTestId('unwind-controls')).toBeVisible()
  await page.getByTestId('unwind-toggle').click()
  await expect(page.getByText(/unwind active/i)).toBeVisible()
  await page.getByRole('button', { name: 'x3600' }).click()
  await page.waitForTimeout(200)
  await page.getByTestId('unwind-toggle').click()

  const chipText = await page.getByTestId('deadline-chip').innerText()
  expect(chipText.toLowerCase()).toContain('aoe')
})

test('layers panel drives overlays + detail lens and keeps map interactive', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.addInitScript(() => window.localStorage.clear())
  await page.goto('/')

  const map2d = page.getByTestId('map2d-view')
  await expect(map2d).toBeVisible()

  await page.getByTestId('layers-button').click()
  const layersPanel = page.getByTestId('layers-panel')
  await expect(layersPanel).toBeVisible()

  await layersPanel
    .getByTestId('detail-mode-segmented')
    .getByRole('button', { name: 'on', exact: true })
    .click()
  await expect(page.getByTestId('detail-map-view')).toBeVisible()

  await layersPanel
    .getByTestId('detail-mode-segmented')
    .getByRole('button', { name: 'off', exact: true })
    .click()
  await expect(page.getByTestId('detail-map-view')).toBeHidden()

  const switches = ['solar lines', 'civil timezones', 'terminator', 'landmarks']
  for (const name of switches) {
    const toggle = layersPanel.getByRole('switch', { name })
    await toggle.click()
    await toggle.click()
  }

  const box = await map2d.boundingBox()
  expect(box).toBeTruthy()
  if (box) {
    await page.mouse.move(box.x + box.width * 0.56, box.y + box.height * 0.52)
    await page.mouse.wheel(0, -600)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.54)
    await page.mouse.up()
  }

  expect(pageErrors).toEqual([])
})

test('zoom remains cursor-anchored in 2d and detail-lens views', async ({ page }) => {
  await page.goto('/?demo=1&view=2d')
  const map2d = page.getByTestId('map2d-view')
  await expect(map2d).toBeVisible()

  const box2d = await map2d.boundingBox()
  expect(box2d).toBeTruthy()
  if (!box2d) {
    return
  }

  const x2d = box2d.x + box2d.width * 0.58
  const y2d = box2d.y + box2d.height * 0.48
  await page.mouse.move(x2d, y2d)
  await expect(page.getByTestId('map2d-hover')).toBeVisible()

  const before2d = await waitForLonLat(page.getByTestId('map2d-hover'), page)
  expect(before2d).not.toBeNull()
  await page.mouse.wheel(0, -760)
  await page.mouse.move(x2d, y2d)
  const after2d = await waitForLonLat(page.getByTestId('map2d-hover'), page)
  expect(after2d).not.toBeNull()
  expect(circularLonDelta(after2d?.lon ?? 0, before2d?.lon ?? 0)).toBeLessThan(0.35)
  expect(Math.abs((after2d?.lat ?? 0) - (before2d?.lat ?? 0))).toBeLessThan(0.35)

  await page.getByTestId('layers-button').click()
  const layersPanel = page.getByTestId('layers-panel')
  await layersPanel
    .getByTestId('detail-mode-segmented')
    .getByRole('button', { name: 'on', exact: true })
    .click()

  const detail = page.getByTestId('detail-map-view')
  await expect(detail).toBeVisible()
  const detailBox = await detail.boundingBox()
  expect(detailBox).toBeTruthy()
  if (!detailBox) {
    return
  }

  const detailX = detailBox.x + detailBox.width * 0.56
  const detailY = detailBox.y + detailBox.height * 0.52
  await page.mouse.move(detailX, detailY)
  const beforeDetail = await waitForLonLat(page.getByTestId('detail-hover-readout'), page)
  expect(beforeDetail).not.toBeNull()
  await page.mouse.wheel(0, -800)
  await page.mouse.move(detailX, detailY)
  const afterDetail = await waitForLonLat(page.getByTestId('detail-hover-readout'), page)
  expect(afterDetail).not.toBeNull()
  expect(circularLonDelta(afterDetail?.lon ?? 0, beforeDetail?.lon ?? 0)).toBeLessThan(1.3)
  expect(Math.abs((afterDetail?.lat ?? 0) - (beforeDetail?.lat ?? 0))).toBeLessThan(1.3)
})

test('3d adds hover tooltip info and 2d/3d switching stays responsive', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.addInitScript(() => window.localStorage.clear())
  await page.goto('/?demo=1')

  await page.getByRole('button', { name: '3d', exact: true }).click()
  const globe = page.getByTestId('globe3d-view')
  await expect(globe).toBeVisible()

  const globeBox = await globe.boundingBox()
  expect(globeBox).toBeTruthy()
  if (globeBox) {
    await page.mouse.move(globeBox.x + globeBox.width * 0.5, globeBox.y + globeBox.height * 0.48)
    await page.waitForTimeout(280)
    await page.mouse.wheel(0, -220)
    await page.mouse.down()
    await page.mouse.move(globeBox.x + globeBox.width * 0.64, globeBox.y + globeBox.height * 0.5)
    await page.mouse.up()
  }

  const tooltip = page.getByTestId('globe-hover-tooltip')
  await expect(tooltip).toBeVisible()
  await expect(tooltip).toContainText(/civil:/i)
  await expect(tooltip).toContainText(/solar:/i)
  await expect(tooltip).toContainText(/Δ target:/i)

  await page.getByRole('button', { name: '2d', exact: true }).click()
  await expect(page.getByTestId('map2d-view')).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'snap' }).click()
  const download = await downloadPromise
  expect(await download.path()).toBeTruthy()

  expect(pageErrors).toEqual([])
})

test('edge-safe HUD has no corner overlaps across key viewports', async ({ page }) => {
  const viewports = [
    { width: 1920, height: 1080 },
    { width: 1440, height: 900 },
    { width: 1280, height: 720 },
    { width: 390, height: 844 }
  ] as const

  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    await page.goto('/?debug=1')
    await expect(page.getByText(/warnings:\s*0/i)).toBeVisible({ timeout: 8_000 })

    const chip = page.getByTestId('deadline-chip')
    const countdown = page.getByTestId('countdown-hud')
    const layers = page.getByTestId('layers-button')

    await expect(chip).toBeVisible()
    await expect(countdown).toBeVisible()
    await expect(layers).toBeVisible()

    const topControls = await (async () => {
      const compactMenu = page.getByTestId('top-controls-menu')
      if ((await compactMenu.count()) > 0) {
        return compactMenu
      }
      return page.getByTestId('top-controls')
    })()
    await expect(topControls).toBeVisible()

    const boxes = await Promise.all([
      chip.boundingBox(),
      topControls.boundingBox(),
      countdown.boundingBox(),
      layers.boundingBox()
    ])

    for (const box of boxes) {
      expect(box).toBeTruthy()
      if (!box) {
        continue
      }
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.y).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height)
    }

    const validBoxes = boxes.filter((box): box is NonNullable<typeof box> => Boolean(box))
    for (let i = 0; i < validBoxes.length; i += 1) {
      for (let j = i + 1; j < validBoxes.length; j += 1) {
        const a = validBoxes[i]
        const b = validBoxes[j]
        if (!a || !b) {
          continue
        }
        const overlap =
          a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
        expect(overlap).toBeFalsy()
      }
    }
  }
})
