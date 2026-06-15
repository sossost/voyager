import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import type { Group, PointLight } from 'three'
import { Vector3 } from 'three'

import { planetsOf, starById } from '@/engine'
import { starWorldPosition } from '@/engine/galaxy/position'
import { SPECTRAL_RENDER } from '@/scenes/galaxy/spectral'
import {
  bodyLightFactor,
  bodyPositions,
  bodyVisualRadius,
  isCircumbinary,
  STAR_VISUAL_RADIUS,
} from '@/scenes/system/multiplicity'
import { OrbitRing } from '@/scenes/system/OrbitRing'
import { orbitRadiusOf, Planet } from '@/scenes/system/Planet'
import { PlanetCalloutProjector } from '@/scenes/system/PlanetCalloutProjector'
import { StarSurface } from '@/scenes/system/StarSurface'
import { SYSTEM_LOD_DISTANCE } from '@/scenes/system/starCrossfade'
import { suppressStarPick } from '@/scenes/system/starPickSuppress'
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

// STAR_VISUAL_RADIUS는 multiplicity.ts에서 임포트 — SelectedStarMarker와 공용 (코로나 글로우로 더 크게 보인다).
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

/** 다중성계 최대 별 수 (주성 + 동반성 2) — ref·스크래치 슬롯 사전 할당. */
const MAX_BODIES = 3

interface BodyVisual {
  readonly key: string
  readonly color: string
  readonly radius: number
  readonly lightFactor: number
}

