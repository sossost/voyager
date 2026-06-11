/**
 * ⚠️ 수정 금지 (FROZEN) — 이 파일의 어떤 변경도 우주 전체를 파괴한다.
 *
 * sfc32 (Small Fast Counter): 128bit 상태 PRNG (public domain, PractRand 통과).
 * 32bit 정수 연산만 사용 — 모든 JS 엔진에서 비트 단위 동일.
 * 128bit 상태라 무한 좌표 공간에서도 스트림 충돌(생일 역설) 여유가 충분하다.
 *
 * 반환값은 [0, 1) — u32 / 2^32 정수 유도만 사용 (IEEE-754 나눗셈은 정확히 정의됨).
 */
export function sfc32(seedA: number, seedB: number, seedC: number, seedD: number): () => number {
  let a = seedA >>> 0
  let b = seedB >>> 0
  let c = seedC >>> 0
  let d = seedD >>> 0

  return () => {
    let t = (a + b) | 0
    a = b ^ (b >>> 9)
    b = (c + (c << 3)) | 0
    c = (c << 21) | (c >>> 11)
    d = (d + 1) | 0
    t = (t + d) | 0
    c = (c + t) | 0
    return (t >>> 0) / 4294967296
  }
}
