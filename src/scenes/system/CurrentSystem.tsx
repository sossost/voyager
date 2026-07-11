import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import type { Group, PointLight } from 'three'
import { Color, PerspectiveCamera, Vector3 } from 'three'

import type { Star, StarKind } from '@/engine'
import {
  beltsOf,
  hasHabitableZone,
  planetsOf,
  SOL_STAR_ID,
  starById,
  uniqueSystemOf,
} from '@/engine'
import { starWorldPosition } from '@/engine/galaxy/position'
import { AsteroidBelt } from '@/scenes/system/AsteroidBelt'
import {
  EXOTIC_RENDER,
  SPECTRAL_LIGHT_FACTOR,
  SPECTRAL_RENDER,
  SPECTRAL_SURFACE,
} from '@/scenes/galaxy/spectral'
import { BlackHole, type BlackHoleVariant } from '@/scenes/system/BlackHole'
import { blackHoleLens, clearBlackHoleLens } from '@/scenes/system/blackHoleLens'
import { MatterStream } from '@/scenes/system/MatterStream'
import { companionTide } from '@/scenes/system/companionTide'
import { clearCurrentBodies, currentBodies } from '@/scenes/system/currentBodies'
import {
  clearCurrentPlanetOrbits,
  currentPlanetOrbits,
  MAX_PLANETS,
  TRAIL_ORBITS,
  TRAIL_POINTS,
} from '@/scenes/system/currentPlanetOrbits'
import { kindRadiusFactor, kindSurface } from '@/scenes/system/exotic'
import {
  bodyPositions,
  bodyVisualRadius,
  coronaMaxRadii,
  isCircumbinary,
  massOf,
  planetClearanceOffset,
  STAR_VISUAL_RADIUS,
  stableOrbitFloor,
  stellarClearanceRadius,
} from '@/scenes/system/multiplicity'
import {
  type Attractor,
  createOrbitState,
  G_RENDER,
  MAX_SUBSTEPS_PER_FRAME,
  type PlanetOrbitState,
  seedLocalCircularOrbit,
  SIM_DT,
  stepOrbit,
} from '@/scenes/system/orbitIntegrator'
import { OrbitRing } from '@/scenes/system/OrbitRing'
import { OrbitTrail } from '@/scenes/system/OrbitTrail'
import {
  auToOrbitRadius,
  orbitDisplayOf,
  orbitInitialPhase,
  orbitRadiusOf,
  Planet,
} from '@/scenes/system/Planet'
import { Pulsar } from '@/scenes/system/Pulsar'
import { PlanetCalloutProjector } from '@/scenes/system/PlanetCalloutProjector'
import { simClock } from '@/scenes/system/simClock'
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
/**
 * 주변광 (O-2) — 우주 공간의 행성 밤면은 검정에 가깝다. 0.9는 밤면·위상을 붕괴시켰으므로
 * 잔광 수준(0.15)으로 낮춘다 — 행성 위상(초승달~보름)이 포인트라이트만으로 자연 발생한다.
 * 색은 주성 별빛색으로 틴트해 산란광의 근원을 따른다.
 */
const AMBIENT_INTENSITY = 0.15

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
/**
 * 다중성계 중력 모드에서 최내곽 행성이 성단 반경의 이 배수 밖을 돌게 한다 — circumbinary
 * P-type 안정 궤도(Holman-Wiegert 근사). 이 아래는 이심률 펌핑 지대라 궤도가 다이브·별 관통한다.
 */
const SAFE_ORBIT_FACTOR = 2
/** 하드 플로어 = 성단 반경 + 별 반경 + 이 여유 — 병리적 섭동에도 관통 막는 안전망 마진. */
const PLANET_FLOOR_MARGIN = 2

/**
 * 트레일 점 간격(초) — 원궤도 주기 T=2π√(R³/gm)의 TRAIL_ORBITS바퀴를 TRAIL_POINTS점에 분배한다.
 * 궤도가 클수록 주기가 길어 간격이 커지므로 트레일이 시간상 자동으로 길어진다(궤도 크기 비례).
 */
function orbitTrailSampleDt(radius: number, gm: number): number {
  if (radius <= 0 || gm <= 0) return SIM_DT * 4
  const period = (2 * Math.PI * Math.pow(radius, 1.5)) / Math.sqrt(gm)
  return (TRAIL_ORBITS * period) / TRAIL_POINTS
}

