import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import type { Group, PointLight } from 'three'
import { PerspectiveCamera, Vector3 } from 'three'

import type { StarKind } from '@/engine'
import { planetsOf, starById } from '@/engine'
import { starWorldPosition } from '@/engine/galaxy/position'
import { EXOTIC_RENDER, SPECTRAL_RENDER } from '@/scenes/galaxy/spectral'
import { blackHoleLens, clearBlackHoleLens } from '@/scenes/system/blackHoleLens'
import { clearCurrentBodies, currentBodies } from '@/scenes/system/currentBodies'
import { ExoticBody } from '@/scenes/system/ExoticBody'
import { kindRadiusFactor } from '@/scenes/system/exotic'
import {
  bodyLightFactor,
  bodyPositions,
  bodyVisualRadius,
  isCircumbinary,
  planetClearanceOffset,
  STAR_VISUAL_RADIUS,
} from '@/scenes/system/multiplicity'
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
  /** 별 종류 — 주성만 이색 가능, 동반성은 항상 main_sequence (결정 7). */
  readonly kind: StarKind
  /** point light 색 — 블랙홀은 강착원반 발광색으로 행성을 비춘다(본체는 검은 구). */
  readonly lightColor: string
}

/** 블랙홀 강착원반 발광색 — 검은 본체 대신 이 따뜻한 빛이 행성·동반성을 비춘다. */
const BLACK_HOLE_LIGHT_COLOR = '#ffcaa0'

