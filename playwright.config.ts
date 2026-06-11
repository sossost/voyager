import { defineConfig } from '@playwright/test'

/**
 * E2E 전략 (03-plan.md 테스트 4계층): headless Chromium은 SwiftShader로 WebGL을
 * 소프트웨어 렌더링한다 — 픽셀 비교 대신 앱 상태(DOM·store)를 단언한다.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 45_000,
  retries: process.env['CI'] == null ? 0 : 1,
  use: {
    baseURL: 'http://localhost:5199',
  },
  webServer: {
    command: 'npm run dev -- --port 5199 --strictPort',
    port: 5_199,
    reuseExistingServer: process.env['CI'] == null,
  },
})
