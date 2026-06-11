import { CanvasTexture } from 'three'

import type { Planet } from '@/engine'
import { valueNoise3 } from '@/engine/noise/valueNoise'

/**
 * 행성 표면 CanvasTexture 베이크 — paletteSeed 결정론 (백로그 F-1, 결정 29).
 *
 * GalaxyNebula에서 검증된 패턴: 저해상도 베이크 → 블러 업스케일.
 * 노이즈는 단위 구 표면의 3D 좌표에서 샘플링하므로 등장방형 가로 이음매가 없다.
 * 렌더 전용 — 엔진 draw를 소비하지 않아 GEN_VERSION·저장 포맷 무관.
 * 같은 paletteSeed = 같은 행성 무늬 (모든 플레이어가 같은 행성을 본다).
 */

export interface PlanetTextureSet {
  readonly surface: CanvasTexture
  /** 생명체 행성 전용 구름층 — 없으면 null. */
  readonly clouds: CanvasTexture | null
}

/** 표면 베이크 해상도 — 업스케일 보간이 격자를 부드러운 무늬로 만든다. */
const SURFACE_BASE_WIDTH = 192
const SURFACE_BASE_HEIGHT = 96
const SURFACE_UPSCALE_FACTOR = 2
const SURFACE_BLUR_PX = 1

/** 구름은 본질이 무정형이라 표면보다 낮은 해상도 + 강한 블러로 충분하다. */
const CLOUD_BASE_WIDTH = 96
const CLOUD_BASE_HEIGHT = 48
const CLOUD_UPSCALE_FACTOR = 4
const CLOUD_BLUR_PX = 2

/** 용도별 노이즈 장 분리 솔트 — paletteSeed와 XOR해 독립 노이즈 장을 만든다. */
const HEIGHT_SALT = 0x1f123
const DETAIL_SALT = 0x2e456
const SWIRL_SALT = 0x3d789
const STORM_SALT = 0x4cabc
const CLOUD_SALT = 0x5bdef
const PARAM_SALT = 0x6a012

type Rgba = readonly [number, number, number, number]
type SurfacePainter = (px: number, py: number, pz: number, lat: number) => Rgba

const OPAQUE = 255
const FULL_TURN = Math.PI * 2

