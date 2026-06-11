import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  CanvasTexture,
  Float32BufferAttribute,
  MeshBasicMaterial,
} from 'three'

import type { Seed, StarId } from '@/engine'
import { SECTOR_SIZE, starWorldPosition } from '@/engine'
import { SPECTRAL_RENDER } from '@/scenes/galaxy/spectral'
import { generateGalaxyStars } from '@/scenes/galaxy/useGalaxyStars'
import { createStarGlowMaterial, setUniform } from '@/scenes/shared/starGlowMaterial'

/**
 * 은하수 띠 — 분해되지 않는 먼 별빛 (백로그 E-6 후속, 결정 25 보완).
 *
 * 은하 안에서 하늘을 보면 개별 점으로 분해되는 가까운 별 뒤로, 원반의 먼 별빛이
 * 띠(은하수)로 보인다 — 은하의 "형태"는 절대 보이지 않는다.
 * SystemBackdropStars가 ①분해되는 점을 맡고, 이 컴포넌트가 ②띠를 맡는다.
 *
 * 은하수는 구름이 아니라 입자다: 매끈한 텍스처 면은 "뿌연 구름"으로 읽힌다는
 * 피드백으로, 누적 광량 맵을 중요도 샘플링한 수만 개의 미세 입자 별(Points)이
 * 띠의 본체가 되고, 텍스처 구는 아주 옅은 밑광만 깐다. 시드 결정론 유지.
 */

/** 누적 베이스 해상도 — 등장방형 (가로 = 방위각 360°, 세로 = 고도 180°). */
const BASE_WIDTH = 256
const BASE_HEIGHT = 128
const UPSCALE_FACTOR = 4
const UPSCALE_BLUR_PX = 2
/** 밑광 천구 반경 — 배경 별 셸(4,000)보다 살짝 안쪽 (가산이라 순서 무관, far 안). */
const BAND_SPHERE_RADIUS = 3_900
/** 입자 별 셸 반경 — 밑광과 배경 별 사이. */
const GRAIN_SHELL_RADIUS = 3_950
/** 이 실거리(월드 단위)에서 광량 가중치 1 — 1/d² 누적의 기준점. */
const LUMINANCE_REFERENCE_DISTANCE = 300
/**
 * 이보다 가까운 별은 "분해되는 별"로 보고 띠에서 제외 — 가까운 별은
 * SystemBackdropStars의 또렷한 점이 맡고, 띠는 수많은 먼 별의 합만 담는다.
 */
const RESOLVED_STAR_DISTANCE = 1_200
/** 별 하나의 기여 상한 — 개별 별이 식별 가능한 얼룩이 되지 않게 누른다. */
const MAX_STAR_WEIGHT = 0.06
/** 톤맵 강도 — 누적 광량을 1 - exp(-sum * K)로 압축한다. */
const TONEMAP_STRENGTH = 10
/** 콘트라스트 지수 — 옅은 영역을 깎아 띠의 심지를 세운다. */
const CONTRAST_POWER = 1.5
/** 밑광 밝기 — 입자가 띠의 본체이므로 면은 은은한 받침으로만. */
const UNDER_GLOW_OPACITY = 0.12

/** 입자 별 수 — 광량 맵을 중요도 샘플링해 띠를 따라 뿌려진다. */
const GRAIN_STAR_COUNT = 14_000
/** 입자 밝기·크기 변주 — 보일 듯 말 듯한 잔별 무리. */
const GRAIN_BRIGHTNESS_BASE = 0.18
const GRAIN_BRIGHTNESS_SPAN = 0.35
const GRAIN_SIZE_BASE = 0.9
const GRAIN_SIZE_SPAN = 0.8
const GRAIN_MAX_POINT_SIZE = 2
const GRAIN_MIN_POINT_SIZE_PER_UNIT = 0.55

/**
 * 3×3 텐트 커널 — 7천여 점 샘플은 텍셀 단일 스플랫으로는 듬성해서
 * 블러만으로는 얼룩이 남는다. 누적 단계에서 이웃 텍셀로 펴서 띠를 매끈하게.
 */
const SPLAT_KERNEL: ReadonlyArray<readonly [number, number, number]> = [
  [-1, -1, 0.25], [0, -1, 0.5], [1, -1, 0.25],
  [-1, 0, 0.5], [0, 0, 1], [1, 0, 0.5],
  [-1, 1, 0.25], [0, 1, 0.5], [1, 1, 0.25],
]

/** 결정론 해시 — 모든 플레이어가 같은 입자 무늬를 본다 (전역 난수 금지). */
function hash01(n: number): number {
  const value = Math.sin(n) * 43758.5453
  return value - Math.floor(value)
}

interface BandBake {
  readonly texture: CanvasTexture
  readonly grainGeometry: BufferGeometry
}

