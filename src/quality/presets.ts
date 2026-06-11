import type { QualityTier } from '@/store/types'

/**
 * 품질 티어 프리셋 (02-decisions.md 결정 12).
 * maxPointSize: Points 별 필드의 실제 모바일 병목은 정점 수가 아니라
 * 스프라이트 오버드로우(fill-rate)다 — 점 크기 상한이 그 캡이다.
 * 별은 전수 렌더(결정 22)라 점 수는 티어 불변 — 티어는 크기 캡만 통제한다.
 */
export interface QualityPreset {
  readonly dprMax: number
  /** 별 필드 점 크기 캡 (px) — 근접 별이 거대 블롭이 되는 것을 막는 fill-rate 캡. */
  readonly maxPointSize: number
  readonly planetSegments: number
  readonly postFx: boolean
}

export const QUALITY_PRESETS: Readonly<Record<QualityTier, QualityPreset>> = {
  high: {
    dprMax: 2,
    maxPointSize: 12,
    planetSegments: 64,
    postFx: true,
  },
  medium: {
    dprMax: 1.5,
    maxPointSize: 10,
    planetSegments: 32,
    postFx: false,
  },
  low: {
    dprMax: 1,
    maxPointSize: 8,
    planetSegments: 16,
    postFx: false,
  },
}
