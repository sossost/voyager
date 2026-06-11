import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  BackSide,
  CanvasTexture,
  type Group,
  MeshBasicMaterial,
} from 'three'

import { GALAXY_RADIUS_SECTORS, SECTOR_SIZE, sectorDensity } from '@/engine'

/**
 * 우주선 뷰 은하 광원감 (백로그 G-b-6) — 함내에서 은하가 "별 점의 집합"이 아니라
 * "빛 덩어리"로 읽히게 하는 두 레이어:
 *
 * ① 원반 밴드 — 정박 별을 중심으로 한 실린더 안쪽 면에, 방위각마다 원반면(sy=0)을
 *    따라 sectorDensity를 선적분한 광량을 구워 붙인다. 실제 별과 같은 밀도 함수라
 *    벌지 방향이 가장 밝고 두꺼우며 나선팔 단면이 방위각 굴곡으로 남는다.
 * ② 코어 글로우 — 은하 중심의 가산 빌보드 1장 (DistantGalaxies 스머지 패턴).
 *
 * 결정 28에서 점·입자 접근이 두 차례 기각된 자리다 — GalaxyNebula(결정 23)처럼
 * 연속 텍스처 + 가산 블렌딩만 쓴다. 우주선 뷰·워프 전용 (전도는 GalaxyNebula 담당).
 * 렌더 전용 — 시드 생성 분포·GEN_VERSION·저장 포맷과 무관하다.
 */

/** 밴드 실린더 반경 — 정박 별에서 가장 먼 은하 별(≤9,600)보다 바깥, 장식 별밭(12,000) 안. */
const BAND_RADIUS = 10_500
/** 밴드 절반 높이 (월드) — 반경 대비 약 ±9°, 하늘을 삼키지 않는 차분한 띠 폭. */
const BAND_HALF_HEIGHT = 1_700
const BAND_HEIGHT = BAND_HALF_HEIGHT * 2
/** 실린더 둘레 분할 — 반경 10,500에서 다각형 모서리가 보이지 않는 최소선 (지오메트리 1회 업로드). */
const BAND_RADIAL_SEGMENTS = 96
const BAND_HEIGHT_SEGMENTS = 1
/** 뚜껑 없는 열린 실린더 — 안쪽 면(BackSide)만 쓴다. */
const BAND_OPEN_ENDED = true
const BAND_OPACITY = 0.42

/** 방위각 해상도 — 팔 단면 굴곡이 살아 있되 베이크(워프 도착 프레임)가 짧아야 한다. */
const AZIMUTH_COLUMNS = 384
const VERTICAL_TEXELS = 96
/** 적분 보폭 (섹터) — 팔 폭(수 섹터)보다 촘촘하면 충분하다. */
const RAY_STEP_SECTORS = 0.75
/** 적분 사거리 — 은하 지름이면 어느 정박 위치에서든 원반 반대편 끝까지 닿는다. */
const RAY_MAX_SECTORS = GALAXY_RADIUS_SECTORS * 2

/** 적분값이 이 값이면 밝기 1로 포화 — 벌지 정관통 방향만 닿는 상한 (포화 = 구조 소멸). */
const INTEGRAL_SATURATION = 26
/** 밝기 감마 (<1) — 팔 사이·외곽 방향에도 옅은 빛이 깔리게 어두운 쪽을 들어 올린다. */
const BRIGHTNESS_GAMMA = 0.8

/** 수직 가우시안 σ (절반 높이 대비) — 밝은 방향일수록 띠가 두꺼워진다. */
const SIGMA_BASE = 0.18
const SIGMA_SPAN = 0.3

/** 벌지(난색) ↔ 나선팔(한색) — GalaxyNebula(결정 23)와 같은 색 언어. */
const BULGE_RGB = [255, 208, 150] as const
const ARM_RGB = [110, 140, 235] as const
const COLOR_BLEND_RADIUS_SECTORS = 10
/** 밀도 가중 평균 난색도 증폭 — 벌지 방향만 난색으로, 띠 전체가 베이지가 되면 과한 것. */
const WARMTH_GAIN = 1.6

/** 코어 글로우 텍스처 한 변(px) — 라디얼 그라디언트라 저해상도로 충분하다. */
const CORE_TEXTURE_SIZE = 256
/** 코어 글로우 월드 크기 — 벌지 지름(1,200)을 살짝 감싸는 헤일로. */
const CORE_BASE_SIZE = 1_800
/** 화면 각크기 상한 (크기/거리) — 글로우는 벌지 별 무리의 심지여야지 하늘을 덮으면 "구체"로 읽힌다. */
const CORE_MAX_ANGULAR_RATIO = 0.22
const CORE_OPACITY = 0.45
/** 벌지 안쪽까지 들어가면 "중심 방향의 빛"이라는 빌보드의 전제가 깨진다 — 근접 페이드. */
const CORE_FADE_NEAR = 700
const CORE_FADE_FAR = 1_600