interface BodyVisual {
  readonly key: string
  readonly color: string
  readonly radius: number
  readonly lightFactor: number
  /** 별 종류 — 주성만 이색 가능, 동반성은 항상 main_sequence (결정 7). */
  readonly kind: StarKind
  /** point light 색 — 블랙홀은 강착원반 발광색으로 행성을 비춘다(본체는 검은 구). */
  readonly lightColor: string
  /** 입상반 진폭 (O-6) — 주계열성만 분광 파생, 이색 천체는 1(기존 렌더 불변). */
  readonly granulation: number
  /** 림 다크닝 저온층 색 (O-6) — 주계열성만 분광 파생, 이색 천체는 본체 색 그대로. */
  readonly rimColor: string
}

/** 블랙홀 강착원반 발광색 — 검은 본체 대신 이 따뜻한 빛이 행성·동반성을 비춘다. */
const BLACK_HOLE_LIGHT_COLOR = '#ffcaa0'
// 암흑 블랙홀 광원색(#4a4a5e — 원반 없는 고립 BH의 냉광)은 dark variant와 함께 백업.
/** 강착원반 안/바깥 반경 배수 (rs 기준) — 레이마칭 lens 게시·궤도 클리어런스 공용. */
const BH_DISK_INNER_FACTOR = 2.5
const BH_DISK_OUTER_FACTOR = 18.0
/** 항성풍 포획 원반(아케론, 백업) — 오버플로 원반보다 작고 어둡다 (Cyg X-1형). */
const WIND_DISK_OUTER_FACTOR = 11.0
const WIND_DISK_GAIN = 0.55
/**
 * BH별 결정론 변주 (렌즈 업그레이드) — starId 해시 파생, 렌더 전용(GEN_VERSION 무관).
 * 랜덤이 정당한 요소만 변주한다:
 *  - 기울기: BH 스핀축은 강착 역사의 산물이라 궤도면과 무관한 방향 (Bardeen–Petterson) —
 *    ±5°~29°, Z축(함교 시선축) 회전이라 측면 프로필이 비스듬히 기운다.
 *  - 폭·밝기·온도(색): 강착률·질량 차이의 발현. 색은 흑체 궤적 위에서만(앰버-적↔금↔청백).
 * 원반 "유무"는 변주하지 않는다 — 그건 환경(동반성) 파생이어야 하는 요소로 유니크계
 * 재투입 PR의 몫 (N-2 관통 원칙: 상태는 랜덤 롤이 아니라 환경에서).
 */
const BH_TILT_MIN = 0.09
const BH_TILT_SPAN = 0.42
const BH_DISK_OUTER_MIN = 14.0
const BH_DISK_OUTER_SPAN = 7.0
const BH_GAIN_MIN = 0.75
const BH_GAIN_SPAN = 0.45
const BH_TEMP_MIN = 0.55
const BH_TEMP_SPAN = 1.1

