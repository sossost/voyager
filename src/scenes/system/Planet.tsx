import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Group, Mesh } from 'three'
import { Vector3 } from 'three'

import type { Planet as PlanetData, SpectralClass, Star } from '@/engine'
import { moonsOf, orbitScaleOf, stabilityOffsetAu } from '@/engine'
import { normalizedOrbit } from '@/scenes/system/habitableZone'
import { QUALITY_PRESETS } from '@/quality/presets'
import { fract } from '@/scenes/shared/fract'
import { AtmosphereLimb } from '@/scenes/system/AtmosphereLimb'
import { deriveAtmosphere } from '@/scenes/system/atmosphere'
import { enqueueBake } from '@/scenes/system/bakeQueue'
import { LifeSignalWaves } from '@/scenes/system/LifeSignalWaves'
import { currentBodies } from '@/scenes/system/currentBodies'
import { currentPlanetOrbits } from '@/scenes/system/currentPlanetOrbits'
import { massOf } from '@/scenes/system/multiplicity'
import { simClock } from '@/scenes/system/simClock'
import { Moon, moonSpanScaleFor } from '@/scenes/system/Moon'
import { PlanetRings, RING_INNER, RING_OUTER, RING_PLANE_NORMAL } from '@/scenes/system/PlanetRings'
import { createRingShadowUniforms, injectRingShadow } from '@/scenes/system/ringShadow'
import {
  bakePlanetTextures,
  disposePlanetTextures,
  type PlanetTextureSet,
} from '@/scenes/system/planetTexture'
import { useGameStore } from '@/store'

export const ORBIT_BASE_RADIUS = 5
/**
 * AU→렌더 반경 스케일. 궤도 간격을 넓혀 행성 위성계(행성 시각반경에 비례)가 이웃 궤도를
 * 침범하지 않을 공간을 확보한다 — 특히 목성·토성처럼 큰 가스 거성이 인접할 때. 값을 키우면
 * 항성계 전체가 커지므로 함교 정박 거리(ShipCameraRig SHIP_DISTANCE)도 함께 맞춘다. 렌더 전용.
 */
export const ORBIT_SCALE = 8
/**
 * 행성 시각 반경 = BASE + 엔진 radius × SCALE (압축 매핑).
 * 궤도 간격(최소 ~2유닛) 대비 행성 지름이 넘치지 않도록 축소.
 * 최대(radius=5): 0.25 + 5*0.18 = 1.15 — 항성(3)의 38%, 항성이 항상 2배 이상 크다.
 */
const PLANET_VISUAL_BASE = 0.25
const PLANET_VISUAL_SCALE = 0.18
/** orbitAu=1 행성의 공전 각속도 (rad/s) — 케플러 근사로 바깥쪽일수록 느려진다. */
const BASE_ANGULAR_SPEED = 0.22
const FULL_TURN = Math.PI * 2

/** 자전 속도 (rad/s) — paletteSeed 파생 변주, 방향도 시드 따라 갈린다. */
const SPIN_BASE_SPEED = 0.05
const SPIN_SPEED_SPAN = 0.09
/** 구름층은 표면보다 약간 빨리 돌아 살아있는 느낌을 만든다. */
const CLOUD_SPIN_FACTOR = 1.55
const CLOUD_LAYER_SCALE = 1.035

/**
 * 표면 거칠기 (O-5) — 가스 거성은 완전 확산체(무광 0.92), 암석형은 바다·빙원의 스페큘러
 * 글린트가 실제 관측 시그니처라 낮게(0.45). 종전 값이 물리적으로 정반대여서 스왑했다.
 */
const ROUGHNESS_ROCKY = 0.45
const ROUGHNESS_GAS = 0.92

/**
 * 궤도 표시 정규화 (사실성 v2 O-1·N-3 렌더 정합) — 엔진 orbitAu는 물리 AU(분광형 스케일 ×
 * 안정 오프셋 포함)라 그대로 매핑하면 M형은 뭉치고 A형은 화면 밖으로 나간다. 표시 전에
 * 안정 오프셋을 빼고 분광형 스케일의 역수를 곱해 v10과 동일한 시각 간격으로 되돌린다
 * (Sol 궤도 압축과 같은 "표시 전용 압축" — UI 수치·게임플레이는 물리 AU 유지).
 * 다중성 군집 회피는 기존 렌더 orbitOffset(N-1)이 이어서 맡는다.
 */