export function CurrentSystem() {
  const seed = useGameStore((state) => state.seed)
  const currentStarId = useGameStore((state) => state.currentStarId)
  const selectStar = useGameStore((state) => state.selectStar)
  const scene = useGameStore((state) => state.scene)
  const isPerspective = scene.kind === 'galaxy' && scene.view === 'perspective'
  const isWarping = scene.kind === 'warping'
  // 워프 중엔 FROM 별을 기준으로 렌더 — currentStarId는 이미 목적지이지만
  // 카메라는 FROM 별 근처이므로 광원·LOD 기준이 FROM이어야 한다.
  const starId = isWarping ? scene.from : currentStarId
  // 행성·궤도링은 은하 뷰에서만 — 워프 중엔 텍스처 베이크 부담 없이 구체에 집중 (결정 41-c).
  const showPlanets = scene.kind === 'galaxy'

  const systemGroupRef = useRef<Group>(null)
  const planetCenterRef = useRef<Group>(null)
  const bodyGroupRefs = useRef<(Group | null)[]>([])
  const bodyLightRefs = useRef<(PointLight | null)[]>([])
  const lightIntensityRefs = useRef<number[]>(
    Array.from({ length: MAX_BODIES }, () => STAR_LIGHT_INTENSITY_SHIP),
  )
  const lodScratch = useMemo(() => new Vector3(), [])
  const bodyScratch = useMemo(
    () => Array.from({ length: MAX_BODIES }, () => new Vector3()),
    [],
  )
  const systemScaleRef = useRef(SHIP_SYSTEM_SCALE)

  const star = useMemo(() => starById(seed, starId), [seed, starId])
  const planets = useMemo(() => planetsOf(seed, starId), [seed, starId])
  const worldPosition = useMemo(
    () => starWorldPosition(seed, starId) ?? ([0, 0, 0] as const),
    [seed, starId],
  )
  const circumbinary = useMemo(() => (star == null ? false : isCircumbinary(star)), [star])

  // 별 N개의 시각 속성 — 주성 반경은 단일성과 동일(STAR_VISUAL_RADIUS)하게 유지해
  // 기존 단일 항성 렌더가 한 픽셀도 바뀌지 않게 한다. 동반성만 질량비로 스케일.
  const bodies = useMemo<readonly BodyVisual[]>(() => {
    if (star == null) {
      return [{ key: 'primary', color: '#ffffff', radius: STAR_VISUAL_RADIUS, lightFactor: 1 }]
    }
    const primary: BodyVisual = {
      key: 'primary',
      color: SPECTRAL_RENDER[star.spectral].color,
      radius: STAR_VISUAL_RADIUS,
      lightFactor: 1,
    }
    const companions = star.companions.map<BodyVisual>((companion, index) => ({
      key: `companion-${index}`,
      color: SPECTRAL_RENDER[companion.spectral].color,
      radius: bodyVisualRadius(companion.spectral, STAR_VISUAL_RADIUS),
      lightFactor: bodyLightFactor(companion.spectral),
    }))
    return [primary, ...companions]
  }, [star])

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

    // 별 위치 — 질량중심 공전 (원점 = inner barycenter). 단일성은 주성이 원점 고정.
    if (star != null) {
      const bodyCount = bodyPositions(star, state.clock.elapsedTime, bodyScratch)
      for (let i = 0; i < bodyCount; i++) {
        bodyGroupRefs.current[i]?.position.copy(bodyScratch[i] as Vector3)
      }
      // 행성 궤도 중심 — circumbinary면 질량중심(원점), 아니면 주성 추종 (S-type).
      const center = planetCenterRef.current
      if (center != null) {
        if (circumbinary) center.position.set(0, 0, 0)
        else center.position.copy(bodyScratch[0] as Vector3)
      }
    }

    // 광원: 별마다 강도 보간 — 퍼스펙티브 스케일 보정 × 질량 광도 계수.
    const baseTarget = isPerspective ? STAR_LIGHT_INTENSITY_PERSPECTIVE : STAR_LIGHT_INTENSITY_SHIP
    for (let i = 0; i < bodies.length; i++) {
      const light = bodyLightRefs.current[i]
      if (light == null) continue
      const target = baseTarget * (bodies[i] as BodyVisual).lightFactor
      const current = lightIntensityRefs.current[i] ?? baseTarget
      const next = current + (target - current) * lerpFactor
      lightIntensityRefs.current[i] = next
      light.intensity = next
    }
  })

  const wp = [worldPosition[0], worldPosition[1], worldPosition[2]] as const

  return (
    <>
      <ambientLight intensity={AMBIENT_INTENSITY} />

      {/* 별·행성을 같은 스케일 그룹에 둔다 — 광원도 그룹 자식이라 별과 함께 공전한다.
          단일성에선 주성이 원점(0,0,0)에 고정되어 기존 렌더와 동일하다. */}
      <group ref={systemGroupRef} position={wp}>
        {!isWarping
          ? bodies.map((body, index) => (
              <group
                key={body.key}
                ref={(el) => {
                  bodyGroupRefs.current[index] = el
                }}
              >
                <StarSurface radius={body.radius} color={body.color} />
                {/* 클릭 프록시 — 별 본체를 선택(다중성계는 별마다 개별 선택). 코로나 간섭 없이
                    레이캐스트만 받는 투명 구. pointerdown에서 카탈로그 피킹을 억제한다. */}
                <mesh
                  onPointerDown={(event) => {
                    event.stopPropagation()
                    suppressStarPick()
                  }}
                  onClick={(event) => {
                    event.stopPropagation()
                    selectStar(currentStarId, index)
                  }}
                >
                  <sphereGeometry args={[body.radius * 1.15, 16, 16]} />
                  <meshBasicMaterial transparent opacity={0} depthWrite={false} />
                </mesh>
                <pointLight
                  ref={(el) => {
                    bodyLightRefs.current[index] = el
                  }}
                  intensity={STAR_LIGHT_INTENSITY_SHIP * body.lightFactor}
                  decay={STAR_LIGHT_DECAY}
                  color={body.color}
                />
              </group>
            ))
          : null}

        {showPlanets ? (
          <group ref={planetCenterRef}>
            {planets.map((planet) => (
              <group key={planet.id}>
                <OrbitRing radius={orbitRadiusOf(planet)} />
                <Planet planet={planet} />
              </group>
            ))}
          </group>
        ) : null}
      </group>

      {showPlanets ? <PlanetCalloutProjector /> : null}
    </>
  )
}
