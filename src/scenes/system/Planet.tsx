import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Group } from 'three'

import type { Planet as PlanetData } from '@/engine'
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

export function orbitRadiusOf(planet: PlanetData): number {
  return ORBIT_BASE_RADIUS + planet.orbitAu * ORBIT_SCALE
}

/** paletteSeed → 시각 색상 (게임플레이 무관 — 시각 연출 전용). */
function planetColor(planet: PlanetData): string {
  const hue = planet.paletteSeed % 360
  return planet.kind === 'rocky' ? `hsl(${hue}, 32%, 52%)` : `hsl(${hue}, 58%, 62%)`
}

interface PlanetProps {
  readonly planet: PlanetData
}

/**
 * 공전하는 행성 — 위치는 시간 t에서 계산하며 상태로 저장하지 않는다 (R3F 성능 규율).
 * 클릭하면 행성 패널이 열린다.
 */
export function Planet({ planet }: PlanetProps) {
  const groupRef = useRef<Group>(null)
  const selectPlanet = useGameStore((state) => state.selectPlanet)
  const isSelected = useGameStore((state) => state.selectedPlanetId === planet.id)

  const orbitRadius = orbitRadiusOf(planet)
  const initialPhase = ((planet.paletteSeed % 360) / 360) * FULL_TURN
  const angularSpeed = BASE_ANGULAR_SPEED / Math.pow(planet.orbitAu, 1.5)
  const visualRadius = PLANET_VISUAL_BASE + planet.radius * PLANET_VISUAL_SCALE

  useFrame((state) => {
    const group = groupRef.current
    if (group == null) return
    const angle = initialPhase + state.clock.elapsedTime * angularSpeed
    group.position.set(Math.cos(angle) * orbitRadius, 0, Math.sin(angle) * orbitRadius)
  })

  return (
    <group ref={groupRef}>
      <mesh
        onClick={(event) => {
          event.stopPropagation()
          selectPlanet(planet.id)
        }}
      >
        <sphereGeometry args={[visualRadius, 32, 32]} />
        <meshStandardMaterial
          color={planetColor(planet)}
          roughness={planet.kind === 'rocky' ? 0.92 : 0.45}
          metalness={0.05}
        />
      </mesh>

      {planet.hasLife ? (
        <mesh>
          <sphereGeometry args={[visualRadius * 1.18, 24, 24]} />
          <meshBasicMaterial color="#57ffb0" transparent opacity={0.14} depthWrite={false} />
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