export interface OrbitDisplay {
  /** 물리 AU → 표시 AU 배율 (= 1 / orbitScaleOf). */
  readonly auScale: number
  /** 표시 전에 빼는 물리 AU (= stabilityOffsetAu). */
  readonly auShift: number
  /**
   * 공전 각속도 배율 = √(주성 질량/태양 질량) — ω=√(GM/a³)의 질량 항 (P-1/O-9 부수).
   * 다중성계 행성은 적분기가 실제 질량 중력으로 굴리므로, closed-form 단일성계도 같은
   * 질량 종속을 갖게 해 solver 간 운동학을 정합한다.
   */
  readonly speedScale: number
}

export const IDENTITY_ORBIT_DISPLAY: OrbitDisplay = { auScale: 1, auShift: 0, speedScale: 1 }

export function orbitDisplayOf(star: Star | null): OrbitDisplay {
  if (star == null) return IDENTITY_ORBIT_DISPLAY
  return {
    auScale: 1 / orbitScaleOf(star.spectral),
    auShift: stabilityOffsetAu(star),
    speedScale: Math.sqrt(massOf(star.spectral)),
  }
}

/** 물리 AU → 표시 AU. */
function displayAu(orbitAu: number, display: OrbitDisplay): number {
  return (orbitAu - display.auShift) * display.auScale
}

/** AU → 궤도 렌더 반경 (affine 매핑). 행성·궤도링·벨트가 같은 식을 공유 (단일 소스). */
export function auToOrbitRadius(
  orbitAu: number,
  orbitOffset = 0,
  display: OrbitDisplay = IDENTITY_ORBIT_DISPLAY,
): number {
  return ORBIT_BASE_RADIUS + displayAu(orbitAu, display) * ORBIT_SCALE + orbitOffset
}

/** orbitOffset: 다중성계에서 별 군집을 벗어나도록 궤도를 바깥으로 미는 양 (기본 0). */
export function orbitRadiusOf(
  planet: PlanetData,
  orbitOffset = 0,
  display: OrbitDisplay = IDENTITY_ORBIT_DISPLAY,
): number {
  return auToOrbitRadius(planet.orbitAu, orbitOffset, display)
}

/** 궤도 시작 위상 — paletteSeed 파생 결정론 (자전 위상과도 공유). */
export function orbitInitialPhase(planet: PlanetData): number {
  return ((planet.paletteSeed % 360) / 360) * FULL_TURN
}

/**
 * 시간 t의 궤도 월드 좌표 — 렌더(Planet useFrame)와 콜아웃 투영기
 * (PlanetCalloutProjector)가 같은 수식을 쓴다 (단일 소스, 백로그 G-a-5).
 */
export function planetOrbitPosition(
  planet: PlanetData,
  elapsedSeconds: number,
  out: Vector3,
  orbitOffset = 0,
  display: OrbitDisplay = IDENTITY_ORBIT_DISPLAY,
): Vector3 {
  // 각속도는 표시 AU 기준 — 계 내부 케플러 비율(바깥일수록 느림)은 보존하면서 분광형 간
  // 시각 속도 폭주를 막는다 (물리 AU를 쓰면 M형 행성이 초당 수 회전으로 보인다).
  // speedScale(√M)이 ω=√(GM/a³)의 질량 항 — 다중성계 적분기와 운동학 정합 (P-1).
  const angularSpeed =
    (BASE_ANGULAR_SPEED * display.speedScale) /
    Math.pow(Math.max(displayAu(planet.orbitAu, display), 0.1), 1.5)
  const angle = orbitInitialPhase(planet) + elapsedSeconds * angularSpeed
  const radius = orbitRadiusOf(planet, orbitOffset, display)
  return out.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius)
}

/** 베이크가 도착하기 전의 플레이스홀더 색 — paletteSeed 파생 (텍스처로 교체된다). */
function placeholderColor(planet: PlanetData): string {
  const hue = planet.paletteSeed % 360
  return planet.kind === 'rocky' ? `hsl(${hue}, 32%, 52%)` : `hsl(${hue}, 58%, 62%)`
}

interface PlanetProps {
  readonly planet: PlanetData
  /** 다중성계에서 별 군집을 벗어나도록 궤도를 바깥으로 미는 양 (기본 0). */
  readonly orbitOffset?: number
  /**
   * 온도 표면 산출용 별 분광형 — HZ가 있는 별(hasHabitableZone)에만 전달한다.
   * null이면 온도를 표면에 반영하지 않는다 (O/B·거성·왜성 등 광도 모델 무의미, hz-visualization).
   */
  readonly hzSpectral?: SpectralClass | null
  /**
   * 위성 최외곽 궤도 상한 (행성 중심 기준 반경) — 이웃 행성 궤도 침범 방지용. null이면 무제한.
   * CurrentSystem이 인접 궤도 간격으로 산출한다.
   */
  readonly moonOrbitLimit?: number | null
  /**
   * 다중성계 중력 모드에서 이 행성의 궤도 인덱스 — CurrentSystem이 게시한 적분 위치
   * (currentPlanetOrbits.localPositions[index])를 읽는다. null이면 단일성계라 closed-form
   * planetOrbitPosition 자가구동 (multi-star-gravity N-1).
   */
  readonly gravityOrbitIndex?: number | null
  /** 궤도 표시 정규화 (O-1·N-3) — CurrentSystem이 orbitDisplayOf(star)로 산출한다. */
  readonly orbitDisplay?: OrbitDisplay
}

