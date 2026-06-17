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
/**
 * 펄서 형태 상수 (펄서 결정 1~5) — 시간 함수(회전·펄스)는 Pulsar.tsx의 useFrame에 산다.
 * GEN_VERSION 무관(렌더 전용). 광과민성: 빔 통과 주파수 = (SPIN_RATE/2π)×2(쌍극) ≤ 3Hz.
 */
/** 자전 각속도 (rad/s) — 0.318 rev/s → 빔 통과 ~0.64Hz (≤3Hz, 결정 5). 느긋한 등대 스윕. */
export const PULSAR_SPIN_RATE = 2.0
/** 자기축 ↔ 자전축 어긋남 (rad, ~29°) — 회전 시 빔이 원뿔을 쓴다. */
export const PULSAR_MAGNETIC_OFFSET = 0.5
/** 자전축의 3/4 시점 틸트 [x,y,z] — 제트·스윕이 정면 정렬로 납작해지지 않게. */
export const PULSAR_BASE_TILT: readonly [number, number, number] = [0.34, 0, 0.18]
/** 등대 빔 길이 = 본체 반경 × 이 배수. */
export const PULSAR_BEAM_LEN_FACTOR = 8
/** 등대 빔 밑동(별 쪽) 반경 배수 — 좁은 핫코어(결정 26). */
export const PULSAR_BEAM_CONE_FACTOR = 1.4
/** 상대론적 제트 길이 배수 — 빔보다 길고 가늘다. */
export const PULSAR_JET_LEN_FACTOR = 14
/** 상대론적 제트 밑동 반경 배수 — 가늘게. */
export const PULSAR_JET_BASE_FACTOR = 0.32
/** 자기극 폴라캡 핫스팟 반경 배수. */
export const PULSAR_POLAR_CAP_FACTOR = 0.5
/** 글로우 펄스 최저 강도 — 완전 소등하지 않는다(대비 상한, 광과민성, 결정 5). */
export const PULSAR_PULSE_MIN = 0.22

export function kindRadiusFactor(kind: StarKind): number {
  switch (kind) {
    case 'black_hole':
      // 사건지평선 시각 반경 배수 — 항성보다 작다(<1). 레이마칭 렌즈가 디스크(rs×18)·렌즈(rs×28)를
      // 그려 전체 화면 크기를 좌우하므로, 디스크 외곽이 일반 항성 코로나와 비슷해지게 0.32로 둔다.
      return 0.32
    case 'pulsar':
      // 중성자성 본체 — 작고 조밀(<1). 히어로(등대 빔)·제트가 시각 크기를 좌우하므로 본체는
      // 작게 두어 Bloom이 본체를 백색으로 메우지 않게 한다(블랙홀 교훈 2, 펄서 결정 3).
      return 0.6
    case 'main_sequence':
      return 1
  }
}
