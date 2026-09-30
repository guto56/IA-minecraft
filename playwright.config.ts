import fs from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// Usa o Chromium do sistema quando o Playwright não tem o navegador baixado.
const systemChromium = ['/opt/pw-browsers/chromium', process.env.CHROMIUM].find((p) => p && fs.existsSync(p));
const launchOptions = systemChromium ? { executablePath: systemChromium } : {};

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  fullyParallel: true,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4173', reducedMotion: 'reduce', launchOptions },
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, launchOptions } },
    { name: 'mobile', use: { ...devices['Pixel 7'], launchOptions } },
  ],
});
