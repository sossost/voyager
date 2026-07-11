/**
 * 조석 변형 방향 공유 상태 (exotic-codex) — CurrentSystem이 매 프레임 반성→블랙홀
 * 방향(시스템 로컬 XZ)을 게시하고, StarSurface(tidalStretch>0)가 uTidalDir 유니폼으로 읽는다.
 * blackHoleLens와 같은 패턴 — 연속 값은 모듈 상태 + useFrame (철칙 6, store 금지).
 * 카리브디스 반성 하나만 소비하므로 단일 슬롯이면 충분하다.
 */
export const companionTide = {
  dirX: 1,
  dirZ: 0,
}
