import type { QualityTier } from '@/store/types'

/**
 * 품질 티어 프리셋 (02-decisions.md 결정 12).
 * maxPointSize: Points 별 필드의 실제 모바일 병목은 정점 수가 아니라
 * 글로우 스프라이트 오버드로우(fill-rate)다 — 점 크기 상한이 그 캡이다.
 * 별은 전수 렌더(결정 22)라 점 수는 티어 불변 — 티어는 크기 캡·간격만 통제한다.
 */
export interface QualityPreset {
  readonly dprMax: number
  /** 별 필드 점 크기 캡 (px) — 근접 별이 거대 블롭이 되는 것을 막는 fill-rate 캡. */
  readonly maxPointSize: number
  /** 은하 원경 샘플 간격 (섹터 단위) — 점 수 = fill-rate 비용이므로 티어가 통제한다. */
  readonly backdropStride: number
  /** 은하 원경 글로우 점 크기 캡 (px) — maxPointSize와 같은 fill-rate 캡 역할. */
  readonly backdropMaxPointSize: number
  readonly planetSegments: number
  readonly postFx: boolean
}

export const QUALITY_PRESETS: Readonly<Record<QualityTier, QualityPreset>> = {
  high: {
    dprMax: 2,
    maxPointSize: 12,
    backdropStride: 1,
    backdropMaxPointSize: 24,
    planetSegments: 64,
    postFx: true,
  },
  medium: {
    dprMax: 1.5,
    maxPointSize: 10,
    backdropStride: 1,
    backdropMaxPointSize: 20,
    planetSegments: 32,
    postFx: false,
  },
  low: {
    dprMax: 1,
    maxPointSize: 8,
    backdropStride: 2,
    backdropMaxPointSize: 16,
    planetSegments: 16,
    postFx: false,
  },
}
