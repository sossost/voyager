/**
 * 좌표 파생 결정론 해시 — 별 개성(밝기·크기) 변주의 단일 출처 (GalaxyStarField).
 * 계수가 갈리면 별밭의 개성이 조용히 달라지므로 한곳에 둔다.
 * 렌더 전용 — 엔진 draw를 소비하지 않아 GEN_VERSION 무관.
 */
export function starVariance(localPos: readonly [number, number, number]): number {
  const value = localPos[0] * 0.731 + localPos[1] * 0.527 + localPos[2] * 0.293
  return value - Math.floor(value)
}
