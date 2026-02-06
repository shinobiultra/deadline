import { expect, test } from '@playwright/test'

test('gh pages build renders 2d map assets with non-empty canvas pixels', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await page.goto('/?debug=1')

  const map2d = page.getByTestId('map2d-view')
  await expect(map2d).toBeVisible()
  await expect(page.getByText(/assets broken/i)).toHaveCount(0)

  const canvasHasContent = await map2d.locator('canvas').evaluate((canvas) => {
    if (!(canvas instanceof HTMLCanvasElement)) {
      return false
    }

    const context = canvas.getContext('2d')
    if (!context || canvas.width === 0 || canvas.height === 0) {
      return false
    }

    const samples = [
      [0.5, 0.5],
      [0.25, 0.35],
      [0.75, 0.65]
    ] as const

    return samples.some(([xRatio, yRatio]) => {
      const x = Math.max(0, Math.min(canvas.width - 1, Math.floor(canvas.width * xRatio)))
      const y = Math.max(0, Math.min(canvas.height - 1, Math.floor(canvas.height * yRatio)))
      const alpha = context.getImageData(x, y, 1, 1).data[3] ?? 0
      return alpha > 0
    })
  })

  expect(canvasHasContent).toBe(true)
  expect(pageErrors).toEqual([])
})

test('gh pages build creates webgl globe context and visible line overlays', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await page.goto('/')
  await page.getByRole('button', { name: '3d globe' }).click()

  const globe = page.getByTestId('globe3d-view')
  await expect(globe).toBeVisible()

  const hasWebglContext = await globe
    .locator('canvas')
    .first()
    .evaluate((canvas) => {
      if (!(canvas instanceof HTMLCanvasElement)) {
        return false
      }

      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
      return Boolean(gl)
    })

  expect(hasWebglContext).toBe(true)
  await expect(page.getByText(/solar now/i).first()).toBeVisible()
  expect(pageErrors).toEqual([])
})
