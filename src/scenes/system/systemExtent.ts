import type { Planet as PlanetData, Seed, StarId, Star } from '@/engine'
import { beltsOf, planetsOf, starById } from '@/engine'
import {
  planetClearanceOffset,
  stableOrbitFloor,
  stellarClearanceRadius,
} from '@/scenes/system/multiplicity'
import type { OrbitDisplay } from '@/scenes/system/Planet'
import { auToOrbitRadius, orbitDisplayOf, orbitRadiusOf } from '@/scenes/system/Planet'

/**
 * 항성계 표시 범위 (misc-ux) — CurrentSystem(렌더 배치)과 ShipCameraRig 도착 프레이밍이
 * 같은 궤도 오프셋·외곽 반경을 읽는 단일 소스. 전부 렌더 파생 — GEN_VERSION 무관.
 */

/**
 * 다중성계 중력 모드에서 최내곽 행성이 성단 반경의 이 배수 밖을 돌게 한다 — circumbinary
 * P-type 안정 궤도(Holman-Wiegert 근사). 이 아래는 이심률 펌핑 지대라 궤도가 다이브·별 관통한다.
 */
export const SAFE_ORBIT_FACTOR = 2

/**
 * 행성 궤도를 별 군집 밖으로 미는 양 (별/행성 관통 방지). 단일성계는 planetClearanceOffset
 * 그대로. 중력 모드는 최내곽 행성을 성단 반경의 SAFE_ORBIT_FACTOR배 밖으로 추가로 민다 —
 * 엔진이 이미 안정 오프셋(N-3)을 orbitAu에 넣지만 표시 정규화가 그것을 빼므로, 렌더
 * 좌표계의 군집 회피는 이 안전망이 계속 맡는다. 행성 간 간격은 균일 오프셋이라 보존된다.
 */
export function systemOrbitOffset(
  star: Star | null,
  planets: readonly PlanetData[],
  orbitDisplay: OrbitDisplay,
  isGravityMode: boolean,
): number {
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
}

/** 행성도 벨트도 없는 계의 최소 외곽 반경 — 별 본체(코로나 포함)가 화면에 들어오는 여유. */
const MIN_SYSTEM_EXTENT = 8

/**
 * 계의 표시 외곽 반경 — 최외곽 행성 궤도·벨트 바깥 경계·다중성 성단 반경 중 최댓값.
 * CurrentSystem과 동일한 오프셋·표시 정규화를 거치므로 실제 렌더 배치와 일치한다.
 */
export function systemExtentOf(seed: Seed, starId: StarId): number {
  const star = starById(seed, starId)
  if (star == null) return MIN_SYSTEM_EXTENT
  const planets = planetsOf(seed, starId)
  const orbitDisplay = orbitDisplayOf(star)
  const isGravityMode = star.multiplicity !== 'single'
  const orbitOffset = systemOrbitOffset(star, planets, orbitDisplay, isGravityMode)

  let extent = Math.max(MIN_SYSTEM_EXTENT, stellarClearanceRadius(star))
  for (const planet of planets) {
    extent = Math.max(extent, orbitRadiusOf(planet, orbitOffset, orbitDisplay))
  }
  for (const belt of beltsOf(seed, starId)) {
    extent = Math.max(extent, auToOrbitRadius(belt.outerAu, orbitOffset, orbitDisplay))
  }
  return extent
}

/**
 * 도착 프레이밍 (misc-ux) — 함교 정박 줌·시선 고도를 계의 외곽 반경에 맞춘다.
 * 기준: 정박 거리 82유닛(zoom 1.0)이 태양계 해왕성 궤도(≈53유닛)를 프레이밍하도록
 * 설계됐으므로(ShipCameraRig SHIP_DISTANCE), zoom = 외곽/53을 그 비율의 재사용으로 둔다.
 * 작은 계일수록 가까이 정박하고, 가까울수록 살짝 더 내려다봐(고도↑) 궤도면이 펼쳐 보인다.
 */
export interface ArrivalFraming {
  /** 정박 줌 배율 — ShipCameraRig initialZoom ([FIT_ZOOM_MIN, 1]). */
  readonly zoom: number
  /** 시선 고도(도) — ShipCameraRig elevationDeg. */
  readonly elevationDeg: number
}

/** zoom 1.0이 프레이밍하는 외곽 반경 (태양계 해왕성 궤도 ≈53유닛 — 기존 고정 프레이밍과 동치). */
const FULL_ZOOM_EXTENT = 53
/** 외곽 여유 배수 — 위성 스프레드·행성 시각 반경이 화면 가장자리에 닿지 않게. */
const FIT_MARGIN = 1.12
/** 동적 피팅 하한 — 초소형 계도 이 이하로는 붙지 않는다 (별 크기 대비 과도 확대 방지). */
const FIT_ZOOM_MIN = 0.45
/** 시선 고도 범위(도) — 최대 줌인(소형 계) 38° ~ 정박 프레이밍(대형 계) 28°. */
const ELEVATION_NEAR_DEG = 38
const ELEVATION_FAR_DEG = 28

export function arrivalFramingOf(seed: Seed, starId: StarId): ArrivalFraming {
  const rawZoom = (systemExtentOf(seed, starId) * FIT_MARGIN) / FULL_ZOOM_EXTENT
  const zoom = Math.min(1, Math.max(FIT_ZOOM_MIN, rawZoom))
  // zoom [MIN, 1] → 고도 [NEAR, FAR] 선형 보간 — 가까울수록 내려다본다.
  const closeness = (1 - zoom) / (1 - FIT_ZOOM_MIN)
  const elevationDeg =
    ELEVATION_FAR_DEG + (ELEVATION_NEAR_DEG - ELEVATION_FAR_DEG) * closeness
  return { zoom, elevationDeg }
}
