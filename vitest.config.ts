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
        // scenes/(WebGL)·ui/(프레젠테이션)·quality/(R3F 어댑터)는 단위 커버리지가 아닌
        // Playwright E2E의 상태 단언이 커버한다 (03-plan.md 테스트 4계층 전략)
        exclude: [
          'src/main.tsx',
          'src/assets/**',
          'src/scenes/**',
          'src/styles/**',
          'src/ui/**',
          'src/quality/**',
          '**/*.d.ts',
        ],
        thresholds: {
          // 로직 계층 게이트 — 엔진은 결정론의 본체이므로 90%
          'src/engine/**': {
            lines: 90,
            branches: 90,
            functions: 90,
            statements: 90,
          },
          'src/store/**': {
            lines: 80,
            branches: 80,
            functions: 80,
            statements: 80,
          },
          'src/persistence/**': {
            lines: 80,
            branches: 80,
            functions: 80,
            statements: 80,
          },
        },
      },
    },
  }),
)
