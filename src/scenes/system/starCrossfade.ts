/**
 * 항성·항성계 거리 기반 가시도 — 두 가지 크로스페이드를 다룬다.
 *
 * 1) 포인트 ↔ 구체 크로스페이드 (결정 41-c):
 *    - GalaxyStarField: 현재 별 포인트 크기 = crossfadeProgress
 *    - StarSurface:     구체·코로나 불투명도 = 1 - crossfadeProgress
 *    우주선 정박 거리(~138)는 NEAR보다 안쪽이라 정박 시 포인트 완전 숨고 구체 가득 찬다.
 *
 * 2) 항성계 LOD 페이드 (백로그 H-3):
 *    궤도링은 SYSTEM_FADE_NEAR → SYSTEM_LOD_DISTANCE 구간에서 부드럽게 사라져
 *    은하 줌아웃 시 항성계가 갑자기 팝인/팝아웃되는 이질감을 없앤다.
 */

/** 이 거리(월드)보다 가까우면 구체 전담(포인트 0). 우주선 정박 거리보다 바깥이어야 한다. */
export const STAR_CROSSFADE_NEAR = 200
/** 이 거리보다 멀면 포인트 전담(구체 0). */
export const STAR_CROSSFADE_FAR = 650

/** 이 거리부터 항성계(궤도링)를 페이드아웃한다. STAR_CROSSFADE_NEAR보다 살짝 바깥. */
export const SYSTEM_FADE_NEAR = STAR_CROSSFADE_NEAR * 1.1  // 220
/** 이 거리 초과 시 항성계를 완전히 숨긴다 (group.visible = false). */
export const SYSTEM_LOD_DISTANCE = STAR_CROSSFADE_NEAR * 2  // 400

/** 매끄러운 0→1 보간 (smoothstep). */
function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

/**
 * 카메라-별 거리 → 포인트 가시도 (0 = 가까움/숨김, 1 = 멀어서 포인트로 보임).
 * 구체 불투명도가 필요하면 `1 - crossfadeProgress(distance)`.
 */
export function crossfadeProgress(distance: number): number {
  return smoothstep(STAR_CROSSFADE_NEAR, STAR_CROSSFADE_FAR, distance)
}

/**
 * 거리 → 항성계 불투명도 [0,1].
 * SYSTEM_FADE_NEAR 이하에서 1(완전 가시), SYSTEM_LOD_DISTANCE 이상에서 0(숨김).
 */
export function systemFadeOpacity(distance: number): number {
  return 1 - smoothstep(SYSTEM_FADE_NEAR, SYSTEM_LOD_DISTANCE, distance)
}
