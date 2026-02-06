import { defineConfig, devices } from '@playwright/test'

const repo = process.env.GH_PAGES_REPO || 'deadline'
const port = process.env.GH_PAGES_PORT || '4176'
const baseURL = `http://127.0.0.1:${port}/${repo}/`

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/gh-pages.spec.ts',
  timeout: 35_000,
  fullyParallel: true,
  use: {
    baseURL,
    trace: 'on-first-retry'
  },
  webServer: {
    command: `GITHUB_PAGES=true GITHUB_PAGES_REPO=${repo} npm run build && GH_PAGES_REPO=${repo} GH_PAGES_PORT=${port} node scripts/serve_gh_pages_dist.mjs`,
    port: Number(port),
    reuseExistingServer: !process.env.CI
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
})
