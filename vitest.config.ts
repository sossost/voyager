import { defineConfig, mergeConfig } from 'vitest/config'

import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'node',
      include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
      coverage: {
        provider: 'v8',
        include: ['src/**'],
        // scenes/는 WebGL 의존이라 단위 커버리지 대상이 아님 — E2E(Phase 7)가 커버
        exclude: ['src/main.tsx', 'src/assets/**', 'src/scenes/**', 'src/styles/**', '**/*.d.ts'],
        thresholds: {
          // 전체 80% 게이트는 Phase 7(수락 기준 전수 체크)에서 활성화한다.
          // 엔진은 결정론의 본체이므로 처음부터 90%를 강제한다.
          'src/engine/**': {
            lines: 90,
            branches: 90,
            functions: 90,
            statements: 90,
          },
        },
      },
    },
  }),
)
