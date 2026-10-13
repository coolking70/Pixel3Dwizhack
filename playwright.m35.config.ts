import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests/browser',testMatch:'m35-*.spec.ts',workers:1,fullyParallel:false,timeout:90000,expect:{timeout:15000},use:{baseURL:process.env.M35_URL??'http://127.0.0.1:4235',headless:true,viewport:{width:1280,height:720},trace:'retain-on-failure',screenshot:'only-on-failure'},projects:[{name:'m35-chromium'}]});
