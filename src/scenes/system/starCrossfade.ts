/**
 * 항성 포인트 ↔ 구체 크로스페이드 (결정 41-c) — 워프 도착 중 별이 점에서 구체로
 * "자연 확대"되는 핸드오프. 같은 거리 임계를 양쪽이 공유해 한쪽이 사라지는 만큼
 * 다른 쪽이 차오른다:
 *   - GalaxyStarField: 현재 별 포인트 크기 = crossfadeProgress (멀면 1=보임, 가까우면 0=숨김)
 *   - StarSurface:     구체·코로나 불투명도 = 1 - crossfadeProgress (가까우면 1, 멀면 0)
 *
 * 우주선 정박 거리(~138)는 NEAR보다 안쪽이라 정박 시 포인트는 완전히 숨고 구체는 가득 찬다.
 */

/** 이 거리(월드)보다 가까우면 구체 전담(포인트 0). 우주선 정박 거리보다 바깥이어야 한다. */
export const STAR_CROSSFADE_NEAR = 200
/** 이 거리보다 멀면 포인트 전담(구체 0). */
export const STAR_CROSSFADE_FAR = 650

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
