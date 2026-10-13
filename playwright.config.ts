import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', testIgnore:['direct-interaction.spec.ts','m26-ux.spec.ts'], fullyParallel: false,
  use: { baseURL: process.env.E2E_BASE_URL??'http://127.0.0.1:4173', headless: true },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } }],
  ...(process.env.E2E_BASE_URL?{}:{webServer: { command: 'npm run preview -- --port 4173 --strictPort', url: 'http://127.0.0.1:4173', reuseExistingServer: !process.env.CI }})
});
