import { useEffect, useMemo } from 'react'
import { AdditiveBlending, BackSide, CanvasTexture, MeshBasicMaterial } from 'three'

import type { Seed, StarId } from '@/engine'
import { SECTOR_SIZE, starWorldPosition } from '@/engine'
import { SPECTRAL_RENDER } from '@/scenes/galaxy/spectral'
import { generateGalaxyStars } from '@/scenes/galaxy/useGalaxyStars'

/**
 * 은하수 띠 — 분해되지 않는 먼 별빛의 확산 글로우 (백로그 E-6 후속, 결정 25 보완).
 *
 * 은하 안에서 하늘을 보면 개별 점으로 분해되는 가까운 별 뒤로, 원반의 먼 별빛이
 * 합쳐져 뿌연 띠(은하수)로 보인다 — 은하의 "형태"는 절대 보이지 않는다.
 * SystemBackdropStars가 ①분해되는 점을 맡고, 이 컴포넌트가 ②확산 띠를 맡는다.
 *
 * 구현: 캐시된 실제 별 전수의 광량(1/d²)을 시선 방향 등장방형 텍스처에 누적 →
 * 블러 업스케일 → 천구 안쪽 면(BackSide 구) 가산. 실데이터 기반이라 띠가 점 별
 * 분포와 정확히 정합하고, 은하 중심 방향이 자연히 가장 밝다. 시드 결정론 유지.
 */

/** 누적 베이스 해상도 — 등장방형 (가로 = 방위각 360°, 세로 = 고도 180°). */
const BASE_WIDTH = 128
const BASE_HEIGHT = 64
const UPSCALE_FACTOR = 4
const UPSCALE_BLUR_PX = 3
/** 천구 반경 — 배경 별 셸(4,000)보다 살짝 안쪽 (가산이라 순서는 무관, far 안). */
const BAND_SPHERE_RADIUS = 3_900
/** 이 실거리(월드 단위)에서 광량 가중치 1 — 1/d² 누적의 기준점. */
const LUMINANCE_REFERENCE_DISTANCE = 300
/**
 * 이보다 가까운 별은 "분해되는 별"로 보고 띠에서 제외 — 가까운 별은
 * SystemBackdropStars의 또렷한 점이 맡고, 띠는 수많은 먼 별의 합만 담는다.
 * 값이 작으면 중거리 별 하나하나가 블러 뒤 구름 조각으로 도드라진다.
 */
const RESOLVED_STAR_DISTANCE = 1_200
/** 별 하나의 기여 상한 — 개별 별이 식별 가능한 얼룩이 되지 않게 누른다. */
const MAX_STAR_WEIGHT = 0.06
/** 톤맵 강도 — 누적 광량을 1 - exp(-sum * K)로 압축한다. */
const TONEMAP_STRENGTH = 3
/** 띠 전체 밝기 상한 — 점 별이 주인공, 띠는 배경 광량. */
const BAND_MAX_OPACITY = 0.35

/**
 * 3×3 텐트 커널 — 7천여 점 샘플은 텍셀 단일 스플랫으로는 듬성해서
 * 블러만으로는 얼룩이 남는다. 누적 단계에서 이웃 텍셀로 펴서 띠를 매끈하게.
 */
const SPLAT_KERNEL: ReadonlyArray<readonly [number, number, number]> = [
  [-1, -1, 0.25], [0, -1, 0.5], [1, -1, 0.25],
  [-1, 0, 0.5], [0, 0, 1], [1, 0, 0.5],
  [-1, 1, 0.25], [0, 1, 0.5], [1, 1, 0.25],
]

function buildBandTexture(seed: Seed, starId: StarId): CanvasTexture | null {
  const origin = starWorldPosition(seed, starId)
  if (origin == null) return null

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
    //   u = atan2(z, -x) / 2π, 캔버스 y = acos(y/d) / π * H
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

  // 톤맵 → 베이스 캔버스
  const base = document.createElement('canvas')
  base.width = BASE_WIDTH
  base.height = BASE_HEIGHT
  const baseContext = base.getContext('2d')
  if (baseContext == null) throw new Error('은하수 띠 텍스처용 2D 컨텍스트를 만들 수 없습니다')

  const image = baseContext.createImageData(BASE_WIDTH, BASE_HEIGHT)
  for (let texel = 0; texel < BASE_WIDTH * BASE_HEIGHT; texel++) {
    const source = texel * 3
    const target = texel * 4
    image.data[target] = (1 - Math.exp(-(accumulated[source] ?? 0) * TONEMAP_STRENGTH)) * 255
    image.data[target + 1] =
      (1 - Math.exp(-(accumulated[source + 1] ?? 0) * TONEMAP_STRENGTH)) * 255
    image.data[target + 2] =
      (1 - Math.exp(-(accumulated[source + 2] ?? 0) * TONEMAP_STRENGTH)) * 255
    image.data[target + 3] = 255 // 가산 블렌딩 — 검정 = 투명
  }
  baseContext.putImageData(image, 0, 0)

  // 블러 업스케일 — 텍셀 격자를 연속 발광 띠로 (GalaxyNebula와 같은 기법)
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
  return texture
}

interface GalacticBandProps {
  readonly seed: Seed
  readonly starId: StarId
}

export function GalacticBand({ seed, starId }: GalacticBandProps) {
  const texture = useMemo(() => buildBandTexture(seed, starId), [seed, starId])
  const material = useMemo(() => {
    if (texture == null) return null
    return new MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: BAND_MAX_OPACITY,
      blending: AdditiveBlending,
      depthWrite: false,
      side: BackSide,
    })
  }, [texture])

  useEffect(
    () => () => {
      if (texture != null) texture.dispose()
    },
    [texture],
  )
  useEffect(
    () => () => {
      if (material != null) material.dispose()
    },
    [material],
  )

  if (material == null) return null

  return (
    <mesh material={material}>
      <sphereGeometry args={[BAND_SPHERE_RADIUS, 48, 24]} />
    </mesh>
  )
}
