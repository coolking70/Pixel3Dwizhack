import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', testMatch: 'm26-ux.spec.ts', workers: 1, fullyParallel: false,
  use: { baseURL: process.env.M26_URL ?? 'http://127.0.0.1:5190', headless: true, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'm26-desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'm26-landscape', use: { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true } },
    { name: 'm26-portrait', use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
    { name: 'm26-firefox', use: { browserName: 'firefox', viewport: { width: 1440, height: 900 } } },
    { name: 'm26-webkit', use: { browserName: 'webkit', viewport: { width: 1440, height: 900 } } },
  ],
});
