/** 소수부 [0, 1) — 시드·좌표 파생 변주의 공용 빌딩 블록 (렌더 전용). */
export function fract(value: number): number {
  return value - Math.floor(value)
}