/** 문자열 → [0,1) 결정론 해시 — 렌더 전용 변주 시드 (엔진 rng와 무관, 전역 난수 아님). */
function hash01(input: string, salt: number): number {
  let h = 2166136261 ^ salt
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(h ^ input.charCodeAt(i), 16777619)
  }
  return ((h >>> 0) % 100_000) / 100_000
}
/** 카리브디스 반성의 조석 티어드롭 강도 — L1 쪽 최대 반경 +42% (로슈엽 충만 별). */
const COMPANION_TIDAL_STRETCH = 0.42

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
  // 적분 substep 전용 별 위치 버퍼 — 렌더 프레임 버퍼(bodyScratch)와 분리해, 적분 루프가
  // substep 시각(simTime)의 별 위치로 덮어써도 렌더/게시 좌표가 오염되지 않게 한다.
  const simBodyScratch = useMemo(
    () => Array.from({ length: MAX_BODIES }, () => new Vector3()),
    [],
  )
  const systemScaleRef = useRef(SHIP_SYSTEM_SCALE)
  // 다중성계 행성 중력 적분 상태 — 슬롯 사전 할당(useFrame 무할당). simTime은 로컬 적분 시계,
  // seededStar는 재시드 트리거(별 변경·재진입 시 초기조건 리셋).
  const planetStatesRef = useRef(Array.from({ length: MAX_PLANETS }, createOrbitState))
  const simTimeRef = useRef(0)
  const seededStarRef = useRef<string | null>(null)
  // 트레일 역적분 프리롤 전용 임시 상태 (라이브 상태를 건드리지 않고 과거 경로만 계산).
  const trailScratchRef = useRef(createOrbitState())

  const star = useMemo(() => starById(seed, starId), [seed, starId])
  const planets = useMemo(() => planetsOf(seed, starId), [seed, starId])
  // 소행성대 — 궤도 갭(암석대)·최외곽 행성 바깥(카이퍼대). 행성과 같은 중심(궤도 그룹) 기준.
  const belts = useMemo(() => beltsOf(seed, starId), [seed, starId])
  // 블랙홀 상태 — 렌즈 업그레이드 PR 재범위로 절차 BH 암흑화는 백업: 기본값을 'disk'
  // (기존 룩: 모든 BH가 원반)로 되돌린다. 'dark'(고립 BH 렌즈만)·'feeding'(스트림)은
  // 유니크계 재투입 PR에서 레지스트리 파생으로 복원 (variant 배관은 전부 보존).
  const unique = uniqueSystemOf(starId)
  const bhVariant: BlackHoleVariant = unique?.id === 'feeding_bh' ? 'feeding' : 'disk'
  // 블랙홀은 행성을 숨긴다 — 강착원반이 내행성 궤도와 겹치고 천문학적으로도 이례적이다
  // (펄서·왜성·거성은 행성 유지). 유니크계도 동일 — 엔진이 행성을 아예 안 만든다(planetsOf,
  // 초신성이 행성계를 파괴). planetsOf는 무변경이라 골든·결정론 무관(렌더 전용).
  const showPlanets = scene.kind === 'galaxy' && star?.kind !== 'black_hole'
  const worldPosition = useMemo(
    () => starWorldPosition(seed, starId) ?? ([0, 0, 0] as const),
    [seed, starId],
  )
  const circumbinary = useMemo(() => (star == null ? false : isCircumbinary(star)), [star])

  // 별 본체가 안 보이는 동안(언마운트·워프) 레지스트리를 비운다 — stale 좌표 방지.
  useEffect(() => clearCurrentBodies, [])
  // 언마운트 시 행성 중력 게시본 비활성 — 소비자가 stale 적분 좌표를 읽지 않게.
  useEffect(() => clearCurrentPlanetOrbits, [])
  // 언마운트 시 중력렌즈 비활성 (stale 활성 방지).
  useEffect(() => clearBlackHoleLens, [])
  // 다중성계 중력 모드 — 별이 2개 이상일 때만 행성을 실제 중력으로 적분한다(단일성은 케플러 유지,
  // multi-star-gravity N-1). 블랙홀계는 showPlanets가 false라 자동 제외.
  const isGravityMode = star != null && showPlanets && star.multiplicity !== 'single'
  // 궤도 표시 정규화 (사실성 v2 O-1·N-3) — 엔진 물리 AU를 v10과 같은 시각 간격으로 되돌린다.
  const orbitDisplay = useMemo(() => orbitDisplayOf(star), [star])
  // 행성 궤도를 별 군집 밖으로 미는 양 (별/행성 관통 방지). 단일성계는 planetClearanceOffset 그대로.
  // 중력 모드는 최내곽 행성을 성단 반경의 SAFE_ORBIT_FACTOR배 밖으로 추가로 민다 — 엔진이 이미
  // 안정 오프셋(N-3)을 orbitAu에 넣지만 표시 정규화가 그것을 빼므로, 렌더 좌표계의 군집 회피는
  // 이 안전망이 계속 맡는다. 행성 간 간격은 균일 오프셋이라 보존된다.
  const orbitOffset = useMemo(() => {
    if (star == null) return 0
    const base = planetClearanceOffset(star)
    if (!isGravityMode || planets.length === 0) return base
    const innermostAu = planets.reduce((min, planet) => Math.min(min, planet.orbitAu), Infinity)
    // Holman–Wiegert P-type 안정 하한(stableOrbitFloor)이 시각 회피(2×성단반경)보다 바깥이면
    // 그쪽을 쓴다 — 케플러 정합(P-1) 후 임계 안쪽 행성은 실제로 카오스 킥·클램프 꺾임이 발생.
    const requiredInner = Math.max(
      SAFE_ORBIT_FACTOR * stellarClearanceRadius(star),
      stableOrbitFloor(star),
    )
    const currentInner = auToOrbitRadius(innermostAu, base, orbitDisplay)
    return base + Math.max(0, requiredInner - currentInner)
  }, [star, isGravityMode, planets, orbitDisplay])
  // 중력원(별) — position은 simBodyScratch 슬롯을 가리키는 *라이브 별칭*이다. 적분 루프가 매
  // substep bodyPositions로 simBodyScratch를 갱신하면 attractor 위치가 자동으로 따라온다
  // (좌표를 복사해 캐시하면 안 됨 — 이 별칭 계약이 fps 독립 적분의 핵심).
  const gravityAttractors = useMemo<readonly Attractor[]>(() => {
    if (star == null) return []
    const masses = [massOf(star.spectral), ...star.companions.map((c) => massOf(c.spectral))]
    return masses.map((mass, index) => ({ position: simBodyScratch[index] as Vector3, mass }))
  }, [star, simBodyScratch])
  // gm = G_RENDER × 총 항성 질량 — 원궤도 시드 속도 √(gm/R) 산출용.
  const totalGm = useMemo(
    () => G_RENDER * gravityAttractors.reduce((sum, attractor) => sum + attractor.mass, 0),
    [gravityAttractors],
  )
  // 행성별 트레일 점 간격(초) — 프리롤·OrbitTrail 공용. 궤도 반경(=주기)에 비례해 길이 스케일.
  const trailSampleDts = useMemo(
    () =>
      planets.map((planet) =>
        orbitTrailSampleDt(orbitRadiusOf(planet, orbitOffset, orbitDisplay), totalGm),
      ),
    [planets, orbitOffset, orbitDisplay, totalGm],
  )
  // 행성별 위성 궤도 상한 — 가장 가까운 이웃 행성까지 궤도 간격의 안전 비율. 위성이 이웃
  // 궤도를 침범하지 않게 Planet이 이 값으로 외곽 스프레드를 압축한다 (렌더 전용).
  const moonOrbitLimits = useMemo(() => {
    const radii = planets.map((planet) => orbitRadiusOf(planet, orbitOffset, orbitDisplay))
    return radii.map((radius, index) => {
      let nearestGap = Infinity
      radii.forEach((otherRadius, other) => {
        if (other === index) return
        nearestGap = Math.min(nearestGap, Math.abs(radius - otherRadius))
      })
      return Number.isFinite(nearestGap) ? nearestGap * MOON_NEIGHBOR_SAFE_FRACTION : null
    })
  }, [planets, orbitOffset, orbitDisplay])
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
          granulation: 1,
          rimColor: '#ffffff',
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
      // 주계열성은 분광형 광도 로그 압축(O-4, G=1.0 불변). 이색 천체는 kindSurface가 담당.
      lightFactor: star.kind === 'main_sequence' ? SPECTRAL_LIGHT_FACTOR[star.spectral] : 1,
      kind: star.kind,
      // 암흑(dark) variant는 백업 — 현행 BH는 전부 원반 발광색. 재투입 시 dark 분기 복원
      // (DARK_BLACK_HOLE_LIGHT_COLOR — 원반 없는 고립 BH의 냉광).
      lightColor: star.kind === 'black_hole' ? BLACK_HOLE_LIGHT_COLOR : primaryColor,
      // 입상반 진폭·림 저온색은 주계열성만 분광 파생(O-6) — 이색 천체는 사용자 튜닝된
      // 기존 표면(진폭 1, 림 무채)을 유지한다.
      granulation:
        star.kind === 'main_sequence' ? SPECTRAL_SURFACE[star.spectral].granulation : 1,
      rimColor:
        star.kind === 'main_sequence' ? SPECTRAL_SURFACE[star.spectral].rimColor : primaryColor,
    }
    const companions = star.companions.map<BodyVisual>((companion, index) => ({
      key: `companion-${index}`,
      color: SPECTRAL_RENDER[companion.spectral].color,
      radius: bodyVisualRadius(companion.spectral, STAR_VISUAL_RADIUS),
      // 주성과 같은 분광형 광도 계수(O-4) — 질량 제곱근비 대신 문헌 광도 로그 압축으로 통일.
      lightFactor: SPECTRAL_LIGHT_FACTOR[companion.spectral],
      kind: 'main_sequence',
      lightColor: SPECTRAL_RENDER[companion.spectral].color,
      granulation: SPECTRAL_SURFACE[companion.spectral].granulation,
      rimColor: SPECTRAL_SURFACE[companion.spectral].rimColor,
    }))
    return [primary, ...companions]
  }, [star])

  // BH별 결정론 변주 — starId 해시 파생 (위 상수 주석 참조). 유니크계는 명시 파라미터 우선.
  const bhVariation = useMemo(() => {
    const tiltSign = hash01(starId, 11) < 0.5 ? -1 : 1
    return {
      tilt: tiltSign * (BH_TILT_MIN + hash01(starId, 7) * BH_TILT_SPAN),
      diskOuterFactor: BH_DISK_OUTER_MIN + hash01(starId, 13) * BH_DISK_OUTER_SPAN,
      diskGain: BH_GAIN_MIN + hash01(starId, 17) * BH_GAIN_SPAN,
      diskTemp: BH_TEMP_MIN + hash01(starId, 23) * BH_TEMP_SPAN,
    }
  }, [starId])

  // 동반성 렌즈 색 — 렌즈 셰이더의 해석적 구가 쓸 분광색 (매 프레임 문자열 파싱 방지 캐시).
  const companionLensColor = useMemo(
    () => new Color(bodies[1]?.color ?? '#ffffff'),
    [bodies],
  )

  // 코로나 글로우 반폭 상한 — 가산 코로나가 이웃 별 원반을 덮으면 뒤쪽 별에 초승달 위상
  // 착시가 생긴다(별에는 밤면이 없다). 이웃 근점 거리 기준 클램프, 단일성은 Infinity(불변).
  const coronaMax = useMemo(() => (star == null ? [Infinity] : coronaMaxRadii(star)), [star])

  // 트레일 프리롤 — 시드 상태에서 -SIM_DT로 역적분해 과거 경로를 currentPlanetOrbits.trails[slot]에
  // 채운다. head(index0)=시드 위치, 이후 슬롯일수록 과거. attractor는 각 과거 시각의 별 위치를
  // simBodyScratch에 샘플한다(라이브 적분과 동일 시계). 라이브 상태는 건드리지 않는다(temp 사용).
  const fillBackwardTrail = (
    slot: number,
    seedState: PlanetOrbitState,
    temp: PlanetOrbitState,
    star: Star,
    entryTime: number,
    sampleDt: number,
  ): void => {
    temp.pos.copy(seedState.pos)
    temp.vel.copy(seedState.vel)
    temp.home = seedState.home
    temp.floor = seedState.floor
    const trail = currentPlanetOrbits.trails[slot] as Float32Array
    trail[0] = temp.pos.x
    trail[1] = temp.pos.y
    trail[2] = temp.pos.z
    // 점당 1 coarse 스텝(dt=sampleDt)으로 역적분 — 심플렉틱이라 이 해상도에서도 궤도가 안정적이고,
    // 진입 스텝 수가 궤도 주기와 무관하게 TRAIL_POINTS로 고정돼 히치가 없다. 라이브 간격과 동일.
    const dt = sampleDt > 0 ? sampleDt : SIM_DT * 4
    for (let i = 1; i < TRAIL_POINTS; i++) {
      bodyPositions(star, entryTime - i * dt, simBodyScratch)
      stepOrbit(temp, gravityAttractors, -dt)
      trail[i * 3] = temp.pos.x
      trail[i * 3 + 1] = temp.pos.y
      trail[i * 3 + 2] = temp.pos.z
    }
  }

  useFrame((state, delta) => {
    const group = systemGroupRef.current
    if (group == null) return

    // 배속 시계 — 별 위치·행성 적분을 함께 구동한다 (simulation-speed). SimClock이 clamp된 실시간
    // delta×timeScale로 누적하므로 탭 복귀 점프를 흡수하고 배속·일시정지가 그대로 반영된다.
    const simNow = simClock.now

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
      const bodyCount = bodyPositions(star, simNow, bodyScratch)
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
      // 조석 변형 방향 게시 (카리브디스) — 반성 StarSurface가 uTidalDir로 읽어 L1 팁을
      // 블랙홀 쪽으로 늘인다. BH·반성 모두 질량중심을 돌므로 매 프레임 갱신.
      if (bhVariant === 'feeding' && bodyCount > 1) {
        const bhLocal = bodyScratch[0] as Vector3
        const companionLocal = bodyScratch[1] as Vector3
        const tideDx = bhLocal.x - companionLocal.x
        const tideDz = bhLocal.z - companionLocal.z
        const tideLen = Math.sqrt(tideDx * tideDx + tideDz * tideDz)
        if (tideLen > 1e-6) {
          companionTide.dirX = tideDx / tideLen
          companionTide.dirZ = tideDz / tideLen
        }
      }
      // 행성 궤도 중심 — 항상 질량중심(원점) 공전 (circumbinary, 결정 8 개정).
      const center = planetCenterRef.current
      if (center != null) {
        if (circumbinary) center.position.set(0, 0, 0)
        else center.position.copy(bodyScratch[0] as Vector3)
      }
    } else if (isWarping) {
      clearCurrentBodies()
    }

    // 다중성계 행성 중력 적분 — 움직이는 별들의 실제 중력을 고정 타임스텝으로 적분해 게시한다
    // (multi-star-gravity N-1). 단일성계는 진입하지 않아 기존 케플러 경로가 픽셀 불변.
    if (isGravityMode && star != null && !isWarping) {
      const states = planetStatesRef.current
      const planetCount = Math.min(planets.length, MAX_PLANETS)
      // 진입·별 변경 시 재시드 — 각 행성을 궤도 반경 위 원궤도 초기조건으로.
      if (seededStarRef.current !== starId) {
        const trailScratch = trailScratchRef.current
        // 하드 플로어 — 성단 밖. 시드 반경이 이미 이보다 크지만, 병리적 섭동 시 관통 전에 클램프.
        const orbitFloor = stellarClearanceRadius(star) + STAR_VISUAL_RADIUS + PLANET_FLOOR_MARGIN
        // 시드는 실제 합력 기준(seedLocalCircularOrbit) — 점질량 √(gm/R)과 실제 쌍성 퍼텐셜의
        // 어긋남이 인위적 이심률이 되는 것을 막는다. attractor(simBodyScratch 별칭)를 시드 시각의
        // 별 위치로 먼저 채운다. 트레일 프리롤은 simBodyScratch를 과거 시각으로 덮으므로 별도 루프.
        bodyPositions(star, simNow, simBodyScratch)
        for (let i = 0; i < planetCount; i++) {
          const planet = planets[i]
          if (planet == null) continue
          seedLocalCircularOrbit(
            states[i] as PlanetOrbitState,
            orbitRadiusOf(planet, orbitOffset, orbitDisplay),
            orbitInitialPhase(planet),
            gravityAttractors,
            totalGm,
            orbitFloor,
          )
        }
        for (let i = 0; i < planetCount; i++) {
          if (planets[i] == null) continue
          // 트레일 프리롤 — 시드 상태에서 시간을 거꾸로(-SIM_DT) 적분해 '과거 경로'를 채운다.
          // velocity-Verlet은 시간 가역이라 실제 지나왔을 궤적이 나온다(빈 트레일 시작 방지).
          fillBackwardTrail(
            i,
            states[i] as PlanetOrbitState,
            trailScratch,
            star,
            simNow,
            trailSampleDts[i] ?? SIM_DT * 4,
          )
        }
        currentPlanetOrbits.trailGeneration++
        simTimeRef.current = simNow
        seededStarRef.current = starId
      }
      // 고정 타임스텝 캐치업 — 총 스텝 수 = (simNow − 시드시각)/SIM_DT라 프레임레이트와 무관하다.
      // attractor는 각 substep 시각의 별 위치를 simBodyScratch(렌더 버퍼와 분리)에 샘플한다.
      let steps = 0
      while (simTimeRef.current < simNow && steps < MAX_SUBSTEPS_PER_FRAME) {
        bodyPositions(star, simTimeRef.current, simBodyScratch)
        for (let i = 0; i < planetCount; i++) {
          stepOrbit(states[i] as PlanetOrbitState, gravityAttractors, SIM_DT)
        }
        simTimeRef.current += SIM_DT
        steps++
      }
      // 장시간 히치는 스냅 — death spiral 방지(1프레임 desync 허용, 앰비언트라 무감지).
      if (simTimeRef.current < simNow - SIM_DT) simTimeRef.current = simNow
      // 게시 — Planet 렌더·PlanetCalloutProjector가 읽는 단일 소스(로컬=질량중심 상대).
      currentPlanetOrbits.starId = starId
      currentPlanetOrbits.active = true
      currentPlanetOrbits.count = planetCount
      for (let i = 0; i < planetCount; i++) {
        ;(currentPlanetOrbits.localPositions[i] as Vector3).copy((states[i] as PlanetOrbitState).pos)
      }
    } else {
      clearCurrentPlanetOrbits()
      seededStarRef.current = null
      simTimeRef.current = 0
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
      // BH 실제 위치 = 질량중심 + 주성 로컬 오프셋 — 쌍성 BH(유니크계)는 질량중심을 돌므로
      // 질량중심(worldPosition)만 쓰면 그림자·렌즈가 어긋난다 (단일성은 오프셋 0으로 동일).
      const lensScale = systemScaleRef.current
      const bhLocal = bodyScratch[0] as Vector3
      const bhX = worldPosition[0] + bhLocal.x * lensScale
      const bhY = worldPosition[1] + bhLocal.y * lensScale
      const bhZ = worldPosition[2] + bhLocal.z * lensScale
      blackHoleLens.bhPos.set(bhX, bhY, bhZ)
      const rs = (bodies[0]?.radius ?? STAR_VISUAL_RADIUS) * systemScaleRef.current
      blackHoleLens.rs = rs
      // 디스크 안쪽을 그림자(BCRIT≈4.8 rs)보다 훨씬 안까지 끌어내려 검은 구에 바짝 붙인다(갭 제거).
      // 전체 크기는 rs(kindRadiusFactor)로 조절.
      blackHoleLens.diskInner = rs * BH_DISK_INNER_FACTOR
      // 원반 파라미터 — 절차 BH는 해시 변주(bhVariation), 유니크 아케론(백업)은 명시값.
      blackHoleLens.diskOuter =
        rs * (unique?.id === 'disk_bh' ? WIND_DISK_OUTER_FACTOR : bhVariation.diskOuterFactor)
      blackHoleLens.diskGain = unique?.id === 'disk_bh' ? WIND_DISK_GAIN : bhVariation.diskGain
      blackHoleLens.diskTilt = bhVariation.tilt
      blackHoleLens.diskTemp = unique != null ? 1 : bhVariation.diskTemp
      // 암흑화(dark = 원반 없는 고립 BH)는 백업 — 현행은 전 BH 원반 (uDiskEnabled 배관 보존).
      blackHoleLens.diskEnabled = true
      blackHoleLens.diskNormal.set(0, 1, 0)
      // 로슈엽 물질 스트림 (카리브디스) — 씬 파티클은 레이마칭 전담 영역에 덮여 사라지므로
      // 스트림 파라미터를 게시해 레이마칭이 원반과 같은 평면 히트로 직접 그린다.
      if (bhVariant === 'feeding' && star != null && star.companions.length > 0) {
        const companionLocal = bodyScratch[1] as Vector3
        const streamDx = (companionLocal.x - bhLocal.x) * lensScale
        const streamDz = (companionLocal.z - bhLocal.z) * lensScale
        const companionRadius = (bodies[1]?.radius ?? 0) * lensScale
        blackHoleLens.streamAngle = Math.atan2(streamDz, streamDx)
        // 별 실루엣 깊숙이(0.75R)에서 출발 — 티어드롭 팁과 겹쳐 한 흐름으로 읽힌다.
        blackHoleLens.streamStartR =
          Math.sqrt(streamDx * streamDx + streamDz * streamDz) - companionRadius * 0.75
        blackHoleLens.streamEnabled = true
      } else {
        blackHoleLens.streamEnabled = false
      }
      // 동반성 해석적 구 게시 (렌즈 리팩터) — 마처가 원반처럼 직접 그린다. 앞/뒤 판정
      // 불필요: 광선-구 교차가 가림·아인슈타인 상을 물리대로 처리한다.
      if (star != null && star.companions.length > 0) {
        const companionLocal = bodyScratch[1] as Vector3
        blackHoleLens.companionPos.set(
          worldPosition[0] + companionLocal.x * lensScale,
          worldPosition[1] + companionLocal.y * lensScale,
          worldPosition[2] + companionLocal.z * lensScale,
        )
        blackHoleLens.companionRadius = (bodies[1]?.radius ?? 1) * lensScale
        blackHoleLens.companionColor.copy(companionLensColor)
        blackHoleLens.companionActive = true
      } else {
        blackHoleLens.companionActive = false
      }
      ndcScratch.set(bhX, bhY, bhZ).project(cam)
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
      <ambientLight intensity={AMBIENT_INTENSITY} color={bodies[0]?.lightColor ?? '#ffffff'} />

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
                  <BlackHole radius={body.radius} variant={bhVariant} />
                ) : body.kind === 'pulsar' ? (
                  <Pulsar radius={body.radius} color={body.color} />
                ) : (
                  // 주계열성·적색거성·백색왜성 — 표면 발광/코로나만 kind로 변조 (결정 4).
                  // main_sequence는 {1,1}이라 기존 단일 항성 렌더가 한 픽셀도 안 바뀐다.
                  <StarSurface
                    radius={body.radius}
                    color={body.color}
                    emissiveBoost={kindSurface(body.kind).emissiveBoost}
                    // 코로나도 광도를 따라 √배 스케일(O-4) — M 왜성은 작게, O형은 크게. G=1 불변.
                    coronaScale={kindSurface(body.kind).coronaScale * Math.sqrt(body.lightFactor)}
                    // 입상반 진폭·림 저온색 분광 파생(O-6) — O/B 복사 외피는 매끈, 림은 붉게.
                    granulation={body.granulation}
                    rimColor={body.rimColor}
                    // 유니크 BH계 동반성은 코로나를 별에 바짝 클램프 — 코로나는 깊이를 안
                    // 쓰는 가산 글로우라 레이마칭 배경 샘플에 걸려, 동반성이 BH 앞에 있을 때
                    // 반대편에 반투명 유령 호(비고증 — 전경 광원은 렌즈상 없음)로 맺힌다.
                    // 글로우를 줄이면 유령이 소멸하고 렌즈·아인슈타인 호(핵)는 그대로다.
                    // 1.0R = 글로우가 별 원반 뒤에 숨는다 — 1.4R 잔여 고리가 동반성이 BH
                    // 정면에 올 때 렌즈 주변 색 띠(글로우 고리의 아인슈타인 링)로 맺혔다.
                    maxCoronaRadius={
                      unique != null && index > 0
                        ? Math.min(coronaMax[index] ?? Infinity, body.radius)
                        : coronaMax[index] ?? Infinity
                    }
                    // 카리브디스 반성 — 로슈엽 충만 티어드롭 (L1 팁이 블랙홀을 향해 늘어난다).
                    tidalStretch={
                      bhVariant === 'feeding' && index === 1 ? COMPANION_TIDAL_STRETCH : 0
                    }
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

        {/* 로슈엽 물질 스트림 — 카리브디스(feeding) 전용. 자체 useFrame이 BH·반성 위치를
            bodyPositions(동일 수식·simClock)로 계산해 별 위치와 항상 정합한다. */}
        {!isWarping && star != null && bhVariant === 'feeding' && bodies.length > 1 ? (
          <MatterStream
            star={star}
            bhRadius={(bodies[0] as BodyVisual).radius}
            companionRadius={(bodies[1] as BodyVisual).radius}
            diskOuterFactor={BH_DISK_OUTER_FACTOR}
          />
        ) : null}

        {showPlanets ? (
          <group ref={planetCenterRef}>
            {belts.map((belt) => (
              <AsteroidBelt
                key={belt.index}
                belt={belt}
                orbitOffset={orbitOffset}
                orbitDisplay={orbitDisplay}
              />
            ))}
            {planets.map((planet, index) => (
              <group key={planet.id}>
                {/* 다중성계는 실제 적분 궤적 트레일, 단일성계는 정확한 케플러 원(OrbitRing). */}
                {isGravityMode ? (
                  <OrbitTrail orbitIndex={index} sampleDt={trailSampleDts[index] ?? 0} />
                ) : (
                  <OrbitRing radius={orbitRadiusOf(planet, orbitOffset, orbitDisplay)} />
                )}
                <Planet
                  planet={planet}
                  orbitOffset={orbitOffset}
                  hzSpectral={hzSpectral}
                  moonOrbitLimit={moonOrbitLimits[index]}
                  gravityOrbitIndex={isGravityMode ? index : null}
                  orbitDisplay={orbitDisplay}
                />
              </group>
            ))}
          </group>
        ) : null}
      </group>

      {/* Planet 렌더·콜아웃 모두 CurrentSystem의 자식이라 currentPlanetOrbits를 동일하게 읽는다.
          발행(CurrentSystem useFrame)과 소비 사이 최대 1프레임 지연이 있으나 둘이 같은 값을 읽어
          상호 동기가 유지되고, circumbinary 대반경 저속 궤도라 절대 지연도 무감지다. */}
      {showPlanets ? <PlanetCalloutProjector /> : null}
    </>
  )
}
