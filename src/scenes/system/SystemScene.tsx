import { useMemo } from 'react'

import { planetsOf, starById, starWorldPosition } from '@/engine'
import { SPECTRAL_RENDER } from '@/scenes/galaxy/spectral'
import { CameraRig } from '@/scenes/shared/CameraRig'
import { DistantGalaxies } from '@/scenes/shared/DistantGalaxies'
import { OrbitRing } from '@/scenes/system/OrbitRing'
import { orbitRadiusOf, Planet } from '@/scenes/system/Planet'
import { SystemBackdropStars } from '@/scenes/system/SystemBackdropStars'
import { SystemEntryTransition } from '@/scenes/system/SystemEntryTransition'
import { SystemStarfield } from '@/scenes/system/SystemStarfield'
import { useGameStore } from '@/store'

/** 태양계 씬은 항상 자기 원점(0,0,0)에 항성을 둔다 — 플로팅 오리진 (결정 15). */
const SYSTEM_ORIGIN: readonly [number, number, number] = [0, 0, 0]
/** 항성 시각 반경 — 행성 시각 반경 상한(~2.5)의 2배 이상이어야 위계가 선다. */
const STAR_VISUAL_RADIUS = 5
/** 카메라 줌 한계 — 진입 트랜지션의 안착 거리로도 쓰인다. */
const CAMERA_MIN_DISTANCE = 10
const CAMERA_MAX_DISTANCE = 180

export function SystemScene() {
  const seed = useGameStore((state) => state.seed)
  const scene = useGameStore((state) => state.scene)
  const currentStarId = useGameStore((state) => state.currentStarId)

  const starId = scene.kind === 'system' ? scene.starId : currentStarId
  const star = useMemo(() => starById(seed, starId), [seed, starId])
  const planets = useMemo(() => planetsOf(seed, starId), [seed, starId])
  const starColor = star == null ? '#ffffff' : SPECTRAL_RENDER[star.spectral].color

  // 배경 은하는 은하 중심 기준 좌표 — 플로팅 오리진(현재 별 = 0,0,0)을 역오프셋해야
  // 은하 씬과 같은 하늘 방향에 떠 있다 (SystemBackdropStars와 같은 기준계, 결정 24)
  const galaxyAnchor = useMemo<readonly [number, number, number]>(() => {
    const origin = starWorldPosition(seed, starId)
    return origin == null ? [0, 0, 0] : [-origin[0], -origin[1], -origin[2]]
  }, [seed, starId])

  return (
    <>
      <color attach="background" args={['#05060f']} />
      <CameraRig
        focus={SYSTEM_ORIGIN}
        minDistance={CAMERA_MIN_DISTANCE}
        maxDistance={CAMERA_MAX_DISTANCE}
      />
      <SystemEntryTransition restDistance={CAMERA_MAX_DISTANCE} />
      <group position={galaxyAnchor}>
        <DistantGalaxies />
      </group>
      <SystemStarfield />
      <SystemBackdropStars seed={seed} starId={starId} />
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