export function CurrentSystem() {
  const seed = useGameStore((state) => state.seed)
  const currentStarId = useGameStore((state) => state.currentStarId)
  const scene = useGameStore((state) => state.scene)
  const isPerspective = scene.kind === 'galaxy' && scene.view === 'perspective'
  const isWarping = scene.kind === 'warping'
  // 워프 중엔 FROM 별을 기준으로 렌더 — currentStarId는 이미 목적지이지만
  // 카메라는 FROM 별 근처이므로 광원·LOD 기준이 FROM이어야 한다.
  const starId = isWarping ? scene.from : currentStarId
  // 행성·궤도링은 은하 뷰에서만 (워프 중엔 구체에 집중, 결정 41-c) — showPlanets는 star 이후 정의.

  const systemGroupRef = useRef<Group>(null)
  const planetCenterRef = useRef<Group>(null)
  const bodyGroupRefs = useRef<(Group | null)[]>([])
  const bodyLightRefs = useRef<(PointLight | null)[]>([])
  const lightIntensityRefs = useRef<number[]>(
    Array.from({ length: MAX_BODIES }, () => STAR_LIGHT_INTENSITY_SHIP),
  )
  const lodScratch = useMemo(() => new Vector3(), [])
  const ndcScratch = useMemo(() => new Vector3(), [])
  const bodyScratch = useMemo(
    () => Array.from({ length: MAX_BODIES }, () => new Vector3()),
    [],
  )
  const systemScaleRef = useRef(SHIP_SYSTEM_SCALE)

  const star = useMemo(() => starById(seed, starId), [seed, starId])
  const planets = useMemo(() => planetsOf(seed, starId), [seed, starId])
  // 블랙홀은 행성을 숨긴다 — 강착원반이 내행성 궤도와 겹치고 천문학적으로도 이례적이다
  // (펄서·왜성·거성은 행성 유지). planetsOf는 무변경이라 골든·결정론 무관(렌더 전용).
  const showPlanets = scene.kind === 'galaxy' && star?.kind !== 'black_hole'
  const worldPosition = useMemo(
    () => starWorldPosition(seed, starId) ?? ([0, 0, 0] as const),
    [seed, starId],
  )
  const circumbinary = useMemo(() => (star == null ? false : isCircumbinary(star)), [star])

  // 별 본체가 안 보이는 동안(언마운트·워프) 레지스트리를 비운다 — stale 좌표 방지.
  useEffect(() => clearCurrentBodies, [])
  // 언마운트 시 중력렌즈 비활성 (stale 활성 방지).
  useEffect(() => clearBlackHoleLens, [])
  // 별 군집을 벗어나도록 행성 궤도를 바깥으로 미는 양 (별/행성 관통 방지).
  const orbitOffset = useMemo(() => (star == null ? 0 : planetClearanceOffset(star)), [star])

  // 별 N개의 시각 속성 — 주성 반경은 단일성과 동일(STAR_VISUAL_RADIUS)하게 유지해
  // 기존 단일 항성 렌더가 한 픽셀도 바뀌지 않게 한다. 동반성만 질량비로 스케일.
  const bodies = useMemo<readonly BodyVisual[]>(() => {
    if (star == null) {
      return [
        {
          key: 'primary',
          color: '#ffffff',
          radius: STAR_VISUAL_RADIUS,
          lightFactor: 1,
          kind: 'main_sequence',
          lightColor: '#ffffff',
        },
      ]
    }
    // 주성 색·반경은 kind로 분기 — main_sequence는 기존과 동일(분광 색 + STAR_VISUAL_RADIUS).
    const primaryColor =
      star.kind === 'main_sequence'
        ? SPECTRAL_RENDER[star.spectral].color
        : EXOTIC_RENDER[star.kind].color
    const primary: BodyVisual = {
      key: 'primary',
      color: primaryColor,
      // 시각 반경 = 충돌 반경(renderedRadius)과 같은 식 — kindRadiusFactor 공유 (결정 12).
      radius: STAR_VISUAL_RADIUS * kindRadiusFactor(star.kind),
      lightFactor: 1,
      kind: star.kind,
      lightColor: star.kind === 'black_hole' ? BLACK_HOLE_LIGHT_COLOR : primaryColor,
    }
    const companions = star.companions.map<BodyVisual>((companion, index) => ({
      key: `companion-${index}`,
      color: SPECTRAL_RENDER[companion.spectral].color,
      radius: bodyVisualRadius(companion.spectral, STAR_VISUAL_RADIUS),
      lightFactor: bodyLightFactor(companion.spectral),
      kind: 'main_sequence',
      lightColor: SPECTRAL_RENDER[companion.spectral].color,
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
    if (star != null && !isWarping) {
      const scale = systemScaleRef.current
      const bodyCount = bodyPositions(star, state.clock.elapsedTime, bodyScratch)
      for (let i = 0; i < bodyCount; i++) {
        const local = bodyScratch[i] as Vector3
        bodyGroupRefs.current[i]?.position.copy(local)
        // 월드 좌표 게시 — 스케일 반영(= barycenter + scale·local). 피킹·마커·콜아웃 단일 소스.
        ;(currentBodies.positions[i] as Vector3).set(
          worldPosition[0] + local.x * scale,
          worldPosition[1] + local.y * scale,
          worldPosition[2] + local.z * scale,
        )
        currentBodies.radii[i] = (bodies[i] as BodyVisual).radius * scale
      }
      currentBodies.starId = currentStarId
      currentBodies.count = bodyCount
      // 행성 궤도 중심 — 항상 질량중심(원점) 공전 (circumbinary, 결정 8 개정).
      const center = planetCenterRef.current
      if (center != null) {
        if (circumbinary) center.position.set(0, 0, 0)
        else center.position.copy(bodyScratch[0] as Vector3)
      }
    } else if (isWarping) {
      clearCurrentBodies()
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

    // 블랙홀 측지선 중력렌즈 — 현재 별이 블랙홀이고 근접(LOD 안)일 때 카메라 행렬·BH/디스크
    // 파라미터를 게시한다 (high 티어 포스트 패스 BlackHoleRayMarch가 읽어 레이마칭). 그 외 비활성.
    if (star != null && star.kind === 'black_hole' && !isWarping && dist < SYSTEM_LOD_DISTANCE) {
      const cam = state.camera
      blackHoleLens.cameraPos.copy(cam.position)
      blackHoleLens.invViewProj.multiplyMatrices(cam.matrixWorld, cam.projectionMatrixInverse)
      blackHoleLens.viewProj.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse)
      blackHoleLens.bhPos.set(worldPosition[0], worldPosition[1], worldPosition[2])
      const rs = (bodies[0]?.radius ?? STAR_VISUAL_RADIUS) * systemScaleRef.current
      blackHoleLens.rs = rs
      blackHoleLens.diskInner = rs * 2.9 // 광자구(2.6rs) 바로 바깥부터
      blackHoleLens.diskOuter = rs * 5.6
      blackHoleLens.diskNormal.set(0, 1, 0) // 수평 원반(월드 고정) — 정박 시점에서 옆모습
      ndcScratch.set(worldPosition[0], worldPosition[1], worldPosition[2]).project(cam)
      blackHoleLens.center.set(ndcScratch.x * 0.5 + 0.5, ndcScratch.y * 0.5 + 0.5)
      const fov = cam instanceof PerspectiveCamera ? cam.fov : 60
      const halfHeight = dist * Math.tan((fov * Math.PI) / 360)
      blackHoleLens.screenRadius = halfHeight > 0 ? ((rs * 12) / halfHeight) * 0.5 : 0.3
      blackHoleLens.active = true
    } else {
      clearBlackHoleLens()
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
                {/* 이색 천체(블랙홀·펄서·거성·왜성)는 ExoticBody로 디스패치 — 주성만 가능 (결정 7·14). */}
                {body.kind === 'main_sequence' ? (
                  <StarSurface radius={body.radius} color={body.color} />
                ) : (
                  <ExoticBody kind={body.kind} radius={body.radius} color={body.color} />
                )}
                {/* 별 본체 선택은 화면공간 피킹(useStarPicking)이 currentBodies 월드 좌표로
                    처리한다 — 모든 뷰(우주선·퍼스펙티브)에서 본체별 선택이 동작한다. */}
                <pointLight
                  ref={(el) => {
                    bodyLightRefs.current[index] = el
                  }}
                  intensity={STAR_LIGHT_INTENSITY_SHIP * body.lightFactor}
                  decay={STAR_LIGHT_DECAY}
                  color={body.lightColor}
                />
              </group>
            ))
          : null}

        {showPlanets ? (
          <group ref={planetCenterRef}>
            {planets.map((planet) => (
              <group key={planet.id}>
                <OrbitRing radius={orbitRadiusOf(planet, orbitOffset)} />
                <Planet planet={planet} orbitOffset={orbitOffset} />
              </group>
            ))}
          </group>
        ) : null}
      </group>

      {showPlanets ? <PlanetCalloutProjector /> : null}
    </>
  )
}
