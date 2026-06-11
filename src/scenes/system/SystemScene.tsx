import { useMemo } from 'react'

import { planetsOf, starById } from '@/engine'
import { SPECTRAL_RENDER } from '@/scenes/galaxy/spectral'
import { CameraRig } from '@/scenes/shared/CameraRig'
import { DecorativeStarfield } from '@/scenes/shared/DecorativeStarfield'
import { OrbitRing } from '@/scenes/system/OrbitRing'
import { orbitRadiusOf, Planet } from '@/scenes/system/Planet'
import { PlanetCalloutProjector } from '@/scenes/system/PlanetCalloutProjector'
import { StarSurface } from '@/scenes/system/StarSurface'
import { SystemBackdropStars } from '@/scenes/system/SystemBackdropStars'
import { SystemEntryTransition } from '@/scenes/system/SystemEntryTransition'
import { useGameStore } from '@/store'

/** 태양계 씬은 항상 자기 원점(0,0,0)에 항성을 둔다 — 플로팅 오리진 (결정 15). */
const SYSTEM_ORIGIN: readonly [number, number, number] = [0, 0, 0]
/** 항성 시각 반경 — 행성 시각 반경 상한(~2.5)의 2배 이상이어야 위계가 선다. */
const STAR_VISUAL_RADIUS = 5
/** 카메라 줌 한계 — 진입 트랜지션의 안착 거리로도 쓰인다. */
const CAMERA_MIN_DISTANCE = 10
const CAMERA_MAX_DISTANCE = 180
/** 장식 별밭 천구 반경 — 실이웃 별 셸(4,000) 바깥 (가산이라 순서 무관, far 안). */
const STARFIELD_RADIUS = 4_100

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
      <CameraRig
        focus={SYSTEM_ORIGIN}
        minDistance={CAMERA_MIN_DISTANCE}
        maxDistance={CAMERA_MAX_DISTANCE}
      />
      <SystemEntryTransition restDistance={CAMERA_MAX_DISTANCE} />
      <DecorativeStarfield radius={STARFIELD_RADIUS} />
      <SystemBackdropStars seed={seed} starId={starId} />
      {/* 주변광은 밤면 가독성 담당 — 물리 광원 모드는 알베도/π 페널티가 있어 1 이상이어야
          카메라 쪽 위상(밤면)의 행성이 시커멓게 묻히지 않는다 */}
      <ambientLight intensity={1.2} />
      <pointLight position={[0, 0, 0]} intensity={1_200} decay={1.6} color={starColor} />

      <StarSurface radius={STAR_VISUAL_RADIUS} color={starColor} />

      {planets.map((planet) => (
        <group key={planet.id}>
          <OrbitRing radius={orbitRadiusOf(planet)} />
          <Planet planet={planet} />
        </group>
      ))}

      <PlanetCalloutProjector />
    </>
  )
}