function clamp01(value: number): number {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp01((value - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

interface BandColumn {
  /** 정규화 광량 [0, 1]. */
  readonly brightness: number
  /** 밀도 가중 벌지 근접도 [0, 1] — 색 보간용. */
  readonly warmth: number
}

/** 한 방위각 방향의 원반 광량 — 원반면을 따라 밀도를 선적분한다 (표면 밝기라 거리 가중 없음). */
function integrateColumn(anchorSx: number, anchorSz: number, theta: number): BandColumn {
  const directionX = Math.sin(theta)
  const directionZ = Math.cos(theta)

  let integral = 0
  let warmthIntegral = 0
  for (let distance = 0; distance <= RAY_MAX_SECTORS; distance += RAY_STEP_SECTORS) {
    const sx = anchorSx + directionX * distance
    const sz = anchorSz + directionZ * distance
    const density = sectorDensity({ sx, sy: 0, sz })
    if (density === 0) continue

    const weighted = density * RAY_STEP_SECTORS
    integral += weighted
    const radiusFromCore = Math.sqrt(sx * sx + sz * sz)
    warmthIntegral += weighted * clamp01(1 - radiusFromCore / COLOR_BLEND_RADIUS_SECTORS)
  }

  const brightness = Math.pow(clamp01(integral / INTEGRAL_SATURATION), BRIGHTNESS_GAMMA)
  const warmth = integral > 0 ? clamp01((warmthIntegral / integral) * WARMTH_GAIN) : 0
  return { brightness, warmth }
}

function buildBandTexture(anchorX: number, anchorZ: number): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = AZIMUTH_COLUMNS
  canvas.height = VERTICAL_TEXELS
  const context = canvas.getContext('2d')
  if (context == null) throw new Error('은하 밴드 텍스처용 2D 컨텍스트를 만들 수 없습니다')

  const anchorSx = anchorX / SECTOR_SIZE
  const anchorSz = anchorZ / SECTOR_SIZE

  const image = context.createImageData(AZIMUTH_COLUMNS, VERTICAL_TEXELS)
  for (let column = 0; column < AZIMUTH_COLUMNS; column++) {
    // three.js CylinderGeometry UV 규약: u = θ/2π, 측면 정점 = (r·sinθ, y, r·cosθ)
    const theta = (column / AZIMUTH_COLUMNS) * Math.PI * 2
    const { brightness, warmth } = integrateColumn(anchorSx, anchorSz, theta)

    const red = ARM_RGB[0] + (BULGE_RGB[0] - ARM_RGB[0]) * warmth
    const green = ARM_RGB[1] + (BULGE_RGB[1] - ARM_RGB[1]) * warmth
    const blue = ARM_RGB[2] + (BULGE_RGB[2] - ARM_RGB[2]) * warmth
    const sigma = SIGMA_BASE + SIGMA_SPAN * brightness

    for (let row = 0; row < VERTICAL_TEXELS; row++) {
      const elevation = (row / (VERTICAL_TEXELS - 1)) * 2 - 1
      const level = brightness * Math.exp(-((elevation / sigma) ** 2))
      const offset = (row * AZIMUTH_COLUMNS + column) * 4
      image.data[offset] = red * level
      image.data[offset + 1] = green * level
      image.data[offset + 2] = blue * level
      image.data[offset + 3] = 255 // 가산 블렌딩 — 검정 = 투명 (GalaxyNebula와 같은 규약)
    }
  }
  context.putImageData(image, 0, 0)

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = 'srgb'
  return texture
}

/**
 * 밴드 텍스처 단일 캐시 — 같은 정박 별이면 씬 전환(은하↔별계) 리마운트에도 재베이크하지
 * 않는다 (DistantGalaxies 캐시와 같은 트레이드오프). 정박이 바뀌어 밀려난 텍스처는
 * 즉시 dispose하지 않고 적치한다 — 렌더 단계(useMemo)에서 파괴적 부수효과를 일으키면
 * 동시성 재렌더에서 표시 중인 텍스처를 폐기할 수 있어, 폐기는 커밋 시점(useEffect)에 한다.
 */
let cachedBand: { readonly key: string; readonly texture: CanvasTexture } | null = null
const evictedBandTextures: CanvasTexture[] = []

function getBandTexture(anchorX: number, anchorZ: number): CanvasTexture {
  const key = `${anchorX}:${anchorZ}`
  if (cachedBand != null && cachedBand.key === key) return cachedBand.texture

  if (cachedBand != null) evictedBandTextures.push(cachedBand.texture)
  cachedBand = { key, texture: buildBandTexture(anchorX, anchorZ) }
  return cachedBand.texture
}

function disposeEvictedBandTextures(): void {
  for (const texture of evictedBandTextures) texture.dispose()
  evictedBandTextures.length = 0
}

/** 코어 글로우 — 밝은 난색 심 + 옅은 외곽 헤이즈의 라디얼 스머지 (앱 수명 캐시). */
let cachedCoreTexture: CanvasTexture | null = null

function getCoreGlowTexture(): CanvasTexture {
  if (cachedCoreTexture != null) return cachedCoreTexture

  const canvas = document.createElement('canvas')
  canvas.width = CORE_TEXTURE_SIZE
  canvas.height = CORE_TEXTURE_SIZE
  const context = canvas.getContext('2d')
  if (context == null) throw new Error('코어 글로우 텍스처용 2D 컨텍스트를 만들 수 없습니다')

  // 에너지를 심에 모은다 — 외곽이 살아 있으면 가장자리 림이 보여 "원반"으로 읽힌다
  const center = CORE_TEXTURE_SIZE / 2
  const gradient = context.createRadialGradient(center, center, 0, center, center, center)
  gradient.addColorStop(0, 'rgba(255, 242, 220, 0.9)')
  gradient.addColorStop(0.15, 'rgba(255, 218, 168, 0.4)')
  gradient.addColorStop(0.4, 'rgba(255, 196, 136, 0.1)')
  gradient.addColorStop(0.75, 'rgba(255, 185, 125, 0.02)')
  gradient.addColorStop(1, 'rgba(255, 180, 120, 0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, CORE_TEXTURE_SIZE, CORE_TEXTURE_SIZE)

  cachedCoreTexture = new CanvasTexture(canvas)
  cachedCoreTexture.colorSpace = 'srgb'
  return cachedCoreTexture
}

interface ShipViewGalaxyGlowProps {
  /** 정박 별 월드 좌표 — 밴드 적분의 시점이자 실린더 중심. */
  readonly anchor: readonly [number, number, number]
}

export function ShipViewGalaxyGlow({ anchor }: ShipViewGalaxyGlowProps) {
  const coreGroupRef = useRef<Group>(null)

  const bandTexture = useMemo(() => getBandTexture(anchor[0], anchor[2]), [anchor])
  const bandMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        map: bandTexture,
        transparent: true,
        opacity: BAND_OPACITY,
        blending: AdditiveBlending,
        depthWrite: false,
        side: BackSide,
      }),
    [bandTexture],
  )
  const coreMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        map: getCoreGlowTexture(),
        transparent: true,
        opacity: CORE_OPACITY,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  )

  useEffect(() => () => bandMaterial.dispose(), [bandMaterial])
  useEffect(() => () => coreMaterial.dispose(), [coreMaterial])
  // 캐시에서 밀려난 이전 정박의 텍스처를 커밋 후 폐기 — 새 텍스처가 화면에 붙은 뒤라 안전
  useEffect(() => disposeEvictedBandTextures(), [bandTexture])

  // 코어 빌보드 — 카메라 응시 + 각크기 클램프 + 근접 페이드 (연속 값은 ref, 철칙 6)
  useFrame((state) => {
    const group = coreGroupRef.current
    if (group == null) return

    group.quaternion.copy(state.camera.quaternion)
    const coreDistance = state.camera.position.length() // 은하 중심 = 월드 원점
    group.scale.setScalar(Math.min(CORE_BASE_SIZE, coreDistance * CORE_MAX_ANGULAR_RATIO))
    coreMaterial.opacity =
      CORE_OPACITY * smoothstep(CORE_FADE_NEAR, CORE_FADE_FAR, coreDistance)
  })

  return (
    <>
      {/* 원반 밴드 — 실린더 중심은 정박 별의 평면 좌표, 수직 중심은 원반면(y=0) */}
      <mesh position={[anchor[0], 0, anchor[2]]} material={bandMaterial}>
        <cylinderGeometry
          args={[
            BAND_RADIUS,
            BAND_RADIUS,
            BAND_HEIGHT,
            BAND_RADIAL_SEGMENTS,
            BAND_HEIGHT_SEGMENTS,
            BAND_OPEN_ENDED,
          ]}
        />
      </mesh>
      <group ref={coreGroupRef}>
        <mesh material={coreMaterial}>
          <planeGeometry args={[1, 1]} />
        </mesh>
      </group>
    </>
  )
}
