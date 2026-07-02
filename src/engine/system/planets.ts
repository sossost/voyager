import type { PlanetId, Seed, StarId } from '../coords'
import { makePlanetId, parsePlanetId } from '../coords'
import { starById } from '../galaxy/position'
import type { SpectralClass, Star } from '../galaxy/sectors'
import { planetName } from '../naming/names'
import type { WeightedEntry } from '../rng/streams'
import { rngFor } from '../rng/streams'
import { SOL_STAR_ID, SOLAR_SYSTEM_PLANETS } from './sol'

export type PlanetKind = 'rocky' | 'gas'

export interface Planet {
  readonly id: PlanetId
  readonly starId: StarId
  readonly index: number
  readonly kind: PlanetKind
  /** 상대 반지름 — 암석형 0.4~1.6, 가스형 2.0~5.0. */
  readonly radius: number
  /** 궤도 반경 (AU 근사) — 안쪽부터 바깥쪽으로 단조 증가. */
  readonly orbitAu: number
  readonly hasLife: boolean
  readonly name: string
  /** 시각 표현(텍스처/색)용 시드 — 게임플레이에는 영향 없음. */
  readonly paletteSeed: number
  /** 인류의 고향 — hasLife이지만 외계 생명체 없음 (지구 전용 예외). */
  readonly isHomeWorld?: boolean
  /** 행성 적도 고리 — Sol 토성 전용 시각 효과. */
  readonly hasRings?: boolean
}

const MAX_PLANETS_PER_SYSTEM = 8
const INT32_MAX = 2_147_483_647

const ROCKY_RADIUS_MIN = 0.4
const ROCKY_RADIUS_SPAN = 1.2
const GAS_RADIUS_MIN = 2.0
const GAS_RADIUS_SPAN = 3.0
const ORBIT_BASE_AU = 0.6
const ORBIT_JITTER_AU = 0.4

/**
 * 거주가능구역(HZ) 기반 생명 확률 (백로그 M-2·M-3 — 고증, GEN_VERSION 10).
 *
 * 균일 10%를 폐기하고, 별 광도로 정한 HZ 중심에 대한 궤도 위치의 연속 함수로 대체한다.
 * 광도 L은 스펙트럼당 상수라 HZ 중심(≈√L AU)도 상수 — 런타임 sqrt/초월함수 없이 사전계산
 * 상수표로 둔다. O/B는 getLifeProbability에서 short-circuit되어 표의 O/B 값은 미사용(참고용).
 */
const HZ_CENTER_AU: Record<SpectralClass, number> = {
  O: 15,
  B: 7,
  A: 4.5,
  F: 1.7,
  G: 1.0,
  K: 0.55,
  M: 0.2,
}

/** HZ 평지에서의 최대 생명 확률 (구 LIFE_PROBABILITY 대체 — 밸런스 튜닝 대상). */
export const HZ_PEAK_PROBABILITY = 0.45

// 정규화 궤도(= 궤도/HZ중심) 기준 거주성 곡선의 네 경계 — 안쪽 0 → 평지 1 → 바깥쪽 0.
// 보수적/낙관적 HZ 경계가 불분명한 실제 물리를 평지+가장자리 감쇠로 근사한다.
const HZ_X_ZERO_INNER = 0.5
const HZ_X_PLATEAU_INNER = 0.85
const HZ_X_PLATEAU_OUTER = 1.3
const HZ_X_ZERO_OUTER = 2.0

function clamp01(value: number): number {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

/** 5차 smootherstep — edge0..edge1을 0→1로 매끄럽게(경계에서 1·2계 도함수 0). 다항식만. */
function smootherstep01(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0))
  return t * t * t * (t * (t * 6 - 15) + 10)
}

/**
 * 정규화 궤도 x(= 궤도/HZ중심)의 거주성 계수 [0,1].
 * HZ 평지에서 1, 안팎 가장자리에서 smootherstep으로 0까지 감쇠.
 * (테스트용 export — 공개 배럴 index.ts에는 노출하지 않는다.)
 */
export function habitability(x: number): number {
  if (x <= HZ_X_ZERO_INNER || x >= HZ_X_ZERO_OUTER) return 0
  if (x < HZ_X_PLATEAU_INNER) return smootherstep01(HZ_X_ZERO_INNER, HZ_X_PLATEAU_INNER, x)
  if (x > HZ_X_PLATEAU_OUTER) return 1 - smootherstep01(HZ_X_PLATEAU_OUTER, HZ_X_ZERO_OUTER, x)
  return 1
}

/**
 * 행성 생명 확률 [0, HZ_PEAK_PROBABILITY]. 순수 — 초월함수·전역상태 없음.
 *
 * 무생명(확률 0):
 *   - null 별: 방어 (유효 starId면 도달 불가).
 *   - O/B 스펙트럼: 수명 수백만~수천만 년의 대질량성이라 복잡 생명 진화 시간이 없다(M-3).
 *     엔진상 펄서·블랙홀도 O/B 전용 생성이라 이 한 줄이 펄서·블랙홀 억제까지 전부 커버한다.
 *   - red_giant·white_dwarf: 진화 말기/잔해라 생명이 깃들 수 없다 (기존 v8 규칙 — 결정 8).
 * 그 외(A/F/G/K/M 주계열): HZ 중심 대비 명목 궤도 위치의 거주성 곡선 × 평지 최대 확률.
 *
 * 명목 궤도((index+1)·ORBIT_BASE_AU, jitter 제외)를 쓰는 이유: 생명 draw는 planet 스트림
 * 2번째라 궤도 draw(4번째)보다 앞서 실제 orbitAu가 아직 없다. jitter를 판정에 넣으려면 draw를
 * 앞당겨야 하고 이는 append-only 위반(철칙 3) — index 파생 명목값은 draw 없이 결정론적이다.
 *
 * (테스트용 export — 공개 배럴 index.ts에는 노출하지 않는다.)
 */
