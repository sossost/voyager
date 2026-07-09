import { describe, expect, it } from 'vitest'

import { ditherCanvas } from './canvasDither'

/**
 * node 환경엔 캔버스가 없으므로 getImageData/putImageData만 흉내 내는 페이크로
 * 픽셀 변환 로직을 검증한다 — ditherCanvas가 쓰는 표면이 이 둘뿐이다.
 */
function createFakeContext(pixels: Uint8ClampedArray, width: number, height: number) {
  const imageData = { data: pixels, width, height }
  let putCount = 0

  const context = {
    canvas: { width, height },
    getImageData: () => imageData,
    putImageData: () => {
      putCount += 1
    },
  } as unknown as CanvasRenderingContext2D

  return { context, pixels, getPutCount: () => putCount }
}

function fillPixels(count: number, rgba: readonly [number, number, number, number]): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(count * 4)
  for (let index = 0; index < count; index += 1) {
    pixels.set(rgba, index * 4)
  }
  return pixels
}

describe('ditherCanvas', () => {
  it('불투명 픽셀의 각 채널을 최대 ±1만 이동시킨다', () => {
    const original = fillPixels(64, [128, 96, 200, 40])
    const { context, pixels } = createFakeContext(original.slice() as Uint8ClampedArray, 8, 8)

    ditherCanvas(context)

    const reference = fillPixels(64, [128, 96, 200, 40])
    for (let offset = 0; offset < pixels.length; offset += 1) {
      expect(Math.abs((pixels[offset] ?? 0) - (reference[offset] ?? 0))).toBeLessThanOrEqual(1)
    }
  })

  it('노이즈가 실제로 섞인다 — 균일 입력이 균일하게 남지 않는다', () => {
    const { context, pixels } = createFakeContext(fillPixels(256, [100, 100, 100, 100]), 16, 16)

    ditherCanvas(context)

    const uniqueValues = new Set(pixels)
    expect(uniqueValues.size).toBeGreaterThan(1)
  })

  it('알파 0(완전 투명) 픽셀은 건드리지 않는다 — 쿼드 모서리 스페클 방지', () => {
    const { context, pixels } = createFakeContext(fillPixels(64, [255, 240, 220, 0]), 8, 8)

    ditherCanvas(context)

    for (let offset = 0; offset < pixels.length; offset += 4) {
      expect(pixels[offset]).toBe(255)
      expect(pixels[offset + 1]).toBe(240)
      expect(pixels[offset + 2]).toBe(220)
      expect(pixels[offset + 3]).toBe(0)
    }
  })

  it('경계값에서 0~255 밖으로 나가지 않는다', () => {
    const extremes = fillPixels(64, [0, 255, 0, 255])
    const { context, pixels } = createFakeContext(extremes, 8, 8)

    ditherCanvas(context)

    for (let offset = 0; offset < pixels.length; offset += 1) {
      expect(pixels[offset]).toBeGreaterThanOrEqual(0)
      expect(pixels[offset]).toBeLessThanOrEqual(255)
    }
  })

  it('결정론 — 같은 입력이면 항상 같은 출력이다 (앱 수명 캐시 텍스처 재현성)', () => {
    const first = createFakeContext(fillPixels(256, [80, 120, 160, 60]), 16, 16)
    const second = createFakeContext(fillPixels(256, [80, 120, 160, 60]), 16, 16)

    ditherCanvas(first.context)
    ditherCanvas(second.context)

    expect(Array.from(first.pixels)).toEqual(Array.from(second.pixels))
  })

  it('변환 결과를 putImageData로 커밋한다', () => {
    const { context, getPutCount } = createFakeContext(fillPixels(4, [10, 10, 10, 10]), 2, 2)

    ditherCanvas(context)

    expect(getPutCount()).toBe(1)
  })
})
