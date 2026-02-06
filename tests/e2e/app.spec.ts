import { expect, test } from '@playwright/test'

test('deadline controls and map/globe interactions work', async ({ page }) => {
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
    await page.mouse.move(mapBox.x + mapBox.width * 0.5, mapBox.y + mapBox.height * 0.5)
    await page.mouse.down()
    await page.mouse.move(mapBox.x + mapBox.width * 0.55, mapBox.y + mapBox.height * 0.45)
    await page.mouse.up()
    await page.mouse.wheel(0, -360)
  }

  await page.getByRole('button', { name: '3d globe' }).click()
  const globe = page.getByTestId('globe3d-view')
  await expect(globe).toBeVisible()

  const globeBox = await globe.boundingBox()
  if (globeBox) {
    await page.mouse.move(globeBox.x + globeBox.width * 0.5, globeBox.y + globeBox.height * 0.5)
    await page.mouse.down()
    await page.mouse.move(globeBox.x + globeBox.width * 0.65, globeBox.y + globeBox.height * 0.5)
    await page.mouse.up()
    await page.mouse.wheel(0, 260)
  }

  await page.getByRole('button', { name: '2d map' }).click()
  await expect(map2d).toBeVisible()
})
