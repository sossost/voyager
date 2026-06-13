import { CanvasTexture, RepeatWrapping } from 'three'

/**
 * 행성 고리 방사형 CanvasTexture 베이크 — 토성 고리의 실제 구조를 반영한다.
 * 안쪽→바깥쪽(텍스처 U축)으로 D·C·B링, 카시니 간극, A링(엥케 간극)을 순서대로 그려
 * 단색 평면이 아닌 띠·간극·밝기 그라데이션을 만든다.
 *
 * 렌더 전용 — 엔진 draw를 소비하지 않아 GEN_VERSION·저장 포맷 무관.
 * 고리 프로파일은 행성과 무관하므로 모듈 싱글톤으로 한 번만 베이크해 공유한다
 * (행성별 크기는 메시 스케일로, 색조는 머티리얼 color 곱으로 변주).
 */

const RING_TEXTURE_WIDTH = 1024
const RING_TEXTURE_HEIGHT = 2
const OPAQUE = 255

/**
 * 정규화 반경 경계 [0,1] = 안쪽 모서리→바깥쪽 모서리. 실제 토성 고리를
 * 행성 반경 1.20~2.30R 구간에 매핑한 값 (C링 시작 1.235R … A링 끝 2.267R).
 */
const C_RING_START = 0.03
const C_TO_B = 0.295
const B_RING_END = 0.682
const CASSINI_END = 0.75
const ENCKE_GAP = 0.922
const ENCKE_GAP_END = 0.935
const A_RING_END = 0.97

/** 띠별 대표색 (얼음·암석 혼합의 크림/황토 톤). */
const C_RING_COLOR = [168, 158, 138] as const
const B_RING_COLOR = [234, 222, 192] as const
const A_RING_COLOR = [206, 194, 166] as const

type Rgb = readonly [number, number, number]

function clamp01(value: number): number {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp01((value - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

function mix(from: number, to: number, t: number): number {
  return from + (to - from) * t
}

function mixRgb(from: Rgb, to: Rgb, t: number): Rgb {
  return [mix(from[0], to[0], t), mix(from[1], to[1], t), mix(from[2], to[2], t)]
}

/** 고주파 띠 — 균일한 띠 내부에 미세한 알파 변주를 주어 평면감을 없앤다. */
function bandDetail(t: number): number {
  const fine = Math.sin(t * 220) * 0.5 + 0.5
  const coarse = Math.sin(t * 53 + 1.7) * 0.5 + 0.5
  return 0.82 + 0.12 * fine + 0.06 * coarse
}

/** 정규화 반경 t에서의 [색, 알파] — 토성 고리 띠 구조. */
function sampleRing(t: number): { color: Rgb; alpha: number } {
  // 색: C(어두운 회황) → B(밝은 크림) → A(중간) 그라데이션
  const toB = smoothstep(C_TO_B - 0.05, C_TO_B + 0.05, t)
  const toA = smoothstep(CASSINI_END - 0.02, CASSINI_END + 0.04, t)
  const color = mixRgb(mixRgb(C_RING_COLOR, B_RING_COLOR, toB), A_RING_COLOR, toA)

  // 알파: 띠는 불투명, 간극은 투명
  let alpha: number
  if (t < C_RING_START) {
    alpha = 0.08 * smoothstep(0, C_RING_START, t) // 안쪽 희미한 D링
  } else if (t < C_TO_B) {
    alpha = mix(0.22, 0.48, smoothstep(C_RING_START, C_TO_B, t)) // C링 — 반투명
  } else if (t < B_RING_END) {
    alpha = 0.95 // B링 — 가장 밝고 불투명
  } else if (t < CASSINI_END) {
    alpha = 0.07 // 카시니 간극
  } else if (t < ENCKE_GAP) {
    alpha = 0.62 // A링
  } else if (t < ENCKE_GAP_END) {
    alpha = 0.06 // 엥케 간극
  } else if (t < A_RING_END) {
    alpha = 0.58 // A링 바깥
  } else {
    alpha = 0.58 * (1 - smoothstep(A_RING_END, 1, t)) // 바깥 모서리 페이드
  }

  // 띠 본체에만 미세 변주 적용 (간극은 그대로)
  if (alpha > 0.2) alpha *= bandDetail(t)
  return { color, alpha: clamp01(alpha) }
}

let cachedTexture: CanvasTexture | null = null

/** 토성형 고리 텍스처 (싱글톤). 최초 호출 때 1회 베이크 후 캐시. */
export function getRingTexture(): CanvasTexture {
  if (cachedTexture != null) return cachedTexture

  const canvas = document.createElement('canvas')
  canvas.width = RING_TEXTURE_WIDTH
  canvas.height = RING_TEXTURE_HEIGHT
  const ctx = canvas.getContext('2d')
  if (ctx == null) throw new Error('고리 텍스처 베이크: 2D 컨텍스트를 얻지 못했습니다')

  const image = ctx.createImageData(RING_TEXTURE_WIDTH, RING_TEXTURE_HEIGHT)
  for (let x = 0; x < RING_TEXTURE_WIDTH; x++) {
    const t = x / (RING_TEXTURE_WIDTH - 1)
    const { color, alpha } = sampleRing(t)
    for (let y = 0; y < RING_TEXTURE_HEIGHT; y++) {
      const offset = (y * RING_TEXTURE_WIDTH + x) * 4
      image.data[offset] = color[0]
      image.data[offset + 1] = color[1]
      image.data[offset + 2] = color[2]
      image.data[offset + 3] = Math.round(alpha * OPAQUE)
    }
  }
  ctx.putImageData(image, 0, 0)

  const texture = new CanvasTexture(canvas)
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  cachedTexture = texture
  return texture
}
