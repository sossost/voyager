/**
 * 항성 본체(3D 메시) 클릭과 화면공간 카탈로그 피킹(useStarPicking)의 충돌 방지.
 *
 * CurrentSystem의 별 본체를 클릭하면 R3F 레이캐스트가 정확한 별(주성·동반성)을
 * 선택한다. 그러나 같은 포인터 이벤트가 캔버스의 DOM pointerup 리스너에도 도달해
 * useStarPicking이 "카탈로그 좌표 최근접 별"을 다시 선택해 덮어쓴다 — 멀리 떨어진
 * 동반성을 클릭하면 이웃 항성계가 잡힐 수도 있다. 본체 클릭이 pointerdown에서
 * 이 플래그를 세우고, useStarPicking이 다음 pointerup 1회를 소비해 건너뛴다.
 */
let suppressed = false

export function suppressStarPick(): void {
  suppressed = true
}

/** 플래그를 읽고 즉시 끈다 — 정확히 한 번의 pointerup만 억제한다. */
export function consumeStarPickSuppress(): boolean {
  const wasSuppressed = suppressed
  suppressed = false
  return wasSuppressed
}
