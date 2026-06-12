import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import type { Group, PointLight } from 'three'
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
/**
 * 항성 포인트라이트 — 조명은 그룹 스케일과 무관하게 월드 좌표로 작동한다.
 * 퍼스펙티브(1/8 스케일)에선 행성이 항성에 8배 가까워지므로 강도를 대폭 낮춘다.
 * 유도: decay=1.6, 거리 1/8 → 동일 밝기 유지 강도 = 500 / 8^1.6 ≈ 19.
 */
const STAR_LIGHT_INTENSITY_SHIP = 500
const STAR_LIGHT_INTENSITY_PERSPECTIVE = 19
const STAR_LIGHT_DECAY = 1.6
/** 주변광 — 밤면 가독성. */
const AMBIENT_INTENSITY = 0.9

/**
 * 은하 항법(퍼스펙티브) 뷰의 항성계 스케일 — 함교 뷰(1.0)에 비해 1/8.
 * 은하 스케일 대비 행성계가 실제보다 크게 보이는 이질감을 줄인다.
 */
const PERSPECTIVE_SYSTEM_SCALE = 0.125
const SHIP_SYSTEM_SCALE = 1.0

export function CurrentSystem() {
  const seed = useGameStore((state) => state.seed)
  const starId = useGameStore((state) => state.currentStarId)
  const sceneKind = useGameStore((state) => state.scene.kind)
  const isPerspective = useGameStore(
    (state) => state.scene.kind === 'galaxy' && state.scene.view === 'perspective',
  )
  // 행성·궤도링은 은하 뷰에서만 — 워프 중엔 텍스처 베이크 부담 없이 구체에 집중 (결정 41-c).
  const showPlanets = sceneKind === 'galaxy'
  // 워프 중엔 별 구체도 숨긴다 — 시작 시 구(FROM)→점 전환 팝 방지 + 도착 후 플래시가
  // 걷히며 crossfade로 자연스럽게 나타남. 포인트 스프라이트가 시각 연속성 담당 (백로그 H-2).
  const isWarping = sceneKind === 'warping'

  const systemGroupRef = useRef<Group>(null)
  const lightRef = useRef<PointLight>(null)
  const lightIntensityRef = useRef(STAR_LIGHT_INTENSITY_SHIP)
  const lodScratch = useMemo(() => new Vector3(), [])
  const systemScaleRef = useRef(SHIP_SYSTEM_SCALE)

  const star = useMemo(() => starById(seed, starId), [seed, starId])
  const planets = useMemo(() => planetsOf(seed, starId), [seed, starId])
  const worldPosition = useMemo(
    () => starWorldPosition(seed, starId) ?? ([0, 0, 0] as const),
    [seed, starId],
  )
  const starColor = star == null ? '#ffffff' : SPECTRAL_RENDER[star.spectral].color

  useFrame((state, delta) => {
    const group = systemGroupRef.current
    if (group == null) return

    // LOD — 임계 거리 초과 시 그룹 전체 비가시화 (백로그 H-3).
    const dist = state.camera.position.distanceTo(
      lodScratch.set(worldPosition[0], worldPosition[1], worldPosition[2]),
    )
    group.visible = dist < SYSTEM_LOD_DISTANCE

    // 퍼스펙티브(은하 항법) ↔ 함교 뷰 전환 시 스케일 + 광원 강도 부드럽게 보간.
    const lerpFactor = 1 - Math.pow(0.02, delta)
    const targetScale = isPerspective ? PERSPECTIVE_SYSTEM_SCALE : SHIP_SYSTEM_SCALE
    systemScaleRef.current += (targetScale - systemScaleRef.current) * lerpFactor
    group.scale.setScalar(systemScaleRef.current)

    // 광원: 스케일과 함께 강도 보간 — 행성 세계 거리가 달라진 만큼 보정
    const light = lightRef.current
    if (light != null) {
      const targetIntensity = isPerspective ? STAR_LIGHT_INTENSITY_PERSPECTIVE : STAR_LIGHT_INTENSITY_SHIP
      lightIntensityRef.current += (targetIntensity - lightIntensityRef.current) * lerpFactor
      light.intensity = lightIntensityRef.current
    }
  })

  const wp = [worldPosition[0], worldPosition[1], worldPosition[2]] as const

  return (
    <>
      {/* 조명은 월드 좌표 고정 — geometry 그룹 스케일과 무관하게 거리 기반으로 작동한다. */}
      <ambientLight intensity={AMBIENT_INTENSITY} />
      <pointLight
        ref={lightRef}
        position={wp}
        intensity={STAR_LIGHT_INTENSITY_SHIP}
        decay={STAR_LIGHT_DECAY}
        color={starColor}
      />

      <group ref={systemGroupRef} position={wp}>
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
