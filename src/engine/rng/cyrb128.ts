/**
 * ⚠️ 수정 금지 (FROZEN) — 이 파일의 어떤 변경도 우주 전체를 파괴한다.
 *
 * cyrb128: 문자열 → 128bit 해시 (public domain, bryc/code).
 * 32bit 정수 연산(Math.imul, 시프트, XOR)만 사용하므로 모든 JS 엔진에서
 * 비트 단위로 동일한 결과를 보장한다.
 *
 * 변경이 필요하다고 판단되면: 새 함수를 별도 파일로 추가하고 GEN_VERSION을
 * 올려라. 이 파일의 출력은 tests/golden/의 골든 마스터로 봉인되어 있다.
 */
export function cyrb128(input: string): readonly [number, number, number, number] {
  let h1 = 1779033703
  let h2 = 3144134277
  let h3 = 1013904242
  let h4 = 2773480762

  for (let i = 0; i < input.length; i++) {
    const k = input.charCodeAt(i)
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067)
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233)
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213)
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179)
  }

  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067)
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233)
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213)
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179)

  h1 ^= h2 ^ h3 ^ h4
  h2 ^= h1
  h3 ^= h1
  h4 ^= h1

  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0]
}