export function getLifeProbability(star: Star | null, index: number): number {
  if (star == null) return 0
  if (star.spectral === 'O' || star.spectral === 'B') return 0
  if (star.kind === 'red_giant' || star.kind === 'white_dwarf') return 0
  const normalizedOrbit = ((index + 1) * ORBIT_BASE_AU) / HZ_CENTER_AU[star.spectral]
  return HZ_PEAK_PROBABILITY * habitability(normalizedOrbit)
}

/**
 * 동결선(frost line) 기반 행성 종류 가중치 (GEN_VERSION 9, 백로그 M-1 — 고증).
 * 실제 원시행성계 원반은 눈선(~2.7AU) 안쪽에서 휘발성 물질이 증발해 암석 핵만,
 * 바깥쪽에서 얼음이 응결해 가스 거인이 자란다. 궤도 인덱스에 따라 가스 확률을
 * 선형으로 램프한다 — 최내행성은 암석 지배(가스 8%), 최외행성은 가스 지배(86%),
 * 교차점(가스 50%)은 index≈3.8 = orbitAu≈2.8AU로 실제 눈선에 근접.
 * 핫주피터가 드물게 존재하므로 내행성 가스 확률을 0으로 두지 않는다.
 */
const GAS_WEIGHT_INNER = 8
const GAS_WEIGHT_OUTER = 86
const GAS_WEIGHT_SPAN = GAS_WEIGHT_OUTER - GAS_WEIGHT_INNER

/**
 * 궤도 인덱스별 rocky/gas 가중치. weighted()는 테이블과 무관하게 next() 1회만
 * 소비하므로 index로 테이블을 바꿔도 draw 순서·개수는 불변 (append-only 유지).
 */
function kindWeightsAtIndex(index: number): readonly WeightedEntry<PlanetKind>[] {
  const t = index / (MAX_PLANETS_PER_SYSTEM - 1)
  const gasWeight = GAS_WEIGHT_INNER + GAS_WEIGHT_SPAN * t
  return [
    { value: 'rocky', weight: 100 - gasWeight },
    { value: 'gas', weight: gasWeight },
  ]
}

/**
 * 별 → 행성 목록 (1~8개). 순수 함수 — 같은 (seed, starId)는 항상 같은 행성계를 만든다.
 *
 * 행성 개수는 'planets' 스트림에서, 각 행성의 속성은 행성 자신의 'planet' 스트림에서
 * 뽑는다 (스트림 격리). 행성 속성 draw는 append-only — 순서 변경/삽입 금지.
 * Sol(SOL_STAR_ID)은 RNG 스트림 분리된 예외 노드 — 상수 반환.
 */
export function planetsOf(seed: Seed, starId: StarId): readonly Planet[] {
  if (starId === SOL_STAR_ID) return SOLAR_SYSTEM_PLANETS

  // 생명은 거주가능구역(HZ) 기반으로 결정한다 (getLifeProbability — M-2·M-3, 고증). O/B·죽은
  // 별은 확률 0이고, hasLife를 끄면 외계 조우·생명 렌더·통신 파동·힌트가 단일 소스(planet.hasLife)로
  // 전부 사라진다. 행성 자체는 유지(개수·궤도 불변) — 부적합 별을 도는 메마른 세계로 남는다.
  const star = starById(seed, starId)

  const countRng = rngFor(seed, 'planets', starId)
  const count = 1 + countRng.int(MAX_PLANETS_PER_SYSTEM)

  const planets: Planet[] = []
  for (let index = 0; index < count; index++) {
    const id = makePlanetId(starId, index)
    const rng = rngFor(seed, 'planet', id)
    // append-only draw 순서: kind → hasLife → radius → orbit → paletteSeed
    // kind 가중치는 궤도 인덱스 종속(동결선, M-1)이나 draw는 여전히 weighted() 1회.
    const kind = rng.weighted(kindWeightsAtIndex(index))
    // 부적합 별이어도 draw(rng.next())는 그대로 소비해 RNG 스트림·이후 속성·다른 행성을
    // 보존하고(append-only), 확률만 HZ 규칙으로 정한다 (블랙홀 단일성계 보정과 같은 패턴).
    const lifeRoll = rng.next()
    const hasLife = lifeRoll < getLifeProbability(star, index)
    const radius =
      kind === 'rocky'
        ? ROCKY_RADIUS_MIN + rng.next() * ROCKY_RADIUS_SPAN
        : GAS_RADIUS_MIN + rng.next() * GAS_RADIUS_SPAN
    const orbitAu = (index + 1) * ORBIT_BASE_AU + rng.next() * ORBIT_JITTER_AU
    const paletteSeed = rng.int(INT32_MAX)
    const name = planetName(rngFor(seed, 'name', id))

    planets.push({ id, starId, index, kind, radius, orbitAu, hasLife, name, paletteSeed })
  }
  return planets
}

/** PlanetId → 행성 데이터. 형식이 깨졌거나 존재하지 않는 인덱스면 null. */
export function planetById(seed: Seed, planetId: PlanetId): Planet | null {
  const parsed = parsePlanetId(planetId)
  if (parsed == null) return null
  return planetsOf(seed, parsed.starId)[parsed.planetIndex] ?? null
}
