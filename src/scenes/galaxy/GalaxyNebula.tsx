import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  CanvasTexture,
  DoubleSide,
  type Mesh,
  MeshBasicMaterial,
  type Vector3,
} from 'three'

import { armRidgeAt, GALAXY_RADIUS_SECTORS, SECTOR_SIZE, sectorDensity } from '@/engine'
import { valueNoise3 } from '@/engine/noise/valueNoise'
import {
  NEBULA_ROSE_RGB,
  NEBULA_TEAL_RGB,
  NEBULA_TINT_MAX_BLEND,
  nebulaTintAt,
  nebulaTintShift,
} from '@/scenes/galaxy/galaxyNebulae'
import { enableLensEnvLayer } from '@/scenes/shared/lensEnvironment'

/**
 * 은하 성운 헤이즈 — 밀도 함수를 텍스처로 구워 은하면에 깐 평면 1장 (드로콜 1).
 *
 * 실제 별과 같은 sectorDensity에서 나오므로 헤이즈가 나선팔·벌지에 정확히
 * 달라붙는다. 점 블롭이 아닌 연속 발광 면이라 "가짜 별"로 읽히지 않으며,
 * 줌인하면 페이드아웃되어 근경 별밭을 가리지 않는다.
 * 밀도 함수는 시드와 무관(매크로 형상 공유)이라 텍스처는 1회 생성으로 충분하다.
 */

/** 섹터당 1텍셀로 굽는 베이스 해상도 — 업스케일 보간이 부드러운 헤이즈를 만든다. */
const BASE_TEXELS = GALAXY_RADIUS_SECTORS * 2 + 1
const UPSCALE_FACTOR = 4
const UPSCALE_BLUR_PX = 3

/**
 * 줌아웃 시에만 보이는 페이드 구간 (카메라-초점 거리, 월드 단위).
 * 중간 줌에서 평면이 화면을 덮으면 회색 얼룩 + fill-rate 폭증이므로
 * 은하 전경이 한눈에 들어오는 구간에서만 떠오르게 한다.
 */
const FADE_NEAR_DISTANCE = 2_000
const FADE_FAR_DISTANCE = 4_500
const MAX_OPACITY = 0.4
/** 이 미만이면 mesh 렌더 자체를 끈다 — 투명한 전면 쿼드의 fill-rate 낭비 방지. */
const VISIBLE_OPACITY_THRESHOLD = 0.01

/** 벌지(중심) 난색 → 나선팔(외곽) 한색. */
const BULGE_RGB = [255, 208, 150] as const
const ARM_RGB = [110, 140, 235] as const
const COLOR_BLEND_RADIUS_SECTORS = 10

/** 중심 광원 — 텍스처 위에 덧그리는 코어 글로우 (벌지 반경의 배수). */
const CORE_GLOW_RADIUS_SECTORS = 14
const CORE_GLOW_ALPHA = 0.85

/**
 * 나선팔 먼지 레인 (galaxy-realism-pass) — 실제 나선은하 사진에서 팔의 **안쪽 가장자리**를
 * 따라 도는 어두운 먼지 띠 (밀도파 이론: 가스가 팔 중력 우물로 낙하하며 안쪽에 충격 압축).
 * 위상 오프셋 +는 같은 반경에서 능선보다 안쪽 위상을 가리킨다 (armRidgeAt 계약).
 */
const DUST_LANE_PHASE_OFFSET = 0.62
const DUST_LANE_DEPTH = 0.55
/** 레인은 원반 팔 구간에만 — 벌지(≤6섹터) 안은 무정형이라 제외. */
const DUST_LANE_RADIUS_START = 5
const DUST_LANE_RADIUS_FULL = 9
/** 레인 패치 노이즈 — 균일한 검은 줄은 인공적, 사진처럼 끊기고 뭉친다. */
const DUST_PATCH_FREQUENCY = 0.3
const DUST_PATCH_SALT = 14
const DUST_PATCH_FLOOR = 0.35

/**
 * HII 영역 매듭 (galaxy-realism-pass) — 팔을 따라 박힌 별 형성 영역의 H-알파 분홍 점.
 * 고주파 노이즈의 상위 꼬리만 매듭으로 맺혀 "군데군데" 배치된다 (결정론, 시드 무관).
 */
const HII_RGB = [255, 118, 150] as const
const HII_NOISE_FREQUENCY = 0.55
const HII_SALT = 13
const HII_THRESHOLD_LOW = 0.76
const HII_THRESHOLD_HIGH = 0.92
const HII_GAIN = 0.85


