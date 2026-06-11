import type { QualityTier } from '@/store/types'

/**
 * 품질 티어 프리셋 (02-decisions.md 결정 12).
 * maxPointSize: Points 별 필드의 실제 모바일 병목은 정점 수가 아니라
 * 글로우 스프라이트 오버드로우(fill-rate)다 — 점 크기 상한이 그 캡이다.
 */
export interface QualityPreset {
  readonly dprMax: number
  readonly starBudget: number
  readonly sectorLoadRadius: number
  readonly maxPointSize: number
  readonly planetSegments: number
  readonly postFx: boolean
}

export const QUALITY_PRESETS: Readonly<Record<QualityTier, QualityPreset>> = {
  high: {
    dprMax: 2,
    starBudget: 20_000,
    sectorLoadRadius: 3,
    maxPointSize: 24,
    planetSegments: 64,
    postFx: true,
  },
  medium: {
    dprMax: 1.5,
    starBudget: 8_000,
    sectorLoadRadius: 2,
    maxPointSize: 18,
    planetSegments: 32,
    postFx: false,
  },
  low: {
    dprMax: 1,
    starBudget: 3_000,
    sectorLoadRadius: 1,
    maxPointSize: 12,
    planetSegments: 16,
    postFx: false,
  },
}
