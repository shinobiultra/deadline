import { expect, test } from '@playwright/test'

test('deadline controls, wrapped map interactions, detail zoom and snapshot stay stable', async ({
  page
}) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.addInitScript(() => window.localStorage.clear())

  await page.goto('/')

  await expect(page.getByTestId('countdown-card')).toBeVisible()
  const map2d = page.getByTestId('map2d-view')
  await expect(map2d).toBeVisible()

  await page.locator('input[type="date"]').first().fill('2026-12-31')
  await page.locator('input[type="time"]').first().fill('22:45')

  await page.getByTestId('timezone-search').fill('aoe')
  await page.getByTestId('timezone-select').selectOption('Etc/GMT+12')
  await expect(page.getByText(/^selected: Anywhere on Earth/)).toBeVisible()

  const mapBox = await map2d.boundingBox()
  if (mapBox) {
    for (let i = 0; i < 4; i += 1) {
      await page.mouse.move(mapBox.x + mapBox.width * 0.5, mapBox.y + mapBox.height * 0.45)
      await page.mouse.down()
      await page.mouse.move(
        mapBox.x + mapBox.width * 0.5 + 800 + i * 120,
        mapBox.y + mapBox.height * 0.45 + i * 8
      )
      await page.mouse.up()
    }

    await page.mouse.move(mapBox.x + mapBox.width * 0.44, mapBox.y + mapBox.height * 0.4)
    await page.mouse.wheel(0, -560)
    await page.mouse.dblclick(mapBox.x + mapBox.width * 0.56, mapBox.y + mapBox.height * 0.54)
  }

  await expect(map2d.getByText(/x$/)).toBeVisible()

  await page.getByRole('button', { name: 'detail zoom' }).click()
  const detail = page.getByTestId('detail-map-view')
  await expect(detail).toBeVisible()
  await page.getByRole('button', { name: 'building close-up' }).click()
  await page.getByRole('button', { name: 'follow line: on' }).click()

  const detailBox = await detail.boundingBox()
  if (detailBox) {
    await page.mouse.move(detailBox.x + detailBox.width * 0.5, detailBox.y + detailBox.height * 0.55)
    await page.mouse.wheel(0, 2800)
    await page.mouse.wheel(0, 2800)
  }

  if (await detail.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: 'detail zoom' }).click()
  }

  await expect(page.getByTestId('map2d-view')).toBeVisible()

  await page.getByRole('button', { name: 'reset view' }).click()
  await expect(map2d.getByText('1.00x')).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'snap' }).click()
  const download = await downloadPromise
  const path = await download.path()
  expect(path).toBeTruthy()

  expect(pageErrors).toEqual([])
})

test('globe view keeps visible lines, supports drag/zoom and detail mode', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.addInitScript(() => window.localStorage.clear())

  await page.goto('/')

  await page.getByRole('button', { name: '3d globe' }).click()
  const globe = page.getByTestId('globe3d-view')
  await expect(globe).toBeVisible()

  const globeBox = await globe.boundingBox()
  if (globeBox) {
    for (let i = 0; i < 3; i += 1) {
      await page.mouse.move(globeBox.x + globeBox.width * 0.52, globeBox.y + globeBox.height * 0.48)
      await page.mouse.down()
      await page.mouse.move(
        globeBox.x + globeBox.width * (0.65 + i * 0.05),
        globeBox.y + globeBox.height * 0.5
      )
      await page.mouse.up()
      await page.mouse.wheel(0, i % 2 === 0 ? 260 : -180)
    }
  }

  await expect(page.getByText(/manual orbit active/i)).toBeVisible()
  await page.getByRole('button', { name: 'reset orbit' }).click()

  await expect(page.getByText(/target .* in/).first()).toBeVisible()

  await page.getByRole('button', { name: 'detail zoom' }).click()
  const detail = page.getByTestId('detail-map-view')
  await expect(detail).toBeVisible()
  await expect(detail.getByText(/pitched/)).toBeVisible()

  await page.getByRole('button', { name: 'detail zoom' }).click()
  await expect(page.getByTestId('globe3d-view')).toBeVisible()

  await page.getByRole('button', { name: '2d map' }).click()
  await expect(page.getByTestId('map2d-view')).toBeVisible()

  expect(pageErrors).toEqual([])
})

test('debug layout checks report zero overlap/tap-target warnings on desktop', async ({ page }) => {
  await page.goto('/?debug=1')
  await expect(page.getByText(/warnings:\s*0/i)).toBeVisible({ timeout: 8_000 })
})
