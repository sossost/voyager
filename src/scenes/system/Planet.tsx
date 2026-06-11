import { useFrame } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import type { Group, Mesh } from 'three'

import type { Planet as PlanetData } from '@/engine'
import { QUALITY_PRESETS } from '@/quality/presets'
import { fract } from '@/scenes/shared/fract'
import { enqueueBake } from '@/scenes/system/bakeQueue'
import {
  bakePlanetTextures,
  disposePlanetTextures,
  type PlanetTextureSet,
} from '@/scenes/system/planetTexture'
import { useGameStore } from '@/store'

export const ORBIT_BASE_RADIUS = 10
export const ORBIT_SCALE = 16
/**
 * 행성 시각 반경 = BASE + 엔진 radius × SCALE (압축 매핑).
 * 엔진 radius(0.4~5.0)를 그대로 쓰면 큰 행성(4.5)이 항성(5)에 육박하는 모순이
 * 생기므로 0.6~2.5로 압축한다 — 항성이 항상 2배 이상 크다. 렌더 전용, 엔진 불변.
 */
const PLANET_VISUAL_BASE = 0.45
const PLANET_VISUAL_SCALE = 0.4
/** orbitAu=1 행성의 공전 각속도 (rad/s) — 케플러 근사로 바깥쪽일수록 느려진다. */
const BASE_ANGULAR_SPEED = 0.22
const FULL_TURN = Math.PI * 2

/** 자전 속도 (rad/s) — paletteSeed 파생 변주, 방향도 시드 따라 갈린다. */
const SPIN_BASE_SPEED = 0.05
const SPIN_SPEED_SPAN = 0.09
/** 구름층은 표면보다 약간 빨리 돌아 살아있는 느낌을 만든다. */
const CLOUD_SPIN_FACTOR = 1.55
const CLOUD_LAYER_SCALE = 1.035

export function orbitRadiusOf(planet: PlanetData): number {
  return ORBIT_BASE_RADIUS + planet.orbitAu * ORBIT_SCALE
}

/** 베이크가 도착하기 전의 플레이스홀더 색 — paletteSeed 파생 (텍스처로 교체된다). */
function placeholderColor(planet: PlanetData): string {
  const hue = planet.paletteSeed % 360
  return planet.kind === 'rocky' ? `hsl(${hue}, 32%, 52%)` : `hsl(${hue}, 58%, 62%)`
}

interface PlanetProps {
  readonly planet: PlanetData
}

/**
 * 공전하는 행성 — 위치는 시간 t에서 계산하며 상태로 저장하지 않는다 (R3F 성능 규율).
 * 표면은 paletteSeed 결정론 베이크 텍스처(결정 29·33) — 베이크는 프레임 분산 큐로
 * 비동기 수행되어 진입 히치가 없고, 도착 전에는 플레이스홀더 단색을 쓴다.
 * 조명은 항성 포인트라이트가 만드는 낮/밤 경계를 그대로 쓴다. 클릭하면 행성 패널이 열린다.
 */
export function Planet({ planet }: PlanetProps) {
  const groupRef = useRef<Group>(null)
  const surfaceRef = useRef<Mesh>(null)
  const cloudsRef = useRef<Mesh>(null)
  const selectPlanet = useGameStore((state) => state.selectPlanet)
  const isSelected = useGameStore((state) => state.selectedPlanetId === planet.id)
  const qualityTier = useGameStore((state) => state.qualityTier)
  const { planetSegments: segments, planetTextureBaseWidth } = QUALITY_PRESETS[qualityTier]

  const [textures, setTextures] = useState<PlanetTextureSet | null>(null)

  useEffect(() => {
    let bakedSet: PlanetTextureSet | null = null
    const cancelBake = enqueueBake(() => {
      bakedSet = bakePlanetTextures(planet, planetTextureBaseWidth)
      setTextures(bakedSet)
    })
    return () => {
      cancelBake()
      if (bakedSet != null) disposePlanetTextures(bakedSet)
      setTextures(null)
    }
  }, [planet, planetTextureBaseWidth])

  const orbitRadius = orbitRadiusOf(planet)
  const initialPhase = ((planet.paletteSeed % 360) / 360) * FULL_TURN
  const angularSpeed = BASE_ANGULAR_SPEED / Math.pow(planet.orbitAu, 1.5)
  const visualRadius = PLANET_VISUAL_BASE + planet.radius * PLANET_VISUAL_SCALE
  const spinSpeed = SPIN_BASE_SPEED + SPIN_SPEED_SPAN * fract(planet.paletteSeed * 0.0173)
  const spinDirection = planet.paletteSeed % 2 === 0 ? 1 : -1

  useFrame((state) => {
    const group = groupRef.current
    if (group == null) return
    const elapsed = state.clock.elapsedTime
    const angle = initialPhase + elapsed * angularSpeed
    group.position.set(Math.cos(angle) * orbitRadius, 0, Math.sin(angle) * orbitRadius)

    const spin = initialPhase + elapsed * spinSpeed * spinDirection
    if (surfaceRef.current != null) surfaceRef.current.rotation.y = spin
    if (cloudsRef.current != null) cloudsRef.current.rotation.y = spin * CLOUD_SPIN_FACTOR
  })

  return (
    <group ref={groupRef}>
      <mesh
        ref={surfaceRef}
        onClick={(event) => {
          event.stopPropagation()
          selectPlanet(planet.id)
        }}
      >
        <sphereGeometry args={[visualRadius, segments, segments]} />
        {/* key로 머티리얼 리마운트 강제 — 같은 위치 조건 분기는 인스턴스가 재사용되어
            제거된 color prop이 리셋(검정)되고 map 셰이더 재컴파일도 빠진다 */}
        {textures == null ? (
          <meshStandardMaterial
            key="placeholder"
            color={placeholderColor(planet)}
            roughness={planet.kind === 'rocky' ? 0.92 : 0.45}
            metalness={0.05}
          />
        ) : (
          <meshStandardMaterial
            key="baked"
            color="#ffffff"
            map={textures.surface}
            roughness={planet.kind === 'rocky' ? 0.92 : 0.45}
            metalness={0.05}
          />
        )}
      </mesh>

      {textures?.clouds != null ? (
        <mesh ref={cloudsRef}>
          <sphereGeometry args={[visualRadius * CLOUD_LAYER_SCALE, segments, segments]} />
          <meshStandardMaterial
            map={textures.clouds}
            transparent
            depthWrite={false}
            roughness={1}
            metalness={0}
          />
        </mesh>
      ) : null}

      {isSelected ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[visualRadius * 1.5, visualRadius * 1.7, 48]} />
          <meshBasicMaterial color="#7c5cff" transparent opacity={0.95} depthWrite={false} />
        </mesh>
      ) : null}
    </group>
  )
}
