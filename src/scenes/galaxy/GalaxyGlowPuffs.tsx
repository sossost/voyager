import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, type Group, MeshBasicMaterial, type Vector3 } from 'three'

import { armRidgeAt, SECTOR_SIZE, sectorDensity } from '@/engine'
import { getSpriteTextures } from '@/scenes/galaxy/NebulaClusters'

/**
 * 은하광 부피 퍼프 (galaxy-realism-pass) — 조망뷰 은하광을 평면 텍스처(GalaxyNebula)
 * 위에 얹는 3D 겹침 빌보드들로 입체화한다 (사용자 방향: 성운처럼 광원도 입체감).
 * 밀도 기각 샘플링으로 원반 부피 안에 배치 — 벌지는 두껍고 난색, 팔은 얇고 은백.
 * 불규칙 스프라이트(NebulaClusters와 공유)라 원형 광원으로 읽히지 않는다.
 * 해시 결정론 — 시드 무관, 렌더 전용.
 */

const PUFF_COUNT = 130
const PUFF_TRIALS = 6_000
const RADIUS_MAX_SECTORS = 46

/** 수직 산포 — v12 두께 프로파일 근사 (원반 1.5섹터 상수 + 벌지 볼록). */
const DISK_HALF_SECTORS = 1.5
const BULGE_HALF_SECTORS = 5
const BULGE_RADIUS_SECTORS = 6

/** 벌지(난색) ↔ 팔(은백) — GalaxyNebula와 같은 색 언어. */
const BULGE_RGB: readonly [number, number, number] = [255, 208, 150]
const ARM_RGB: readonly [number, number, number] = [185, 200, 232]
const COLOR_BLEND_RADIUS_SECTORS = 10

const SIZE_MIN = 180
const SIZE_SPAN = 320
/** 벌지 퍼프는 더 크고 진하게 — 중심 광량이 실제로 지배적이다. */
const BULGE_SIZE_BOOST = 1.8
const OPACITY_MIN = 0.03
const OPACITY_SPAN = 0.05
const BULGE_OPACITY_BOOST = 1.7

/** 줌아웃 조망에서만 떠오른다 — GalaxyNebula와 같은 거리 창. */
const FADE_NEAR_DISTANCE = 2_000
const FADE_FAR_DISTANCE = 4_500

function hash01(n: number): number {
  const value = Math.sin(n) * 43758.5453
  return value - Math.floor(value)
}

function gaussianish(seed: number): number {
  return (hash01(seed) + hash01(seed + 0.37) + hash01(seed + 0.71) + hash01(seed + 1.13) - 2) / 2
}

function clamp01(value: number): number {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

interface GlowPuff {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly spin: number
  readonly width: number
  readonly height: number
  readonly variant: number
  readonly color: string
  readonly opacity: number
}

function samplePuffs(): readonly GlowPuff[] {
  const puffs: GlowPuff[] = []
  for (let trial = 0; trial < PUFF_TRIALS && puffs.length < PUFF_COUNT; trial++) {
    const seed = trial * 13 + 5
    // 면적 균일(√) 반경 샘플 — 밀도 기각으로 벌지·팔에 자연 집중된다
    const radius = Math.sqrt(hash01(seed)) * RADIUS_MAX_SECTORS
    const azimuth = hash01(seed + 1) * Math.PI * 2
    const sx = Math.cos(azimuth) * radius
    const sz = Math.sin(azimuth) * radius
    const density = sectorDensity({ sx, sy: 0, sz })
    if (density < 0.12 + 0.5 * hash01(seed + 2)) continue

    const bulgeWeight = clamp01(1 - radius / BULGE_RADIUS_SECTORS)
    const halfThickness = Math.max(DISK_HALF_SECTORS, BULGE_HALF_SECTORS * bulgeWeight)
    const warmth = clamp01(1 - radius / COLOR_BLEND_RADIUS_SECTORS)
    const red = Math.round(ARM_RGB[0] + (BULGE_RGB[0] - ARM_RGB[0]) * warmth)
    const green = Math.round(ARM_RGB[1] + (BULGE_RGB[1] - ARM_RGB[1]) * warmth)
    const blue = Math.round(ARM_RGB[2] + (BULGE_RGB[2] - ARM_RGB[2]) * warmth)

    const sizeBoost = 1 + (BULGE_SIZE_BOOST - 1) * bulgeWeight
    const width = (SIZE_MIN + SIZE_SPAN * hash01(seed + 5)) * sizeBoost
    const armBoost = 0.6 + 0.4 * armRidgeAt(sx, sz)
    puffs.push({
      x: sx * SECTOR_SIZE,
      y: gaussianish(seed + 3) * halfThickness * SECTOR_SIZE * 0.55,
      z: sz * SECTOR_SIZE,
      spin: hash01(seed + 4) * Math.PI * 2,
      width,
      height: width * (0.5 + 0.3 * hash01(seed + 6)),
      variant: Math.floor(hash01(seed + 8) * 4) % 4,
      color: `rgb(${red}, ${green}, ${blue})`,
      opacity:
        (OPACITY_MIN + OPACITY_SPAN * hash01(seed + 9)) *
        (1 + (BULGE_OPACITY_BOOST - 1) * bulgeWeight) *
        armBoost,
    })
  }
  return puffs
}

export function GalaxyGlowPuffs() {
  const groupRefs = useRef<(Group | null)[]>([])
  const puffs = useMemo(() => samplePuffs(), [])
  const textures = getSpriteTextures()

  const materials = useMemo(
    () =>
      puffs.map(
        (puff) =>
          new MeshBasicMaterial({
            map: textures[puff.variant],
            color: puff.color,
            transparent: true,
            opacity: 0,
            blending: AdditiveBlending,
            depthWrite: false,
          }),
      ),
    [puffs, textures],
  )

  useEffect(
    () => () => {
      for (const material of materials) material.dispose()
    },
    [materials],
  )

  useFrame((state) => {
    // 줌아웃 페이드 — 근접 항행 중에는 걷힌다 (GalaxyNebula와 동일 문법)
    const controls = state.controls as { target?: Vector3 } | null
    const focus = controls?.target
    const zoomDistance =
      focus == null ? FADE_FAR_DISTANCE : state.camera.position.distanceTo(focus)
    const t = clamp01((zoomDistance - FADE_NEAR_DISTANCE) / (FADE_FAR_DISTANCE - FADE_NEAR_DISTANCE))
    const zoomFade = t * t * (3 - 2 * t)

    groupRefs.current.forEach((group, index) => {
      if (group == null) return
      group.quaternion.copy(state.camera.quaternion)
      const puff = puffs[index]
      const material = materials[index]
      if (puff == null || material == null) return
      material.opacity = puff.opacity * zoomFade
      group.visible = material.opacity > 0.002
    })
  })

  return (
    <>
      {puffs.map((puff, index) => (
        <group
          key={index}
          position={[puff.x, puff.y, puff.z]}
          ref={(node) => {
            groupRefs.current[index] = node
          }}
        >
          <mesh material={materials[index]} rotation={[0, 0, puff.spin]} scale={[puff.width, puff.height, 1]}>
            <planeGeometry args={[1, 1]} />
          </mesh>
        </group>
      ))}
    </>
  )
}
