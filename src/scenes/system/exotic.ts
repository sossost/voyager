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
      // 사건지평선 시각 반경 배수 — 항성보다 작다(<1). 레이마칭 렌즈가 디스크(rs×18)·렌즈(rs×28)를
      // 그려 전체 화면 크기를 좌우하므로, 디스크 외곽이 일반 항성 코로나와 비슷해지게 0.32로 둔다.
      return 0.32
    case 'main_sequence':
      return 1
  }
}