/**
 * 공전하는 행성 — 위치는 시간 t에서 계산하며 상태로 저장하지 않는다 (R3F 성능 규율).
 * 표면은 paletteSeed 결정론 베이크 텍스처(결정 29·33) — 베이크는 프레임 분산 큐로
 * 비동기 수행되어 진입 히치가 없고, 도착 전에는 플레이스홀더 단색을 쓴다.
 * 조명은 항성 포인트라이트가 만드는 낮/밤 경계를 그대로 쓴다. 클릭하면 행성 패널이 열린다.
 */
export function Planet({
  planet,
  orbitOffset = 0,
  hzSpectral = null,
  moonOrbitLimit = null,
  gravityOrbitIndex = null,
  orbitDisplay = IDENTITY_ORBIT_DISPLAY,
}: PlanetProps) {
  const groupRef = useRef<Group>(null)
  const surfaceRef = useRef<Mesh>(null)
  const cloudsRef = useRef<Mesh>(null)
  const selectPlanet = useGameStore((state) => state.selectPlanet)
  const isSelected = useGameStore((state) => state.selectedPlanetId === planet.id)
  const qualityTier = useGameStore((state) => state.qualityTier)
  const seed = useGameStore((state) => state.seed)
  const moons = useMemo(() => moonsOf(seed, planet), [seed, planet])
  const { planetSegments: segments, planetTextureBaseWidth } = QUALITY_PRESETS[qualityTier]

  // 정규화 궤도 x(= orbitAu / HZ중심) — 표면 재질(암석 온도대·가스 Sudarsky 클래스)을 물리적으로
  // 정한다 (오라가 아니라 재질 자체). 무HZ 별이면 null이라 온도 무반영 (hz-visualization).
  const hzOrbit = hzSpectral == null ? null : normalizedOrbit(planet.orbitAu, hzSpectral)

  // 대기 산란 림 — 온도 표면재질과 같은 렌더 파생(기존 데이터 순수 함수, GEN_VERSION 무관).
  // 표면 텍스처와 독립이라 베이크를 기다리지 않고 즉시 렌더한다.
  const atmosphere = useMemo(() => deriveAtmosphere(planet, hzOrbit), [planet, hzOrbit])

  const [textures, setTextures] = useState<PlanetTextureSet | null>(null)

  useEffect(() => {
    let bakedSet: PlanetTextureSet | null = null
    const cancelBake = enqueueBake(() => {
      bakedSet = bakePlanetTextures(planet, planetTextureBaseWidth, hzOrbit)
      setTextures(bakedSet)
    })
    return () => {
      cancelBake()
      if (bakedSet != null) disposePlanetTextures(bakedSet)
      setTextures(null)
    }
  }, [planet, planetTextureBaseWidth, hzOrbit])

  const initialPhase = orbitInitialPhase(planet)
  const visualRadius = PLANET_VISUAL_BASE + planet.radius * PLANET_VISUAL_SCALE

  // 위성 외곽 스프레드 압축 계수 — 최외곽 위성이 이웃 궤도 상한을 넘으면 SPAN만 줄인다
  // (MIN은 유지해 고리·본체 클리어 보존). 상한이 없거나 여유가 있으면 1(원본).
  const moonSpanScale = useMemo(() => {
    const maxOrbitFactor = moons.reduce((max, moon) => Math.max(max, moon.orbitFactor), 0)
    return moonSpanScaleFor(visualRadius, maxOrbitFactor, moonOrbitLimit)
  }, [moons, visualRadius, moonOrbitLimit])
  const spinSpeed = SPIN_BASE_SPEED + SPIN_SPEED_SPAN * fract(planet.paletteSeed * 0.0173)
  const spinDirection = planet.paletteSeed % 2 === 0 ? 1 : -1

  // 고리 그림자 띠 (O-3) — 고리 있는 행성만 표면 재질에 해석 판정을 주입한다.
  // 유니폼(별·행성 월드 좌표, 고리 월드 반경)은 아래 useFrame이 매 프레임 갱신한다.
  const ringShadow = useMemo(
    () => (planet.hasRings === true ? createRingShadowUniforms(RING_PLANE_NORMAL) : null),
    [planet.hasRings],
  )
  const ringShadowCompile = useMemo(
    () =>
      ringShadow == null
        ? undefined
        : (shader: Parameters<typeof injectRingShadow>[0]) => injectRingShadow(shader, ringShadow),
    [ringShadow],
  )
  const worldScaleScratch = useMemo(() => new Vector3(), [])

  useFrame(() => {
    const group = groupRef.current
    if (group == null) return
    // 배속 시계 — 공전·자전 모두 배속에 반응한다(simulation-speed). 일시정지(0)면 멈춘다.
    const elapsed = simClock.now
    // 다중성계 중력 모드: CurrentSystem이 적분해 게시한 위치를 읽는다. 미준비(첫 프레임)거나
    // 단일성계면 closed-form으로 폴백 — 시드가 궤도 위이므로 전환 seam이 없다.
    const useGravity =
      gravityOrbitIndex != null &&
      currentPlanetOrbits.active &&
      gravityOrbitIndex < currentPlanetOrbits.count
    if (useGravity) {
      group.position.copy(currentPlanetOrbits.localPositions[gravityOrbitIndex] as Vector3)
    } else {
      planetOrbitPosition(planet, elapsed, group.position, orbitOffset, orbitDisplay)
    }

    const spin = initialPhase + elapsed * spinSpeed * spinDirection
    if (surfaceRef.current != null) surfaceRef.current.rotation.y = spin
    if (cloudsRef.current != null) cloudsRef.current.rotation.y = spin * CLOUD_SPIN_FACTOR

    // 고리 그림자 유니폼 갱신 (O-3) — 별·행성 월드 좌표와 뷰 스케일 반영 고리 반경.
    if (ringShadow != null) {
      group.getWorldPosition(ringShadow.ringCenter)
      if (currentBodies.count > 0) {
        ringShadow.starPos.copy(currentBodies.positions[0] as Vector3)
      }
      const ringWorldScale = group.getWorldScale(worldScaleScratch).x * visualRadius
      ringShadow.ringInner.value = RING_INNER * ringWorldScale
      ringShadow.ringOuter.value = RING_OUTER * ringWorldScale
    }
  })

  return (
    <group ref={groupRef}>
      <mesh
        ref={surfaceRef}
        onClick={(event) => {
          event.stopPropagation()
          selectPlanet(planet.id)
        }}
      >
        <sphereGeometry args={[visualRadius, segments, segments]} />
        {/* key로 머티리얼 리마운트 강제 — 같은 위치 조건 분기는 인스턴스가 재사용되어
            제거된 color prop이 리셋(검정)되고 map 셰이더 재컴파일도 빠진다 */}
        {textures == null ? (
          <meshStandardMaterial
            key="placeholder"
            color={placeholderColor(planet)}
            roughness={planet.kind === 'rocky' ? ROUGHNESS_ROCKY : ROUGHNESS_GAS}
            metalness={0.05}
            onBeforeCompile={ringShadowCompile}
          />
        ) : (
          <meshStandardMaterial
            key="baked"
            color="#ffffff"
            map={textures.surface}
            roughness={planet.kind === 'rocky' ? ROUGHNESS_ROCKY : ROUGHNESS_GAS}
            metalness={0.05}
            onBeforeCompile={ringShadowCompile}
          />
        )}
      </mesh>

      {textures?.clouds != null ? (
        <mesh ref={cloudsRef}>
          <sphereGeometry args={[visualRadius * CLOUD_LAYER_SCALE, segments, segments]} />
          <meshStandardMaterial
            map={textures.clouds}
            transparent
            depthWrite={false}
            roughness={1}
            metalness={0}
          />
        </mesh>
      ) : null}

      {atmosphere.kind !== 'none' ? (
        <AtmosphereLimb radius={visualRadius} profile={atmosphere} />
      ) : null}

      {isSelected ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[visualRadius * 1.5, visualRadius * 1.7, 48]} />
          <meshBasicMaterial color="#7c5cff" transparent opacity={0.95} depthWrite={false} />
        </mesh>
      ) : null}

      {planet.hasRings === true ? <PlanetRings planetVisualRadius={visualRadius} /> : null}

      {planet.hasLife ? <LifeSignalWaves planetRadius={visualRadius} /> : null}

      {moons.map((moon) => (
        <Moon
          key={moon.index}
          moon={moon}
          planetVisualRadius={visualRadius}
          orbitSpanScale={moonSpanScale}
        />
      ))}
    </group>
  )
}
