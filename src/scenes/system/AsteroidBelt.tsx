import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useRef } from 'react'
import { type InstancedMesh, Object3D } from 'three'

import type { Belt, BeltKind } from '@/engine'
import { QUALITY_PRESETS } from '@/quality/presets'
import { auToOrbitRadius, IDENTITY_ORBIT_DISPLAY, type OrbitDisplay } from '@/scenes/system/Planet'
import { simClock } from '@/scenes/system/simClock'
import { useGameStore } from '@/store'

/**
 * 소행성대 — 궤도 갭(암석대)·최외곽 행성 바깥(카이퍼대)을 도는 인스턴스 암석 원반.
 *
 * 엔진 beltsOf가 정한 궤도 경계(innerAu·outerAu)를 행성과 같은 auToOrbitRadius로 매핑하고,
 * densitySeed로 시드한 결정론 PRNG로 각 암석을 환형(annulus)에 산란한다. 수백~천여 개를
 * InstancedMesh 단일 드로우콜로 그린다(R3F 성능 규율). 공전은 강체 회전 근사 — 연속값이라
 * store 없이 ref+useFrame만 쓴다 (철칙 6). 순수 렌더 파생물이라 GEN_VERSION·저장과 무관.
 *
 * 고증: 실제 원반은 매우 성기다. 카이퍼대는 인스턴스를 줄이되(countFactor) 크고 밝게(rockScale·
 * emissive) 그려, 밀도를 부풀리지 않으면서도 존재감을 확보한다 (fidelity-over-legibility).
 */

interface BeltRenderParams {
  readonly color: string
  readonly emissive: string
  readonly roughness: number
  /** 반경 폭 대비 수직 반두께 비율 — 원반의 얇음. 카이퍼대가 약간 더 두껍다. */
  readonly thicknessFactor: number
  /** 개별 암석 기준 크기 (렌더 유닛). */
  readonly rockScale: number
  /** 티어 인스턴스 예산 대비 사용 비율 — 카이퍼대는 성기게. */
  readonly countFactor: number
  /** 강체 공전 각속도 (rad/s) — 안쪽 암석대가 더 빠르다 (케플러 근사). */
  readonly angularSpeed: number
}

const BELT_RENDER: Readonly<Record<BeltKind, BeltRenderParams>> = {
  rocky: {
    color: '#9a8b74',
    emissive: '#2c2318',
    roughness: 0.95,
    thicknessFactor: 0.05,
    rockScale: 0.05,
    countFactor: 1,
    angularSpeed: 0.03,
  },
  kuiper: {
    color: '#c2d2de',
    emissive: '#2a3a45',
    roughness: 0.8,
    thicknessFactor: 0.11,
    rockScale: 0.085,
    countFactor: 0.55,
    angularSpeed: 0.012,
  },
}

/** 개별 암석 크기 변주 배수 [MIN, MIN+SPAN). */
const ROCK_SCALE_MIN = 0.4
const ROCK_SCALE_SPAN = 1.2
/** 성긴 인스턴스가 읽히도록 하는 발광 강도 — 밝게, 그러나 자체발광 오브젝트로 보이지 않게. */
const BELT_EMISSIVE_INTENSITY = 0.25

/**
 * mulberry32 — 렌더 산란 전용 결정론 PRNG. 엔진 rngFor(브랜드 Seed·네임스페이스 필요)와 별개로
 * 숫자 densitySeed 하나로 국소 산란만 재현하면 되므로 렌더 계층에 가볍게 둔다(엔진 순수성 무관).
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface AsteroidBeltProps {
  readonly belt: Belt
  /** 다중성계에서 별 군집을 벗어나도록 궤도를 바깥으로 미는 양 (행성과 공유, 기본 0). */
  readonly orbitOffset?: number
  /** 궤도 표시 정규화 (O-1·N-3) — 행성과 같은 변환을 써야 벨트가 궤도 사이에 남는다. */
  readonly orbitDisplay?: OrbitDisplay
}

export function AsteroidBelt({
  belt,
  orbitOffset = 0,
  orbitDisplay = IDENTITY_ORBIT_DISPLAY,
}: AsteroidBeltProps) {
  const meshRef = useRef<InstancedMesh>(null)
  const qualityTier = useGameStore((state) => state.qualityTier)
  const params = BELT_RENDER[belt.kind]

  const innerRadius = auToOrbitRadius(belt.innerAu, orbitOffset, orbitDisplay)
  const outerRadius = auToOrbitRadius(belt.outerAu, orbitOffset, orbitDisplay)
  const count = Math.round(QUALITY_PRESETS[qualityTier].asteroidBeltCount * params.countFactor)

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (mesh == null) return

    const rand = mulberry32(belt.densitySeed)
    const dummy = new Object3D()
    const halfThickness = (outerRadius - innerRadius) * params.thicknessFactor
    // 면적 균등 산란 — 반경을 √(균등)로 뽑아 안쪽에 몰리지 않게 한다.
    const innerSq = innerRadius * innerRadius
    const outerSq = outerRadius * outerRadius

    for (let i = 0; i < count; i++) {
      const angle = rand() * Math.PI * 2
      const radius = Math.sqrt(innerSq + rand() * (outerSq - innerSq))
      dummy.position.set(
        Math.cos(angle) * radius,
        (rand() - 0.5) * 2 * halfThickness,
        Math.sin(angle) * radius,
      )
      dummy.rotation.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI)
      dummy.scale.setScalar(params.rockScale * (ROCK_SCALE_MIN + rand() * ROCK_SCALE_SPAN))
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [belt.densitySeed, innerRadius, outerRadius, count, params])

  useFrame(() => {
    const mesh = meshRef.current
    if (mesh == null) return
    // 배속 시계 기준 절대 회전 — delta 누적 대신 simClock.now에 각속도를 곱해 배속·일시정지가
    // 그대로 반영되게 한다 (simulation-speed). 행성과 같은 공전 방향: planetOrbitPosition은 위치를
    // (cosθ, sinθ)·θ증가로 +z쪽으로 돌리는데, +Y축 회전은 우수좌표계에서 −z쪽(반대)이라 부호를 뒤집는다.
    mesh.rotation.y = -params.angularSpeed * simClock.now
  })

  return (
    <instancedMesh key={count} ref={meshRef} args={[undefined, undefined, count]}>
      <icosahedronGeometry args={[1, 0]} />
      <meshStandardMaterial
        color={params.color}
        emissive={params.emissive}
        emissiveIntensity={BELT_EMISSIVE_INTENSITY}
        roughness={params.roughness}
        metalness={0.15}
        flatShading
      />
    </instancedMesh>
  )
}
