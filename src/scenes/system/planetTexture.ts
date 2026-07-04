import { CanvasTexture } from 'three'

import type { Planet } from '@/engine'
import { valueNoise3 } from '@/engine/noise/valueNoise'
import type { GasClass, TemperatureZone } from '@/scenes/system/habitableZone'
import { gasClassOf, temperatureZoneAt } from '@/scenes/system/habitableZone'

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

/**
 * 베이스 해상도는 품질 티어가 정한다 (presets.planetTextureBaseWidth, 결정 33) —
 * 업스케일 보간이 격자를 부드러운 무늬로 만든다.
 */
const SURFACE_UPSCALE_FACTOR = 2
const SURFACE_BLUR_PX = 1

/** 구름은 본질이 무정형이라 표면의 절반 해상도 + 강한 블러로 충분하다. */
const CLOUD_BASE_DIVISOR = 2
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

/**
 * 암석형 표면 모드 — 온도대가 실제 재질을 정한다 (오라가 아닌 물리적 표면, hz-visualization).
 * 생명 행성은 온도대와 무관하게 항상 온대 바다/대륙: 생명의 존재 자체가 액체물 = 온대의 증거다.
 */
type RockyMode = 'ocean' | 'barren' | 'molten' | 'ice'

function rockyModeOf(planet: Planet, zone: TemperatureZone | null): RockyMode {
  if (planet.hasLife) return 'ocean'
  if (zone === 'scorching') return 'molten'
  if (zone === 'frozen') return 'ice'
  return 'barren'
}

/** 온도대별 암석 표면 페인터 선택 — 거주대 무생명·무HZ 별은 기존 온대 지형(terrain)을 그대로 쓴다. */
function rockyPainter(planet: Planet, zone: TemperatureZone | null): SurfacePainter {
  const mode = rockyModeOf(planet, zone)
  if (mode === 'molten') return moltenPainter(planet)
  if (mode === 'ice') return icePainter(planet)
  return terrainPainter(planet)
}

/** 공유 고도 샘플 — 네 모드가 같은 fbm 지형장을 쓴다 (paletteSeed 결정론). */
function sampleHeight(planet: Planet, px: number, py: number, pz: number): number {
  const base = fbm3(px * 2.3, py * 2.3, pz * 2.3, planet.paletteSeed ^ HEIGHT_SALT, 4)
  const detail = valueNoise3(px * 7.1, py * 7.1, pz * 7.1, planet.paletteSeed ^ DETAIL_SALT)
  return base * 0.82 + detail * 0.18
}

/**
 * 작열대 무생명 암석 — 탄 현무암 암반 + 저지대 갈라진 틈의 용암 발광 (수성·용암 세계).
 * 극관 없음. 낮은 고도일수록 뜨거운 용암색으로 타오른다.
 */
function moltenPainter(planet: Planet): SurfacePainter {
  const seed = planet.paletteSeed
  const lavaLevel = 0.42 + 0.08 * seedVariant(seed, 0)
  const lava = hslToRgb(20 + 12 * seedVariant(seed, 1), 92, 56)
  const ember = hslToRgb(16, 62, 30)
  const rockLow = hslToRgb(14, 30, 18)
  const rockHigh = hslToRgb(10, 18, 12)

  return (px, py, pz) => {
    const height = sampleHeight(planet, px, py, pz)
    if (height < lavaLevel) {
      const heat = 1 - smoothstep(lavaLevel - 0.22, lavaLevel, height)
      return [...mixRgb(ember, lava, heat), OPAQUE]
    }
    return [...mixRgb(rockLow, rockHigh, smoothstep(lavaLevel, lavaLevel + 0.3, height)), OPAQUE]
  }
}

/**
 * 동결대 무생명 암석 — 고알베도 얼음 세계 (유로파·명왕성). 밝은 설원 + 그늘진 균열,
 * 극지는 더 희다. 온대·용암과 달리 전면이 반사율 높은 얼음이라 우주 배경에서 밝게 빛난다.
 */
