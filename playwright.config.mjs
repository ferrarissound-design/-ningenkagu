import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

// このサンドボックスにはビルド済み Chromium がバージョン非依存のパスで
// 置かれていることがある。存在すればそれを使い、無ければ（CI など）
// Playwright 自身が管理するブラウザ（`playwright install` 済み）に任せる。
const PINNED_CHROMIUM = '/opt/pw-browsers/chromium';
const executablePath = existsSync(PINNED_CHROMIUM) ? PINNED_CHROMIUM : undefined;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  // CI では失敗時にアーティファクトとして拾えるよう HTML レポートも残す
  reporter: process.env.CI
    ? [['line'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : 'list',
  use: {
    baseURL: 'http://127.0.0.1:8123',
    launchOptions: {
      executablePath,
      args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
    },
  },
  webServer: {
    command: 'python3 -m http.server 8123',
    url: 'http://127.0.0.1:8123/index.html',
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
