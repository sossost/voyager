import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import type { Group } from 'three'
import { Vector3 } from 'three'

import { planetsOf, starById } from '@/engine'
import { starWorldPosition } from '@/engine/galaxy/position'
import { SPECTRAL_RENDER } from '@/scenes/galaxy/spectral'
import { OrbitRing } from '@/scenes/system/OrbitRing'
import { orbitRadiusOf, Planet } from '@/scenes/system/Planet'
import { PlanetCalloutProjector } from '@/scenes/system/PlanetCalloutProjector'
import { StarSurface } from '@/scenes/system/StarSurface'
import { SYSTEM_LOD_DISTANCE } from '@/scenes/system/starCrossfade'
import { useGameStore } from '@/store'

/**
 * 현재 항성계 — 별 구체 + 행성을 현재 별의 은하 좌표에 직접 배치한다 (결정 41).
 *
 * 씬 스왑 없이 은하 씬 안에서 항성계를 보여주는 핵심: 모든 오브젝트를
 * `<group position={현재 별 월드 좌표}>`로 감싸면 내부 궤도 수식(planetOrbitPosition·
 * orbitRadiusOf)이 원점 상대(0,0,0 = 별)로 불변이라 SystemScene의 렌더 코드를 그대로
 * 쓴다. 콜아웃 투영기만 씬그래프 밖에서 절대 좌표를 계산하므로 자체적으로 별 오프셋을
 * 더한다 (PlanetCalloutProjector). 렌더 전용 — GEN_VERSION·저장 포맷 무관.
 */

/** 항성 시각 반경 — ORBIT_SCALE 축소(6)에 맞춰 3으로 조정, 코로나 글로우로 시각적으로 더 크게 보인다. */
const STAR_VISUAL_RADIUS = 3
// SYSTEM_LOD_DISTANCE는 starCrossfade.ts에서 임포트 — 궤도링 페이드와 같은 임계 공유 (백로그 H-3).
/** 항성 포인트라이트 — ORBIT_SCALE 축소(11→6)로 내행성이 가까워졌으므로 강도를 낮춘다. */
const STAR_LIGHT_INTENSITY = 500
const STAR_LIGHT_DECAY = 1.6
/** 주변광 — 밤면 가독성 (물리 광원 페널티 상쇄로 1 이상). */
const AMBIENT_INTENSITY = 1.2

export function CurrentSystem() {
  const seed = useGameStore((state) => state.seed)
  const starId = useGameStore((state) => state.currentStarId)
  const sceneKind = useGameStore((state) => state.scene.kind)
  // 행성·궤도링은 은하 뷰에서만 — 워프 중엔 텍스처 베이크 부담 없이 구체에 집중 (결정 41-c).
  const showPlanets = sceneKind === 'galaxy'
  // 워프 중엔 별 구체도 숨긴다 — 시작 시 구(FROM)→점 전환 팝 방지 + 도착 후 플래시가
  // 걷히며 crossfade로 자연스럽게 나타남. 포인트 스프라이트가 시각 연속성 담당 (백로그 H-2).
  const isWarping = sceneKind === 'warping'

  const systemGroupRef = useRef<Group>(null)
  const lodScratch = useMemo(() => new Vector3(), [])

  const star = useMemo(() => starById(seed, starId), [seed, starId])
  const planets = useMemo(() => planetsOf(seed, starId), [seed, starId])
  const worldPosition = useMemo(
    () => starWorldPosition(seed, starId) ?? ([0, 0, 0] as const),
    [seed, starId],
  )
  const starColor = star == null ? '#ffffff' : SPECTRAL_RENDER[star.spectral].color

  // LOD — 퍼스펙티브 줌아웃 시 구체는 이미 투명하지만 행성·궤도링이 계속 렌더됨.
  // 임계 거리 초과 시 그룹 전체를 비가시화해 불필요한 드로콜을 제거한다 (백로그 H-3).
  useFrame((state) => {
    const group = systemGroupRef.current
    if (group == null) return
    const dist = state.camera.position.distanceTo(
      lodScratch.set(worldPosition[0], worldPosition[1], worldPosition[2]),
    )
    group.visible = dist < SYSTEM_LOD_DISTANCE
  })

  return (
    <>
      <group
        ref={systemGroupRef}
        position={[worldPosition[0], worldPosition[1], worldPosition[2]]}
      >
        {/* 주변광은 밤면 가독성, 포인트라이트는 항성에서 나오는 낮/밤 경계. 둘 다 three에선
            전역 광원이지만(그룹 위치 무관), 현재 이 상태에서 표준 머티리얼은 행성뿐이라
            행성에만 작용한다 — 은하 별·배경은 셰이더/가산이라 조명 무관 */}
        <ambientLight intensity={AMBIENT_INTENSITY} />
        <pointLight
          position={[0, 0, 0]}
          intensity={STAR_LIGHT_INTENSITY}
          decay={STAR_LIGHT_DECAY}
          color={starColor}
        />
        {!isWarping ? <StarSurface radius={STAR_VISUAL_RADIUS} color={starColor} /> : null}

        {showPlanets
          ? planets.map((planet) => (
              <group key={planet.id}>
                <OrbitRing radius={orbitRadiusOf(planet)} />
                <Planet planet={planet} />
              </group>
            ))
          : null}
      </group>

      {showPlanets ? <PlanetCalloutProjector /> : null}
    </>
  )
}
