import { test, expect } from '@playwright/test'

test('renders countdown and can switch views', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByTestId('countdown-card')).toBeVisible()
  await expect(page.getByTestId('map2d-view')).toBeVisible()

  await page.getByRole('button', { name: '3d globe' }).click()
  await expect(page.getByTestId('globe3d-view')).toBeVisible()

  await page.getByRole('button', { name: '2d map' }).click()
  await expect(page.getByTestId('map2d-view')).toBeVisible()
})