function bakeBand(seed: Seed, starId: StarId): BandBake | null {
  const origin = starWorldPosition(seed, starId)
  if (origin == null) return null

  // 1) 실제 별 전수의 광량을 등장방형으로 누적
  const stars = generateGalaxyStars(seed)
  const accumulated = new Float32Array(BASE_WIDTH * BASE_HEIGHT * 3)

  for (const star of stars) {
    if (star.id === starId) continue

    const dx = star.sector.sx * SECTOR_SIZE + star.localPos[0] - origin[0]
    const dy = star.sector.sy * SECTOR_SIZE + star.localPos[1] - origin[1]
    const dz = star.sector.sz * SECTOR_SIZE + star.localPos[2] - origin[2]
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)
    if (distance < RESOLVED_STAR_DISTANCE) continue

    // three.js SphereGeometry UV 공식과 동일한 매핑 — 점 별 셸과 방향이 정확히 일치한다
    //   u = atan2(z, -x) / 2π + 0.5, v = acos(y/d) / π
    const azimuth = Math.atan2(dz / distance, -dx / distance)
    const u = azimuth / (Math.PI * 2) + 0.5
    const v = Math.acos(Math.min(1, Math.max(-1, dy / distance))) / Math.PI

    const texelX = Math.min(BASE_WIDTH - 1, Math.floor(u * BASE_WIDTH))
    const texelY = Math.min(BASE_HEIGHT - 1, Math.floor(v * BASE_HEIGHT))

    const ratio = LUMINANCE_REFERENCE_DISTANCE / distance
    const weight = Math.min(MAX_STAR_WEIGHT, ratio * ratio)
    const render = SPECTRAL_RENDER[star.spectral]
    const color = parseInt(render.color.slice(1), 16)
    const red = (((color >> 16) & 0xff) / 255) * weight
    const green = (((color >> 8) & 0xff) / 255) * weight
    const blue = ((color & 0xff) / 255) * weight

    for (const [kernelX, kernelY, kernelWeight] of SPLAT_KERNEL) {
      // 방위각(x)은 360° 순환, 고도(y)는 극에서 클램프
      const splatX = (texelX + kernelX + BASE_WIDTH) % BASE_WIDTH
      const splatY = Math.min(BASE_HEIGHT - 1, Math.max(0, texelY + kernelY))
      const offset = (splatY * BASE_WIDTH + splatX) * 3
      accumulated[offset] = (accumulated[offset] ?? 0) + red * kernelWeight
      accumulated[offset + 1] = (accumulated[offset + 1] ?? 0) + green * kernelWeight
      accumulated[offset + 2] = (accumulated[offset + 2] ?? 0) + blue * kernelWeight
    }
  }

  // 2) 톤맵 — 밑광 텍스처와 입자 샘플링이 같은 맵을 공유한다
  const texelCount = BASE_WIDTH * BASE_HEIGHT
  const tonemapped = new Float32Array(texelCount * 3)
  for (let texel = 0; texel < texelCount; texel++) {
    for (let channel = 0; channel < 3; channel++) {
      const luminance = accumulated[texel * 3 + channel] ?? 0
      tonemapped[texel * 3 + channel] = Math.pow(
        1 - Math.exp(-luminance * TONEMAP_STRENGTH),
        CONTRAST_POWER,
      )
    }
  }

  // 3) 밑광 텍스처
  const base = document.createElement('canvas')
  base.width = BASE_WIDTH
  base.height = BASE_HEIGHT
  const baseContext = base.getContext('2d')
  if (baseContext == null) throw new Error('은하수 띠 텍스처용 2D 컨텍스트를 만들 수 없습니다')

  const image = baseContext.createImageData(BASE_WIDTH, BASE_HEIGHT)
  for (let texel = 0; texel < texelCount; texel++) {
    image.data[texel * 4] = (tonemapped[texel * 3] ?? 0) * 255
    image.data[texel * 4 + 1] = (tonemapped[texel * 3 + 1] ?? 0) * 255
    image.data[texel * 4 + 2] = (tonemapped[texel * 3 + 2] ?? 0) * 255
    image.data[texel * 4 + 3] = 255 // 가산 블렌딩 — 검정 = 투명
  }
  baseContext.putImageData(image, 0, 0)

  const upscaled = document.createElement('canvas')
  upscaled.width = BASE_WIDTH * UPSCALE_FACTOR
  upscaled.height = BASE_HEIGHT * UPSCALE_FACTOR
  const context = upscaled.getContext('2d')
  if (context == null) throw new Error('은하수 띠 텍스처용 2D 컨텍스트를 만들 수 없습니다')
  context.imageSmoothingEnabled = true
  context.filter = `blur(${UPSCALE_BLUR_PX}px)`
  context.drawImage(base, 0, 0, upscaled.width, upscaled.height)
  context.filter = 'none'

  const texture = new CanvasTexture(upscaled)
  texture.colorSpace = 'srgb'

  // 4) 입자 별 — 광량 누적 분포(CDF)를 중요도 샘플링해 띠를 따라 뿌린다
  const cumulative = new Float64Array(texelCount)
  let total = 0
  for (let texel = 0; texel < texelCount; texel++) {
    total +=
      (tonemapped[texel * 3] ?? 0) +
      (tonemapped[texel * 3 + 1] ?? 0) +
      (tonemapped[texel * 3 + 2] ?? 0)
    cumulative[texel] = total
  }
  if (total <= 0) {
    return { texture, grainGeometry: new BufferGeometry() }
  }

  const positions = new Float32Array(GRAIN_STAR_COUNT * 3)
  const colors = new Float32Array(GRAIN_STAR_COUNT * 3)
  const sizes = new Float32Array(GRAIN_STAR_COUNT)

  for (let grain = 0; grain < GRAIN_STAR_COUNT; grain++) {
    // CDF 이진 탐색으로 텍셀 선택 — 밝은 띠일수록 입자가 빽빽하다
    const pick = hash01(grain * 4 + 1) * total
    let low = 0
    let high = texelCount - 1
    while (low < high) {
      const mid = (low + high) >> 1
      if ((cumulative[mid] ?? 0) < pick) low = mid + 1
      else high = mid
    }
    const texelX = low % BASE_WIDTH
    const texelY = Math.floor(low / BASE_WIDTH)

    // 텍셀 안에서 지터 — 격자 무늬가 드러나지 않게
    const u = (texelX + hash01(grain * 4 + 2)) / BASE_WIDTH
    const v = (texelY + hash01(grain * 4 + 3)) / BASE_HEIGHT

    // 등장방형 → 방향 (위 매핑의 역변환)
    const theta = v * Math.PI
    const phi = (u - 0.5) * Math.PI * 2
    const sinTheta = Math.sin(theta)
    positions[grain * 3] = -Math.cos(phi) * sinTheta * GRAIN_SHELL_RADIUS
    positions[grain * 3 + 1] = Math.cos(theta) * GRAIN_SHELL_RADIUS
    positions[grain * 3 + 2] = Math.sin(phi) * sinTheta * GRAIN_SHELL_RADIUS

    // 색은 텍셀의 색조만 취하고 밝기는 입자 변주로 — 밀도가 구조를 그린다
    const red = tonemapped[low * 3] ?? 0
    const green = tonemapped[low * 3 + 1] ?? 0
    const blue = tonemapped[low * 3 + 2] ?? 0
    const maxChannel = Math.max(red, green, blue, 0.0001)
    const brightness = GRAIN_BRIGHTNESS_BASE + GRAIN_BRIGHTNESS_SPAN * hash01(grain * 4 + 4)
    colors[grain * 3] = (red / maxChannel) * brightness
    colors[grain * 3 + 1] = (green / maxChannel) * brightness
    colors[grain * 3 + 2] = (blue / maxChannel) * brightness
    sizes[grain] = GRAIN_SIZE_BASE + GRAIN_SIZE_SPAN * hash01(grain * 4 + 5)
  }

  const grainGeometry = new BufferGeometry()
  grainGeometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  grainGeometry.setAttribute('starColor', new Float32BufferAttribute(colors, 3))
  grainGeometry.setAttribute('size', new Float32BufferAttribute(sizes, 1))

  return { texture, grainGeometry }
}

