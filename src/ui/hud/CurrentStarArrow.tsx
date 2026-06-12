/** 현재 별 오프스크린 방향 화살표 — 위치·회전은 CurrentStarArrowProjector가 useFrame에서 직접 갱신한다. */
export function CurrentStarArrow() {
  return <div data-current-star-arrow aria-hidden="true" className="current-star-arrow" />
}
