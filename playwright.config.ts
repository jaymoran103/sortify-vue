import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright configuration.
 *
 * The suite is not part of `pnpm test` (which is vitest only) and is not wired into CI. It is run
 * on demand with `pnpm test:e2e`. Chromium alone: the app targets desktop browsers and the suite
 * exists to prove end-to-end behaviour, not cross-browser rendering.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',

  use: {
    // Includes the GitHub Pages base path, which vite.config.ts sets for production builds.
    baseURL: 'http://localhost:4173/sortify-vue/',
    trace: 'on-first-retry',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  // Runs against the production build, so the suite exercises the same worker chunk that ships.
  webServer: {
    command: 'pnpm build-only && pnpm preview --port 4173',
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
