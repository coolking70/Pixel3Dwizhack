import { defineConfig } from '@playwright/test';
export default defineConfig({
 testDir:'./tests/browser',testMatch:'direct-interaction.spec.ts',workers:1,fullyParallel:false,
 use:{baseURL:process.env.M25_URL??'http://127.0.0.1:5174',headless:true,trace:'retain-on-failure',screenshot:'only-on-failure'},
 ...(process.env.CI?{webServer:{command:'npm run preview -- --port 5174 --strictPort',url:'http://127.0.0.1:5174'}}:{}),
 projects:[
  {name:'m25-desktop',use:{viewport:{width:1440,height:900}}},
  {name:'m25-landscape',use:{viewport:{width:844,height:390},hasTouch:true,isMobile:true}},
  {name:'m25-portrait',use:{viewport:{width:390,height:844},hasTouch:true,isMobile:true}},
  {name:'m25-firefox',use:{browserName:'firefox',viewport:{width:1440,height:900}}},
  {name:'m25-webkit',use:{browserName:'webkit',viewport:{width:1440,height:900}}},
 ],
});
