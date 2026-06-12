/**
 * 좌표 파생 결정론 해시 — 은하 지도(GalaxyStarField)와 항성계 배경(SystemBackdropStars)이
 * 같은 별 개성 변주를 공유한다 (모두가 같은 하늘). 계수가 갈리면 두 씬의 하늘이
 * 조용히 어긋나므로 단일 출처로 둔다. 렌더 전용 — 엔진 draw를 소비하지 않아 GEN_VERSION 무관.
 */
export function starVariance(localPos: readonly [number, number, number]): number {
  const value = localPos[0] * 0.731 + localPos[1] * 0.527 + localPos[2] * 0.293
  return value - Math.floor(value)
}
