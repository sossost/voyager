import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import type { Group, PointLight } from 'three'
import { PerspectiveCamera, Vector3 } from 'three'

import type { StarKind } from '@/engine'
import { hasHabitableZone, planetsOf, SOL_STAR_ID, starById } from '@/engine'
import { starWorldPosition } from '@/engine/galaxy/position'
import { EXOTIC_RENDER, SPECTRAL_RENDER } from '@/scenes/galaxy/spectral'
import { BlackHole } from '@/scenes/system/BlackHole'
import { blackHoleLens, clearBlackHoleLens } from '@/scenes/system/blackHoleLens'
import { clearCurrentBodies, currentBodies } from '@/scenes/system/currentBodies'
import { kindRadiusFactor, kindSurface } from '@/scenes/system/exotic'
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
import { Pulsar } from '@/scenes/system/Pulsar'
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

/**
 * 위성 궤도 상한 = 인접 행성까지 궤도 간격 × 이 비율. 인접한 두 행성이 각자 이 비율만큼
 * 서로를 향해 뻗으므로, 두 위성계가 겹치지 않으려면 (비율×2 < 1) → 0.5 미만이어야 한다.
 * 0.45로 두어 두 계 사이에 여유를 남긴다 (0.45+0.45=0.9 < 1).
 */
const MOON_NEIGHBOR_SAFE_FRACTION = 0.45

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
  // 블랙홀이 카메라 앞에 있는지 판정용 (시선 방향·BH 방향) — 뒤편이면 렌즈 비활성.
  const forwardScratch = useMemo(() => new Vector3(), [])
  const toBhScratch = useMemo(() => new Vector3(), [])
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
  // 행성별 위성 궤도 상한 — 가장 가까운 이웃 행성까지 궤도 간격의 안전 비율. 위성이 이웃
  // 궤도를 침범하지 않게 Planet이 이 값으로 외곽 스프레드를 압축한다 (렌더 전용).
  const moonOrbitLimits = useMemo(() => {
    const radii = planets.map((planet) => orbitRadiusOf(planet, orbitOffset))
    return radii.map((radius, index) => {
      let nearestGap = Infinity
      radii.forEach((otherRadius, other) => {
        if (other === index) return
        nearestGap = Math.min(nearestGap, Math.abs(radius - otherRadius))
      })
      return Number.isFinite(nearestGap) ? nearestGap * MOON_NEIGHBOR_SAFE_FRACTION : null
    })
  }, [planets, orbitOffset])
  // 온도 기반 표면 재질에 쓸 분광형 — 무HZ 별(O/B·거성·왜성·펄서)이면 null이라 온도 재질을
  // 생략한다 (hasHabitableZone 단일 게이팅, hz-visualization).
  //
  // 태양계는 예외 — 8행성 색이 sol.ts paletteSeed로 authored된 유일한 계다. 절차적 온도 재질이
  // 손으로 지정한 실제 색(화성 적·천왕성 청록·해왕성 파랑)을 덮으면 안 되므로 온도 경로를 우회한다
  // (null → hzOrbit=null → paletteSeed 색 그대로). 온도 임계는 실제 AU 기준인데 태양계 궤도는 게임
  // 스케일로 압축돼(sol.ts) 스케일이 어긋나고, Sudarsky 5클래스엔 얼음 거성 클래스가 없어 온도 모델로는
  // 천왕성·해왕성의 청록/파랑 재현 자체가 불가능하다. 렌더 전용 — GEN_VERSION 무관.
  const isSolarSystem = starId === SOL_STAR_ID
  const hzSpectral =
    star != null && !isSolarSystem && hasHabitableZone(star) ? star.spectral : null

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
    const cam = state.camera
    // 블랙홀이 카메라 뒤(시선 반대편)에 있으면 렌즈를 끈다 — Vector3.project()는 w<0(뒤)에서
    // 화면 안쪽으로 뒤집힌 팬텀 UV를 만든다. 가드 없으면 블랙홀 반대편을 봐도 그 팬텀 위치에
    // 검은 그림자가 하나 더 떠 보인다(사용자 지적). 시선·BH 방향 내적으로 정면 여부를 판정.
    const isBlackHoleInFront =
      star != null &&
      star.kind === 'black_hole' &&
      toBhScratch
        .set(worldPosition[0], worldPosition[1], worldPosition[2])
        .sub(cam.position)
        .dot(cam.getWorldDirection(forwardScratch)) > 0

    if (isBlackHoleInFront && !isWarping && dist < SYSTEM_LOD_DISTANCE) {
      blackHoleLens.cameraPos.copy(cam.position)
      blackHoleLens.invViewProj.multiplyMatrices(cam.matrixWorld, cam.projectionMatrixInverse)
      blackHoleLens.viewProj.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse)
      blackHoleLens.bhPos.set(worldPosition[0], worldPosition[1], worldPosition[2])
      const rs = (bodies[0]?.radius ?? STAR_VISUAL_RADIUS) * systemScaleRef.current
      blackHoleLens.rs = rs
      // 디스크 안쪽을 그림자(BCRIT≈4.8 rs)보다 훨씬 안까지 끌어내려 검은 구에 바짝 붙인다(갭 제거).
      // 전체 크기는 rs(kindRadiusFactor)로 조절.
      blackHoleLens.diskInner = rs * 2.5
      blackHoleLens.diskOuter = rs * 18.0
      blackHoleLens.diskNormal.set(0, 1, 0)
      ndcScratch.set(worldPosition[0], worldPosition[1], worldPosition[2]).project(cam)
      blackHoleLens.center.set(ndcScratch.x * 0.5 + 0.5, ndcScratch.y * 0.5 + 0.5)
      const fov = cam instanceof PerspectiveCamera ? cam.fov : 60
      const halfHeight = dist * Math.tan((fov * Math.PI) / 360)
      // 렌즈/굴절 게이팅 — 강착원반 외곽(18 rs) 정도로 컴팩트하게(≈28 rs). 렌즈 적분 도메인
      // (셰이더 START_R/ESCAPE_R)도 같은 28 rs라 휜 배경 영역과 게이트가 일치한다. 페이드로 경계 완화.
      blackHoleLens.screenRadius = halfHeight > 0 ? ((rs * 28) / halfHeight) * 0.5 : 0.7
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
                {/* 이색 천체는 전용 컴포넌트로, 주계열성은 StarSurface로 렌더 — 주성만 가능 (결정 7·14). */}
                {body.kind === 'black_hole' ? (
                  <BlackHole radius={body.radius} />
                ) : body.kind === 'pulsar' ? (
                  <Pulsar radius={body.radius} color={body.color} />
                ) : (
                  // 주계열성·적색거성·백색왜성 — 표면 발광/코로나만 kind로 변조 (결정 4).
                  // main_sequence는 {1,1}이라 기존 단일 항성 렌더가 한 픽셀도 안 바뀐다.
                  <StarSurface
                    radius={body.radius}
                    color={body.color}
                    emissiveBoost={kindSurface(body.kind).emissiveBoost}
                    coronaScale={kindSurface(body.kind).coronaScale}
                  />
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
            {planets.map((planet, index) => (
              <group key={planet.id}>
                <OrbitRing radius={orbitRadiusOf(planet, orbitOffset)} />
                <Planet
                  planet={planet}
                  orbitOffset={orbitOffset}
                  hzSpectral={hzSpectral}
                  moonOrbitLimit={moonOrbitLimits[index]}
                />
              </group>
            ))}
          </group>
        ) : null}
      </group>

      {showPlanets ? <PlanetCalloutProjector /> : null}
    </>
  )
}