function clamp01(value: number): number {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp01((value - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

function buildNebulaTexture(): CanvasTexture {
  // 1) 섹터당 1텍셀 — 정수 섹터 좌표 원칙대로 샘플링
  const base = document.createElement('canvas')
  base.width = BASE_TEXELS
  base.height = BASE_TEXELS
  const baseContext = base.getContext('2d')
  if (baseContext == null) throw new Error('성운 텍스처용 2D 컨텍스트를 만들 수 없습니다')

  const image = baseContext.createImageData(BASE_TEXELS, BASE_TEXELS)
  for (let texelZ = 0; texelZ < BASE_TEXELS; texelZ++) {
    for (let texelX = 0; texelX < BASE_TEXELS; texelX++) {
      const sx = texelX - GALAXY_RADIUS_SECTORS
      const sz = texelZ - GALAXY_RADIUS_SECTORS
      const density = sectorDensity({ sx, sy: 0, sz })

      const radius = Math.sqrt(sx * sx + sz * sz)
      const warmth = clamp01(1 - radius / COLOR_BLEND_RADIUS_SECTORS)
      // 어두운 영역을 더 어둡게 — 팔 사이 공간이 비어 보여야 나선이 산다
      let brightness = Math.pow(density, 1.2)

      // 먼지 레인 — 팔 안쪽 가장자리를 따라 헤이즈를 깎는다 (벌지 밖 원반 구간만, 패치형).
      const laneWeight = smoothstep(DUST_LANE_RADIUS_START, DUST_LANE_RADIUS_FULL, radius)
      const lanePatch =
        DUST_PATCH_FLOOR +
        (1 - DUST_PATCH_FLOOR) *
          valueNoise3(sx * DUST_PATCH_FREQUENCY, 0, sz * DUST_PATCH_FREQUENCY, DUST_PATCH_SALT)
      const dustLane = armRidgeAt(sx, sz, DUST_LANE_PHASE_OFFSET) * laneWeight * lanePatch
      brightness *= 1 - DUST_LANE_DEPTH * dustLane

      // HII 매듭 — 팔 능선 위 고주파 노이즈 상위 꼬리만 분홍 점으로 (별 형성 영역).
      const hiiNoise = valueNoise3(sx * HII_NOISE_FREQUENCY, 0, sz * HII_NOISE_FREQUENCY, HII_SALT)
      const hiiKnot =
        smoothstep(HII_THRESHOLD_LOW, HII_THRESHOLD_HIGH, hiiNoise) *
        armRidgeAt(sx, sz) *
        laneWeight *
        HII_GAIN

      // 성운 색조 — 우주선 뷰 파노라마와 같은 필드 (galaxyNebulae, 우주 일관성)
      const tint = nebulaTintAt(sx, 0, sz)
      const roseShift = nebulaTintShift(tint.rose) * NEBULA_TINT_MAX_BLEND
      const tealShift = nebulaTintShift(tint.teal) * NEBULA_TINT_MAX_BLEND

      let red = ARM_RGB[0] + (BULGE_RGB[0] - ARM_RGB[0]) * warmth
      let green = ARM_RGB[1] + (BULGE_RGB[1] - ARM_RGB[1]) * warmth
      let blue = ARM_RGB[2] + (BULGE_RGB[2] - ARM_RGB[2]) * warmth
      red += (NEBULA_ROSE_RGB[0] - red) * roseShift
      green += (NEBULA_ROSE_RGB[1] - green) * roseShift
      blue += (NEBULA_ROSE_RGB[2] - blue) * roseShift
      red += (NEBULA_TEAL_RGB[0] - red) * tealShift
      green += (NEBULA_TEAL_RGB[1] - green) * tealShift
      blue += (NEBULA_TEAL_RGB[2] - blue) * tealShift

      const offset = (texelZ * BASE_TEXELS + texelX) * 4
      image.data[offset] = red * brightness + HII_RGB[0] * hiiKnot
      image.data[offset + 1] = green * brightness + HII_RGB[1] * hiiKnot
      image.data[offset + 2] = blue * brightness + HII_RGB[2] * hiiKnot
      image.data[offset + 3] = 255 // 가산 블렌딩 — 검정 = 투명
    }
  }
  baseContext.putImageData(image, 0, 0)

  // 2) 블러 업스케일 — 텍셀 격자를 연속 발광 면으로
  const upscaled = document.createElement('canvas')
  const upscaledSize = BASE_TEXELS * UPSCALE_FACTOR
  upscaled.width = upscaledSize
  upscaled.height = upscaledSize
  const context = upscaled.getContext('2d')
  if (context == null) throw new Error('성운 텍스처용 2D 컨텍스트를 만들 수 없습니다')
  context.imageSmoothingEnabled = true
  context.filter = `blur(${UPSCALE_BLUR_PX}px)`
  context.drawImage(base, 0, 0, upscaledSize, upscaledSize)
  context.filter = 'none'

  // 3) 중심 광원 — 은하핵의 따뜻한 코어 글로우
  const center = upscaledSize / 2
  const glowRadius = CORE_GLOW_RADIUS_SECTORS * UPSCALE_FACTOR
  const gradient = context.createRadialGradient(center, center, 0, center, center, glowRadius)
  gradient.addColorStop(0, `rgba(255, 232, 195, ${CORE_GLOW_ALPHA})`)
  gradient.addColorStop(0.35, 'rgba(255, 210, 150, 0.35)')
  gradient.addColorStop(1, 'rgba(255, 190, 120, 0)')
  context.globalCompositeOperation = 'lighter'
  context.fillStyle = gradient
  context.fillRect(center - glowRadius, center - glowRadius, glowRadius * 2, glowRadius * 2)

  const texture = new CanvasTexture(upscaled)
  texture.colorSpace = 'srgb'
  return texture
}

export function GalaxyNebula() {
  const meshRef = useRef<Mesh>(null)

  const texture = useMemo(() => buildNebulaTexture(), [])
  const material = useMemo(
    () =>
      new MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
      }),
    [texture],
  )

  useEffect(() => () => texture.dispose(), [texture])
  useEffect(() => () => material.dispose(), [material])

  useFrame((state) => {
    // 줌아웃할 때만 떠오른다 — 근접 항행 중에는 별밭이 주인공
    const controls = state.controls as { target?: Vector3 } | null
    const focus = controls?.target
    const zoomDistance =
      focus == null ? FADE_FAR_DISTANCE : state.camera.position.distanceTo(focus)
    const opacity = MAX_OPACITY * smoothstep(FADE_NEAR_DISTANCE, FADE_FAR_DISTANCE, zoomDistance)

    material.opacity = opacity
    const mesh = meshRef.current
    if (mesh != null) mesh.visible = opacity > VISIBLE_OPACITY_THRESHOLD
  })

  const planeSize = BASE_TEXELS * SECTOR_SIZE

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} material={material} onUpdate={enableLensEnvLayer}>
      <planeGeometry args={[planeSize, planeSize]} />
    </mesh>
  )
}
