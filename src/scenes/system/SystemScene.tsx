import { useMemo } from 'react'

import { planetsOf, starById } from '@/engine'
import { SPECTRAL_RENDER } from '@/scenes/galaxy/spectral'
import { CameraRig } from '@/scenes/shared/CameraRig'
import { OrbitRing } from '@/scenes/system/OrbitRing'
import { orbitRadiusOf, Planet } from '@/scenes/system/Planet'
import { useGameStore } from '@/store'

/** 태양계 씬은 항상 자기 원점(0,0,0)에 항성을 둔다 — 플로팅 오리진 (결정 15). */
const SYSTEM_ORIGIN: readonly [number, number, number] = [0, 0, 0]
const STAR_VISUAL_RADIUS = 3

export function SystemScene() {
  const seed = useGameStore((state) => state.seed)
  const scene = useGameStore((state) => state.scene)
  const currentStarId = useGameStore((state) => state.currentStarId)

  const starId = scene.kind === 'system' ? scene.starId : currentStarId
  const star = useMemo(() => starById(seed, starId), [seed, starId])
  const planets = useMemo(() => planetsOf(seed, starId), [seed, starId])
  const starColor = star == null ? '#ffffff' : SPECTRAL_RENDER[star.spectral].color

  return (
    <>
      <color attach="background" args={['#05060f']} />
      <CameraRig focus={SYSTEM_ORIGIN} minDistance={10} maxDistance={180} />
      <ambientLight intensity={0.25} />
      <pointLight position={[0, 0, 0]} intensity={1_200} decay={1.6} color={starColor} />

      <mesh>
        <sphereGeometry args={[STAR_VISUAL_RADIUS, 48, 48]} />
        <meshBasicMaterial color={starColor} />
      </mesh>

      {planets.map((planet) => (
        <group key={planet.id}>
          <OrbitRing radius={orbitRadiusOf(planet)} />
          <Planet planet={planet} />
        </group>
      ))}
    </>
  )
}
