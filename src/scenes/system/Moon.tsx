import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Group } from 'three'

import type { Moon as MoonData } from '@/engine'

const FULL_TURN = Math.PI * 2
/** orbitRadius=1 기준 각속도 (rad/s) — 케플러 근사로 안쪽 위성이 빠르다. */
const BASE_MOON_ANGULAR_SPEED = 1.5

interface MoonProps {
  readonly moon: MoonData
  readonly planetVisualRadius: number
}

/**
 * 행성 그룹 자식으로 마운트되는 위성 — 위치를 useFrame에서 직접 계산하며
 * 상태로 저장하지 않는다 (R3F 성능 규율, 결정 41-c).
 * 텍스처 베이킹 없이 단색 구체로 렌더 — 크기가 작아 퀄리티 차이 없음.
 */
export function Moon({ moon, planetVisualRadius }: MoonProps) {
  const groupRef = useRef<Group>(null)

  const orbitRadius = planetVisualRadius * (2.2 + moon.orbitFactor * 2.0)
  const moonRadius = planetVisualRadius * (0.10 + (moon.paletteSeed % 100) / 1000)
  const initialAngle = moon.phaseFactor * FULL_TURN
  const angularSpeed = BASE_MOON_ANGULAR_SPEED / Math.sqrt(orbitRadius)

  const hue = moon.paletteSeed % 360
  const lightness = 48 + (moon.paletteSeed % 18)
  const moonColor = `hsl(${hue}, 6%, ${lightness}%)`

  useFrame((state) => {
    const group = groupRef.current
    if (group == null) return
    const angle = initialAngle + state.clock.elapsedTime * angularSpeed
    group.position.set(Math.cos(angle) * orbitRadius, 0, Math.sin(angle) * orbitRadius)
  })

  return (
    <group ref={groupRef}>
      <mesh>
        <sphereGeometry args={[moonRadius, 8, 8]} />
        <meshStandardMaterial color={moonColor} roughness={0.95} metalness={0.02} />
      </mesh>
    </group>
  )
}
