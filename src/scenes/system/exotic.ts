import type { StarKind } from '@/engine'

/**
 * 이색 천체 렌더 파라미터 (결정 6) — 형태 상수. 순수 함수·상수만, 컴포넌트 없음.
 * 회전·도플러 같은 시간 함수는 각 컴포넌트의 useFrame에 산다. GEN_VERSION 무관.
 */

/**
 * 종류별 본체 시각/충돌 반경 배수 (결정 12). main_sequence=1이라 기존 단일 항성
 * 렌더가 한 픽셀도 안 바뀐다. multiplicity.ts의 renderedRadius(충돌·궤도)와
 * CurrentSystem(시각 메시)이 **같은 값**을 써야 별/행성 관통이 없다.
 */
export function kindRadiusFactor(kind: StarKind): number {
  switch (kind) {
    case 'black_hole':
      // 큰 사건지평선 — 작으면 high 티어 Bloom 번짐이 검은 코어를 흰색으로 메운다.
      return 1.4
    case 'main_sequence':
      return 1
  }
}
