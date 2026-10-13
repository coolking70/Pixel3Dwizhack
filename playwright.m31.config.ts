import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'./tests/browser',testMatch:'m31-*.spec.ts',workers:1,fullyParallel:false,
 use:{baseURL:process.env.M31_URL??'http://127.0.0.1:4231',headless:true,viewport:{width:1280,height:800},trace:'retain-on-failure',screenshot:'only-on-failure'},
 projects:[{name:'m31-chromium'}]});