function clamp01(value: number): number {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp01((value - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

function mixChannel(from: number, to: number, t: number): number {
  return from + (to - from) * t
}

function mixRgb(
  from: readonly [number, number, number],
  to: readonly [number, number, number],
  t: number,
): readonly [number, number, number] {
  return [mixChannel(from[0], to[0], t), mixChannel(from[1], to[1], t), mixChannel(from[2], to[2], t)]
}

/** hue 0~360, saturation/lightness 0~100 → RGB 0~255. */
function hslToRgb(hue: number, saturation: number, lightness: number): readonly [number, number, number] {
  const s = saturation / 100
  const l = lightness / 100
  const chroma = (1 - Math.abs(2 * l - 1)) * s
  const huePrime = (((hue % 360) + 360) % 360) / 60
  const x = chroma * (1 - Math.abs((huePrime % 2) - 1))
  const m = l - chroma / 2

  let rgb: readonly [number, number, number]
  if (huePrime < 1) rgb = [chroma, x, 0]
  else if (huePrime < 2) rgb = [x, chroma, 0]
  else if (huePrime < 3) rgb = [0, chroma, x]
  else if (huePrime < 4) rgb = [0, x, chroma]
  else if (huePrime < 5) rgb = [x, 0, chroma]
  else rgb = [chroma, 0, x]

  return [(rgb[0] + m) * 255, (rgb[1] + m) * 255, (rgb[2] + m) * 255]
}

/** paletteSeed에서 채널별 파라미터 변주 [0, 1) — 정수 격자점이라 hash 값 그대로 나온다. */
function seedVariant(paletteSeed: number, channel: number): number {
  return valueNoise3(channel, 7, 13, paletteSeed ^ PARAM_SALT)
}

function fbm3(x: number, y: number, z: number, salt: number, octaves: number): number {
  let amplitude = 0.5
  let frequency = 1
  let sum = 0
  let total = 0
  for (let octave = 0; octave < octaves; octave++) {
    const offset = octave * 19.19
    sum += amplitude * valueNoise3(x * frequency + offset, y * frequency, z * frequency, salt)
    total += amplitude
    amplitude *= 0.5
    frequency *= 2.07
  }
  return sum / total
}

/** 암석형 — 노이즈 대륙(생명체는 바다·대륙) + 지형 색 밴드 + 극관. */
function rockyPainter(planet: Planet): SurfacePainter {
  const seed = planet.paletteSeed
  const hue = seed % 360
  const heightSalt = seed ^ HEIGHT_SALT
  const detailSalt = seed ^ DETAIL_SALT

  const seaLevel = 0.46 + 0.1 * seedVariant(seed, 0)
  const capEdge = 0.72 + 0.18 * seedVariant(seed, 1)
  // 생명체 행성은 항상 또렷한 극관, 무생명 행성은 시드 따라 약하거나 없다
  const capStrength = planet.hasLife ? 1 : smoothstep(0.35, 0.75, seedVariant(seed, 2))
  const bandLow = 0.4 + 0.08 * seedVariant(seed, 3)

  const deepOcean = hslToRgb(196 + 18 * seedVariant(seed, 4), 66, 26)
  const shallowOcean = hslToRgb(188, 56, 41)
  const lowTerrain = hslToRgb(hue, planet.hasLife ? 36 : 30, planet.hasLife ? 36 : 28)
  const midTerrain = hslToRgb(hue, 34, 46)
  const highTerrain = hslToRgb(hue + 16, 24, planet.hasLife ? 58 : 62)
  const polarCap = hslToRgb(hue, 12, 88)

  return (px, py, pz, lat) => {
    const base = fbm3(px * 2.3, py * 2.3, pz * 2.3, heightSalt, 4)
    const detail = valueNoise3(px * 7.1, py * 7.1, pz * 7.1, detailSalt)
    const height = base * 0.82 + detail * 0.18

    let rgb: readonly [number, number, number]
    if (planet.hasLife) {
      // 바다와 대륙 — 해안선은 얕은 바다로 부드럽게 이어진다
      if (height < seaLevel) {
        rgb = mixRgb(deepOcean, shallowOcean, smoothstep(seaLevel - 0.18, seaLevel, height))
      } else {
        rgb = mixRgb(lowTerrain, highTerrain, smoothstep(seaLevel, seaLevel + 0.26, height))
      }
    } else {
      // 고도 기반 지형 색 밴드 — 저지/중지/고지
      const toMid = smoothstep(bandLow - 0.06, bandLow + 0.06, height)
      const toHigh = smoothstep(bandLow + 0.16, bandLow + 0.28, height)
      rgb = mixRgb(mixRgb(lowTerrain, midTerrain, toMid), highTerrain, toHigh)
    }

    // 극관 — 가장자리는 디테일 노이즈로 일렁인다
    const polar = smoothstep(capEdge, capEdge + 0.08, Math.abs(Math.sin(lat))) * capStrength
    const capWobble = 1 - 0.35 * detail
    return [...mixRgb(rgb, polarCap, clamp01(polar * capWobble)), OPAQUE]
  }
}

/** 가스형 — 노이즈로 뒤틀린 위도 밴드 + 저주파 폭풍 반점. */
function gasPainter(planet: Planet): SurfacePainter {
  const seed = planet.paletteSeed
  const hueA = seed % 360
  const hueB = (hueA + 22 + 36 * seedVariant(seed, 0)) % 360
  const swirlSalt = seed ^ SWIRL_SALT
  const stormSalt = seed ^ STORM_SALT

  const swirlAmplitude = 0.16 + 0.38 * seedVariant(seed, 1)
  const bandFrequency = 3.2 + 3.4 * seedVariant(seed, 2)
  const bandPhase = seedVariant(seed, 3) * FULL_TURN

  const bandDark = hslToRgb(hueA, 52, 42)
  const bandLight = hslToRgb(hueA, 58, 63)
  const zoneTint = hslToRgb(hueB, 48, 52)
  const stormShade = hslToRgb(hueB, 58, 30)

  return (px, py, pz, lat) => {
    // 위도를 노이즈로 뒤틀어 소용돌이치는 줄무늬를 만든다
    const swirl = (fbm3(px * 1.7, py * 1.7, pz * 1.7, swirlSalt, 3) - 0.5) * swirlAmplitude
    const warpedLatitude = Math.sin(lat) + swirl

    const band = 0.5 + 0.5 * Math.sin(warpedLatitude * Math.PI * bandFrequency + bandPhase)
    const zone = 0.5 + 0.5 * Math.sin(warpedLatitude * Math.PI * bandFrequency * 0.5 + bandPhase * 1.7)

    let rgb = mixRgb(mixRgb(bandDark, bandLight, band), zoneTint, zone * 0.45)

    // 대형 폭풍 반점 — 저주파 노이즈의 꼬리만 살린다
    const storm = smoothstep(0.74, 0.88, fbm3(px * 1.2 + 5.7, py * 1.2, pz * 1.2, stormSalt, 2))
    rgb = mixRgb(rgb, stormShade, storm * 0.6)
    return [...rgb, OPAQUE]
  }
}

/** 생명체 행성 구름층 — 흰 구름, 알파는 노이즈 꼬리. */
function cloudPainter(planet: Planet): SurfacePainter {
  const cloudSalt = planet.paletteSeed ^ CLOUD_SALT

  return (px, py, pz) => {
    const coverage = fbm3(px * 3.1, py * 3.1, pz * 3.1, cloudSalt, 3)
    const alpha = smoothstep(0.52, 0.72, coverage) * 0.88 * 255
    return [255, 255, 255, alpha]
  }
}

/**
 * 등장방형 베이크 — 각 텍셀의 위경도를 단위 구 좌표로 바꿔 페인터에 넘긴다.
 * 3D 좌표 샘플링이라 가로 이음매가 없고, 베이크 후 블러 업스케일로 격자를 푼다.
 */
function bakeEquirect(
  baseWidth: number,
  baseHeight: number,
  upscaleFactor: number,
  blurPx: number,
  painter: SurfacePainter,
): CanvasTexture {
  const base = document.createElement('canvas')
  base.width = baseWidth
  base.height = baseHeight
  const baseContext = base.getContext('2d')
  if (baseContext == null) throw new Error('행성 텍스처용 2D 컨텍스트를 만들 수 없습니다')

  const image = baseContext.createImageData(baseWidth, baseHeight)
  for (let texelY = 0; texelY < baseHeight; texelY++) {
    const lat = (0.5 - (texelY + 0.5) / baseHeight) * Math.PI
    const cosLat = Math.cos(lat)
    const sinLat = Math.sin(lat)
    for (let texelX = 0; texelX < baseWidth; texelX++) {
      const lon = ((texelX + 0.5) / baseWidth) * FULL_TURN
      const [r, g, b, a] = painter(cosLat * Math.cos(lon), sinLat, cosLat * Math.sin(lon), lat)

      // Uint8ClampedArray는 소수부를 버림한다 — 반올림해야 채널이 어두워지는 편향이 없다
      const offset = (texelY * baseWidth + texelX) * 4
      image.data[offset] = Math.round(r)
      image.data[offset + 1] = Math.round(g)
      image.data[offset + 2] = Math.round(b)
      image.data[offset + 3] = Math.round(a)
    }
  }
  baseContext.putImageData(image, 0, 0)

  const upscaled = document.createElement('canvas')
  upscaled.width = baseWidth * upscaleFactor
  upscaled.height = baseHeight * upscaleFactor
  const context = upscaled.getContext('2d')
  if (context == null) throw new Error('행성 텍스처용 2D 컨텍스트를 만들 수 없습니다')
  context.imageSmoothingEnabled = true
  context.filter = `blur(${blurPx}px)`
  context.drawImage(base, 0, 0, upscaled.width, upscaled.height)
  context.filter = 'none'

  const texture = new CanvasTexture(upscaled)
  texture.colorSpace = 'srgb'
  return texture
}

export function bakePlanetTextures(planet: Planet): PlanetTextureSet {
  const painter = planet.kind === 'rocky' ? rockyPainter(planet) : gasPainter(planet)
  const surface = bakeEquirect(
    SURFACE_BASE_WIDTH,
    SURFACE_BASE_HEIGHT,
    SURFACE_UPSCALE_FACTOR,
    SURFACE_BLUR_PX,
    painter,
  )
  const clouds = planet.hasLife
    ? bakeEquirect(CLOUD_BASE_WIDTH, CLOUD_BASE_HEIGHT, CLOUD_UPSCALE_FACTOR, CLOUD_BLUR_PX, cloudPainter(planet))
    : null
  return { surface, clouds }
}

export function disposePlanetTextures(textures: PlanetTextureSet): void {
  textures.surface.dispose()
  textures.clouds?.dispose()
}
