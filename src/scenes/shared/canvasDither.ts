/**
 * 캔버스 베이크 디더 (백로그 O-11) — 8-bit 라디얼 그라디언트를 수백~수천 유닛으로
 * 확대하면 초저알파 구간(예: 0.02→0)의 표현 가능한 단계가 5개 안팎이라 동심원
 * 계단(밴딩)이 생긴다. Bloom(high 티어 전용)이 켜지면 블러가 가려주지만
 * medium/low에선 그대로 노출된다 — 굽는 시점에 픽셀당 ±1/255 노이즈를 섞어
 * 계단 경계를 흩뜨린다.
 *
 * 노이즈는 픽셀 인덱스 해시로 파생한다 — 앱 수명 캐시 텍스처가 실행마다 다른
 * 스페클을 갖지 않도록 결정론을 유지한다 (엔진 순수성 규칙과는 무관한 렌더 코드지만,
 * 같은 입력 → 같은 텍스처가 디버깅·스냅샷 비교에 유리하다).
 */

const DITHER_AMPLITUDE = 1

/** 정수 해시 → {-1, 0, +1} — 채널별 독립 오프셋용 (Knuth 곱셈 해시 + xorshift 믹스). */
function hashedOffset(index: number): number {
  let hash = Math.imul(index + 1, 2654435761)
  hash ^= hash >>> 13
  hash = Math.imul(hash, 0x5bd1e995)
  hash ^= hash >>> 15
  return ((hash >>> 0) % 3) - 1
}

function clampByte(value: number): number {
  if (value < 0) return 0
  if (value > 255) return 255
  return value
}

/**
 * 캔버스 전체에 ±1/255 디더를 적용한다 — 그라디언트 fill 직후, 텍스처 생성 전에 호출.
 * 알파 0(완전 투명) 픽셀은 건드리지 않는다 — 빌보드 쿼드의 모서리가 스페클로
 * 드러나지 않게 그라디언트 바깥은 순수 투명을 유지한다.
 */
export function ditherCanvas(context: CanvasRenderingContext2D): void {
  const { width, height } = context.canvas
  const imageData = context.getImageData(0, 0, width, height)
  const pixels = imageData.data

  for (let offset = 0; offset < pixels.length; offset += 4) {
    const alpha = pixels[offset + 3] ?? 0
    if (alpha === 0) continue

    pixels[offset] = clampByte((pixels[offset] ?? 0) + hashedOffset(offset) * DITHER_AMPLITUDE)
    pixels[offset + 1] = clampByte((pixels[offset + 1] ?? 0) + hashedOffset(offset + 1) * DITHER_AMPLITUDE)
    pixels[offset + 2] = clampByte((pixels[offset + 2] ?? 0) + hashedOffset(offset + 2) * DITHER_AMPLITUDE)
    pixels[offset + 3] = clampByte(alpha + hashedOffset(offset + 3) * DITHER_AMPLITUDE)
  }

  context.putImageData(imageData, 0, 0)
}
