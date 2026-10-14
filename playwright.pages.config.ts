import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', testMatch: 'pages.spec.ts', workers: 1,
  timeout: 60000, expect: { timeout: 15000 },
  use: { baseURL: process.env.PAGES_URL ?? 'http://127.0.0.1:5180/Pixel3Dwizhack/', headless: true, viewport: { width: 1280, height: 720 }, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  ...(process.env.PAGES_URL ? {} : { webServer: { command: 'npm run preview -- --mode pages --port 5180 --strictPort', url: 'http://127.0.0.1:5180/Pixel3Dwizhack/' } })
});
