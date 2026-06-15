import type { StarKind } from '@/engine'

/**
 * 이색 천체 렌더 파라미터 (결정 6) — 형태/변조 상수. 순수 함수·상수만, 컴포넌트 없음.
 * 회전·도플러·점멸 같은 시간 함수는 각 컴포넌트의 useFrame에 산다. GEN_VERSION 무관.
 */

/**
 * 종류별 본체 시각/충돌 반경 배수 (결정 12). main_sequence=1이라 기존 단일 항성
 * 렌더가 한 픽셀도 안 바뀐다. multiplicity.ts의 renderedRadius(충돌·궤도)와
 * CurrentSystem(시각 메시)이 **같은 값**을 써야 별/행성 관통이 없다.
 */
export function kindRadiusFactor(kind: StarKind): number {
  switch (kind) {
    case 'red_giant':
      return 2.2
    case 'white_dwarf':
      return 0.34
    case 'pulsar':
      return 0.42
    case 'black_hole':
      // 큰 사건지평선 — 작으면 high 티어 Bloom 번짐이 검은 코어를 흰색으로 메운다.
      return 1.4
    case 'main_sequence':
      return 1
  }
}

/** StarSurface 셰이더 변조 — 적색거성(은은·큰 코로나) / 백색왜성(작·강렬). */
export interface SurfaceModulation {
  readonly emissiveBoost: number
  readonly coronaScale: number
}

const NEUTRAL_MODULATION: SurfaceModulation = { emissiveBoost: 1, coronaScale: 1 }

export function surfaceModulationOf(kind: StarKind): SurfaceModulation {
  switch (kind) {
    case 'red_giant':
      return { emissiveBoost: 0.45, coronaScale: 1.5 }
    case 'white_dwarf':
      return { emissiveBoost: 1.7, coronaScale: 0.7 }
    // 펄서·블랙홀은 StarSurface가 아니라 전용 컴포넌트(Pulsar·BlackHole)가 그린다 — 중립값.
    case 'pulsar':
    case 'black_hole':
    case 'main_sequence':
      return NEUTRAL_MODULATION
    default: {
      const _exhaustive: never = kind
      return _exhaustive
    }
  }
}
