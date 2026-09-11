const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: __dirname,
  testMatch: '*.spec.js',
  timeout: 240000,
  expect: { timeout: 20000 },
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: { baseURL: process.env.BROWSER_BASE_URL || 'http://localhost:5175', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop-en', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile-roman-ur', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
});