interface GalacticBandProps {
  readonly seed: Seed
  readonly starId: StarId
}

export function GalacticBand({ seed, starId }: GalacticBandProps) {
  const bake = useMemo(() => bakeBand(seed, starId), [seed, starId])
  const underGlowMaterial = useMemo(() => {
    if (bake == null) return null
    return new MeshBasicMaterial({
      map: bake.texture,
      transparent: true,
      opacity: UNDER_GLOW_OPACITY,
      blending: AdditiveBlending,
      depthWrite: false,
      side: BackSide,
    })
  }, [bake])
  const grainMaterial = useMemo(
    () =>
      createStarGlowMaterial({
        maxPointSize: GRAIN_MAX_POINT_SIZE,
        initialOpacity: 1,
        minPointSizePerUnit: GRAIN_MIN_POINT_SIZE_PER_UNIT,
      }),
    [],
  )

  useEffect(
    () => () => {
      if (bake != null) {
        bake.texture.dispose()
        bake.grainGeometry.dispose()
      }
    },
    [bake],
  )
  useEffect(
    () => () => {
      if (underGlowMaterial != null) underGlowMaterial.dispose()
    },
    [underGlowMaterial],
  )
  useEffect(() => () => grainMaterial.dispose(), [grainMaterial])

  useFrame((state) => {
    setUniform(grainMaterial, 'uPixelRatio', state.gl.getPixelRatio())
  })

  if (bake == null || underGlowMaterial == null) return null

  return (
    <>
      <mesh material={underGlowMaterial}>
        <sphereGeometry args={[BAND_SPHERE_RADIUS, 48, 24]} />
      </mesh>
      <points geometry={bake.grainGeometry} material={grainMaterial} />
    </>
  )
}