function icePainter(planet: Planet): SurfacePainter {
  const seed = planet.paletteSeed
  const hue = 205 + 10 * seedVariant(seed, 0)
  const iceLow = hslToRgb(hue, 20, 72)
  const iceHigh = hslToRgb(hue - 8, 10, 92)
  const crevasse = hslToRgb(hue, 32, 56)

  return (px, py, pz, lat) => {
    const height = sampleHeight(planet, px, py, pz)
    let rgb = mixRgb(iceLow, iceHigh, smoothstep(0.35, 0.7, height))
    const crack = smoothstep(0.46, 0.5, height) * (1 - smoothstep(0.5, 0.54, height))
    rgb = mixRgb(rgb, crevasse, crack * 0.5)
    const polar = smoothstep(0.5, 0.85, Math.abs(Math.sin(lat)))
    return [...mixRgb(rgb, iceHigh, polar * 0.4), OPAQUE]
  }
}

/** 온대 암석형 — 노이즈 대륙(생명체는 바다·대륙) + 지형 색 밴드 + 극관. */
function terrainPainter(planet: Planet): SurfacePainter {
  const seed = planet.paletteSeed
  const hue = seed % 360
  const heightSalt = seed ^ HEIGHT_SALT
  const detailSalt = seed ^ DETAIL_SALT

  const seaLevel = 0.46 + 0.1 * seedVariant(seed, 0)
  const capEdge = 0.72 + 0.18 * seedVariant(seed, 1)
  // 생명체 행성은 항상 또렷한 극관, 무생명 행성은 시드 따라 약하거나 없다
  const capStrength = planet.hasLife ? 1 : smoothstep(0.35, 0.75, seedVariant(seed, 2))
  const bandLow = 0.4 + 0.08 * seedVariant(seed, 3)

  // 명도는 플레이스홀더 단색(L 52%)과 평균이 비슷하게 — 어두운 팔레트는 행성이
  // 우주 배경에 묻히고, 텍스처 팝인 때 갑자기 시커매진다 ("너무 어둡다" 피드백)
  const deepOcean = hslToRgb(196 + 18 * seedVariant(seed, 4), 62, 35)
  const shallowOcean = hslToRgb(188, 56, 48)
  const lowTerrain = hslToRgb(hue, planet.hasLife ? 38 : 32, planet.hasLife ? 46 : 40)
  const midTerrain = hslToRgb(hue, 36, 52)
  const highTerrain = hslToRgb(hue + 16, 26, planet.hasLife ? 62 : 66)
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

interface GasStyle {
  readonly bandDark: readonly [number, number, number]
  readonly bandLight: readonly [number, number, number]
  readonly zoneTint: readonly [number, number, number]
  readonly storm: readonly [number, number, number]
  /** 밴드 명암 대비 (0=평탄, 1=강한 줄무늬). */
  readonly contrast: number
  /** 도메인 워프 난류 강도 — 띠 가장자리 소용돌이. */
  readonly turbulence: number
  /** 기본 밴드 주파수 배율. */
  readonly bandFreqScale: number
  /** 극지 후드 어두워짐 (0~1). */
  readonly poleDarken: number
  /** 대적점형 거대 스톰 여부. */
  readonly hasStorm: boolean
  /** Class V 열점 발광색 — 없으면 null. */
  readonly glow: readonly [number, number, number] | null
}

/**
 * Sudarsky 온도 클래스별 가스행성 외형 — 평형온도(∝ x^−1/2)가 구름 조성을 정한다 (고증).
 * 명도는 플레이스홀더 단색(L 62%)과 균형. null(무HZ 별)은 광도 모델이 무의미하므로
 * seed 색상 기반 목성형으로 다양성을 유지한다. hue는 seed로 살짝 흔들어 개체차를 준다.
 */
function gasStyleOf(planet: Planet, gasClass: GasClass | null): GasStyle {
  const seed = planet.paletteSeed
  const j = (seedVariant(seed, 0) - 0.5) * 16
  const hasStorm = seedVariant(seed, 5) > 0.35
  switch (gasClass) {
    case 'silicate': // V 최고온 — 규산/철 구름, 거의 검은 본체 + 용암빛 열점
      return { bandDark: hslToRgb(8 + j, 30, 10), bandLight: hslToRgb(14 + j, 28, 18),
        zoneTint: hslToRgb(6 + j, 30, 8), storm: hslToRgb(12, 40, 16),
        contrast: 0.5, turbulence: 0.85, bandFreqScale: 1.15, poleDarken: 0.42,
        hasStorm: false, glow: hslToRgb(22, 95, 55) }
    case 'alkali': // IV 고온 — 알칼리 금속, 짙은 적갈
      return { bandDark: hslToRgb(15 + j, 52, 24), bandLight: hslToRgb(24 + j, 46, 42),
        zoneTint: hslToRgb(10 + j, 46, 20), storm: hslToRgb(9, 58, 28),
        contrast: 0.62, turbulence: 0.62, bandFreqScale: 0.95, poleDarken: 0.36,
        hasStorm, glow: null }
    case 'cloudless': // III 중고온 — 구름 없는 레일리 산란, 감청
      return { bandDark: hslToRgb(214 + j, 56, 36), bandLight: hslToRgb(206 + j, 60, 58),
        zoneTint: hslToRgb(218 + j, 50, 46), storm: hslToRgb(210, 58, 28),
        contrast: 0.34, turbulence: 0.3, bandFreqScale: 0.7, poleDarken: 0.32,
        hasStorm: false, glow: null }
    case 'water': // II 온대 — 수운, 밝은 백색 고알베도 (칙칙한 회색 방지로 명도↑·채도↓·극후드↓)
      return { bandDark: hslToRgb(208 + j, 8, 89), bandLight: hslToRgb(202 + j, 4, 99),
        zoneTint: hslToRgb(205 + j, 6, 94), storm: hslToRgb(210, 12, 82),
        contrast: 0.3, turbulence: 0.4, bandFreqScale: 0.85, poleDarken: 0.12,
        hasStorm, glow: null }
    case 'ammonia': // I 저온 — 암모니아 구름, 목성형 황갈 띠 + 대적점
      return { bandDark: hslToRgb(32 + j, 55, 42), bandLight: hslToRgb(42 + j, 60, 68),
        zoneTint: hslToRgb(24 + j, 50, 52), storm: hslToRgb(14, 62, 40),
        contrast: 0.9, turbulence: 0.55, bandFreqScale: 1.0, poleDarken: 0.26,
        hasStorm: true, glow: null }
    default: { // 무HZ — seed 색상 목성형 (현행 다양성 유지)
      const hueA = seed % 360
      const hueB = (hueA + 22 + 36 * seedVariant(seed, 0)) % 360
      return { bandDark: hslToRgb(hueA, 54, 50), bandLight: hslToRgb(hueA, 60, 68),
        zoneTint: hslToRgb(hueB, 50, 58), storm: hslToRgb(hueB, 58, 38),
        contrast: 0.75, turbulence: 0.5, bandFreqScale: 1.0, poleDarken: 0.24,
        hasStorm, glow: null }
    }
  }
}

function scaleRgb(
  rgb: readonly [number, number, number],
  k: number,
): readonly [number, number, number] {
  return [rgb[0] * k, rgb[1] * k, rgb[2] * k]
}

const SPOT_HALF_LON = 0.5
const SPOT_HALF_LAT = 0.22

/** 대적점형 거대 스톰 마스크 [0,1] — seed 파생 위치에 경도로 길쭉한 타원 소용돌이. */
function greatSpotMask(px: number, pz: number, lat: number, seed: number): number {
  const spotLat = (seedVariant(seed, 6) - 0.5) * 1.2
  const spotLon = seedVariant(seed, 7) * FULL_TURN
  const dlon = Math.atan2(Math.sin(Math.atan2(pz, px) - spotLon), Math.cos(Math.atan2(pz, px) - spotLon))
  const a = dlon / SPOT_HALF_LON
  const b = (lat - spotLat) / SPOT_HALF_LAT
  return 1 - smoothstep(0.6, 1.0, Math.sqrt(a * a + b * b))
}

/**
 * 가스형 — Sudarsky 클래스별 조성색 + 2-스케일 도메인 워프 난류 띠 + 대적점형 스톰 +
 * 극 후드 + (Class V) 열점 발광. 온도(정규화 궤도)로 외형이 갈린다.
 */
function gasPainter(planet: Planet, gasClass: GasClass | null): SurfacePainter {
  const seed = planet.paletteSeed
  const swirlSalt = seed ^ SWIRL_SALT
  const detailSalt = seed ^ DETAIL_SALT
  const glowSalt = seed ^ STORM_SALT
  const style = gasStyleOf(planet, gasClass)
  const bandFrequency = (3.2 + 3.4 * seedVariant(seed, 2)) * style.bandFreqScale
  const bandPhase = seedVariant(seed, 3) * FULL_TURN

  return (px, py, pz, lat) => {
    // 2-스케일 도메인 워프 — 큰 소용돌이 + 미세 난류로 띠 가장자리를 흐트러뜨린다
    const warp = (fbm3(px * 1.7, py * 1.7, pz * 1.7, swirlSalt, 4) - 0.5) * style.turbulence
    const warpFine = (fbm3(px * 4.3 + 11, py * 4.3, pz * 4.3, detailSalt, 3) - 0.5) * style.turbulence * 0.35
    const wlat = Math.sin(lat) + warp + warpFine

    const band = 0.5 + 0.5 * Math.sin(wlat * Math.PI * bandFrequency + bandPhase)
    const zoneBand = 0.5 + 0.5 * Math.sin(wlat * Math.PI * bandFrequency * 0.5 + bandPhase * 1.7)
    const bandMix = 0.5 + (band - 0.5) * style.contrast
    let rgb = mixRgb(mixRgb(style.bandDark, style.bandLight, bandMix), style.zoneTint, zoneBand * 0.4)

    if (style.hasStorm) {
      rgb = mixRgb(rgb, style.storm, greatSpotMask(px, pz, lat, seed) * 0.8)
    }
    if (style.glow != null) {
      const hot = smoothstep(0.68, 0.9, fbm3(px * 1.4 + 5.7, py * 1.4, pz * 1.4, glowSalt, 3))
      rgb = mixRgb(rgb, style.glow, hot * 0.55)
    }

    const pole = smoothstep(0.55, 1.0, Math.abs(Math.sin(lat)))
    return [...scaleRgb(rgb, 1 - style.poleDarken * pole), OPAQUE]
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

/**
 * @param baseWidth 등장방형 베이스 가로 텍셀 수 (세로는 절반) — 품질 티어 프리셋 값.
 * @param hzOrbit 정규화 궤도 x(= 실제 궤도 / HZ 중심) — 표면 재질을 정한다. 암석은 온도대
 *   (용암/온대/얼음), 가스는 Sudarsky 클래스(조성색). null이면 온도 무반영 (무HZ 별,
 *   hz-visualization). 렌더 전용이라 draw 미소비 → GEN_VERSION·저장 무관.
 */
export function bakePlanetTextures(
  planet: Planet,
  baseWidth: number,
  hzOrbit: number | null = null,
): PlanetTextureSet {
  const baseHeight = baseWidth / 2
  const zone: TemperatureZone | null = hzOrbit == null ? null : temperatureZoneAt(hzOrbit)
  const gasClass: GasClass | null = hzOrbit == null ? null : gasClassOf(hzOrbit)
  const painter =
    planet.kind === 'rocky' ? rockyPainter(planet, zone) : gasPainter(planet, gasClass)
  const surface = bakeEquirect(
    baseWidth,
    baseHeight,
    SURFACE_UPSCALE_FACTOR,
    SURFACE_BLUR_PX,
    painter,
  )
  const clouds = planet.hasLife
    ? bakeEquirect(
        baseWidth / CLOUD_BASE_DIVISOR,
        baseHeight / CLOUD_BASE_DIVISOR,
        CLOUD_UPSCALE_FACTOR,
        CLOUD_BLUR_PX,
        cloudPainter(planet),
      )
    : null
  return { surface, clouds }
}

export function disposePlanetTextures(textures: PlanetTextureSet): void {
  textures.surface.dispose()
  textures.clouds?.dispose()
}
