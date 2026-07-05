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
  /**
   * 행성 표면 베이크 베이스 가로 해상도 (세로는 절반, 결정 33).
   * 베이크는 CPU 작업이지만 프레임당 1장 큐(bakeQueue)로 분산되어 히치가 없다 —
   * 실측(M계열 데스크톱): 512=36ms/장, 256=9ms, 192=5ms. 해상도는 화질만 정한다.
   */
  readonly planetTextureBaseWidth: number
  /** 블룸 등 상시 포스트 이펙트 — high 전용(약기기 비용 보호). */
  readonly bloom: boolean
  /**
   * 블랙홀 레이마칭 렌즈 스텝 수 — 모든 티어가 같은 가르강튀아 *형태*를 그리되 티어별로 낮춘다.
   * (셰이더 루프는 최대치 고정, uSteps 유니폼으로 조기 종료.) 0이면 렌즈 비활성(페이크 폴백).
   */
  readonly blackHoleSteps: number
  /** 블랙홀 렌즈 2x2 슈퍼샘플링(자글거림 제거) — 비용 4배라 high만. */
  readonly blackHoleSupersample: boolean
  /**
   * 소행성대 최대 인스턴스 수 (가장 조밀한 벨트 기준). InstancedMesh 단일 드로우콜이라
   * 정점 수만 티어로 통제한다 — 카이퍼대는 이 값의 일부만 쓴다(고증상 성김). 렌더 전용.
   */
  readonly asteroidBeltCount: number
}

export const QUALITY_PRESETS: Readonly<Record<QualityTier, QualityPreset>> = {
  high: {
    dprMax: 2,
    maxPointSize: 12,
    planetSegments: 64,
    planetTextureBaseWidth: 512,
    bloom: true,
    blackHoleSteps: 140,
    blackHoleSupersample: true,
    asteroidBeltCount: 1100,
  },
  medium: {
    dprMax: 1.5,
    maxPointSize: 10,
    planetSegments: 32,
    planetTextureBaseWidth: 256,
    bloom: false,
    blackHoleSteps: 80,
    blackHoleSupersample: false,
    asteroidBeltCount: 650,
  },
  low: {
    dprMax: 1,
    maxPointSize: 8,
    planetSegments: 16,
    planetTextureBaseWidth: 192,
    bloom: false,
    // 48은 감김(가르강튀아 형태)이 안 나올 만큼 짧아 80으로 — 진짜 비용은 SS(off)·블룸(off)이라
    // 스텝 차는 미미하고, 형태 보존이 우선. (high만 SS로 차별화.)
    blackHoleSteps: 80,
    blackHoleSupersample: false,
    asteroidBeltCount: 300,
  },
}
