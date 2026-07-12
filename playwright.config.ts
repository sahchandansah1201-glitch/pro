import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.pw\.ts$/,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:8080",
    headless: true,
    viewport: { width: 1366, height: 768 },
  },
  expect: {
    toHaveScreenshot: {
      // Небольшой допуск под антиалиасинг шрифтов между прогонами.
      maxDiffPixelRatio: 0.02,
      threshold: 0.2,
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
