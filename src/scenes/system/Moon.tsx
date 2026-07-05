import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Group } from 'three'

import type { Moon as MoonData } from '@/engine'
import { simClock } from '@/scenes/system/simClock'

const FULL_TURN = Math.PI * 2
/** orbitRadius=1 기준 각속도 (rad/s) — 케플러 근사로 안쪽 위성이 빠르다. */
const BASE_MOON_ANGULAR_SPEED = 1.5

/**
 * 위성 궤도 반경 = 행성 시각반경 × (MIN + orbitFactor × SPAN × spanScale).
 * MIN(2.2)은 본체·고리(고리 바깥 2.3R는 orbitFactor>0에서 확보)를 벗어나는 하한.
 * spanScale(≤1)은 외곽 스프레드만 압축해 위성이 이웃 행성 궤도를 침범하지 않게 한다
 * (Planet이 이웃 궤도 간격으로 산출). MIN은 압축 대상이 아니라 고리 클리어가 유지된다.
 */
const MOON_ORBIT_MIN_FACTOR = 2.2
const MOON_ORBIT_SPAN_FACTOR = 2.0

export function moonOrbitRadius(
  planetVisualRadius: number,
  orbitFactor: number,
  spanScale = 1,
): number {
  return (
    planetVisualRadius * (MOON_ORBIT_MIN_FACTOR + orbitFactor * MOON_ORBIT_SPAN_FACTOR * spanScale)
  )
}

/**
 * 위성 최외곽 도달 반경을 이웃 궤도 상한(limit) 이하로 맞추는 spanScale — MIN 성분은 보존하고
 * SPAN만 줄인다. maxReach가 limit 이하면 1(압축 없음). limit이 MIN 링보다도 작으면 0(위성이
 * MIN 링에 몰림 — 극단적으로 좁은 궤도 간격의 최선 처리).
 */
export function moonSpanScaleFor(
  planetVisualRadius: number,
  maxOrbitFactor: number,
  limit: number | null,
): number {
  if (limit == null || maxOrbitFactor <= 0) return 1
  if (moonOrbitRadius(planetVisualRadius, maxOrbitFactor, 1) <= limit) return 1
  const span = MOON_ORBIT_SPAN_FACTOR * maxOrbitFactor
  const scale = (limit / planetVisualRadius - MOON_ORBIT_MIN_FACTOR) / span
  return Math.min(1, Math.max(0, scale))
}

interface MoonProps {
  readonly moon: MoonData
  readonly planetVisualRadius: number
  /** 외곽 궤도 스프레드 압축 계수 (1=원본, <1=이웃 궤도 침범 방지로 축소). */
  readonly orbitSpanScale?: number
}

/**
 * 행성 그룹 자식으로 마운트되는 위성 — 위치를 useFrame에서 직접 계산하며
 * 상태로 저장하지 않는다 (R3F 성능 규율, 결정 41-c).
 * 텍스처 베이킹 없이 단색 구체로 렌더 — 크기가 작아 퀄리티 차이 없음.
 */
export function Moon({ moon, planetVisualRadius, orbitSpanScale = 1 }: MoonProps) {
  const groupRef = useRef<Group>(null)

  const orbitRadius = moonOrbitRadius(planetVisualRadius, moon.orbitFactor, orbitSpanScale)
  // 위성 반경 = 행성 시각반경 × (0.06~0.19). 상한(≈0.19)은 유지해 가스 거성 위성이 이웃 암석
  // 행성만큼 커지는 것을 막고, 하한(0.06)을 낮춰 포보스 같은 작은 위성이 실제처럼 작게 보이도록
  // 대비를 넓혔다 (paletteSeed %100 = 상대 크기, sol.ts 인코딩).
  const moonRadius = planetVisualRadius * (0.06 + (moon.paletteSeed % 100) / 750)
  const initialAngle = moon.phaseFactor * FULL_TURN
  const angularSpeed = BASE_MOON_ANGULAR_SPEED / Math.sqrt(orbitRadius)

  const hue = moon.paletteSeed % 360
  const lightness = 48 + (moon.paletteSeed % 18)
  const moonColor = `hsl(${hue}, 6%, ${lightness}%)`

  useFrame(() => {
    const group = groupRef.current
    if (group == null) return
    // 배속 시계 — 위성 공전도 배속에 반응한다 (simulation-speed).
    const angle = initialAngle + simClock.now * angularSpeed
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
