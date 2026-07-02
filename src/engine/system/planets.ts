import type { PlanetId, Seed, StarId } from '../coords'
import { makePlanetId, parsePlanetId } from '../coords'
import { starById } from '../galaxy/position'
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
/** 행성당 생명체 확률 (01-spec.md 핵심 수치). */
export const LIFE_PROBABILITY = 0.1

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

const ROCKY_RADIUS_MIN = 0.4
const ROCKY_RADIUS_SPAN = 1.2
const GAS_RADIUS_MIN = 2.0
const GAS_RADIUS_SPAN = 3.0
const ORBIT_BASE_AU = 0.6
const ORBIT_JITTER_AU = 0.4

/**
 * 별 → 행성 목록 (1~8개). 순수 함수 — 같은 (seed, starId)는 항상 같은 행성계를 만든다.
 *
 * 행성 개수는 'planets' 스트림에서, 각 행성의 속성은 행성 자신의 'planet' 스트림에서
 * 뽑는다 (스트림 격리). 행성 속성 draw는 append-only — 순서 변경/삽입 금지.
 * Sol(SOL_STAR_ID)은 RNG 스트림 분리된 예외 노드 — 상수 반환.
 */
export function planetsOf(seed: Seed, starId: StarId): readonly Planet[] {
  if (starId === SOL_STAR_ID) return SOLAR_SYSTEM_PLANETS

  // 적색거성·백색왜성은 진화 말기/잔해라 생명이 깃들 수 없다 (exotic-stars 결정 8 — 고증).
  // 적색거성은 부풀며 내행성을 굽고, 백색왜성은 형성 과정에서 행성계가 교란된다. hasLife를
  // 끄면 외계 조우·생명 렌더·통신 파동·힌트가 단일 소스(planet.hasLife)로 전부 사라진다.
  // 행성 자체는 유지(planetsOf 개수·궤도 불변) — 죽은 별을 도는 메마른 세계로 남는다.
  const star = starById(seed, starId)
  const isSterileStar = star?.kind === 'red_giant' || star?.kind === 'white_dwarf'

  const countRng = rngFor(seed, 'planets', starId)
  const count = 1 + countRng.int(MAX_PLANETS_PER_SYSTEM)

  const planets: Planet[] = []
  for (let index = 0; index < count; index++) {
    const id = makePlanetId(starId, index)
    const rng = rngFor(seed, 'planet', id)
    // append-only draw 순서: kind → hasLife → radius → orbit → paletteSeed
    // kind 가중치는 궤도 인덱스 종속(동결선, M-1)이나 draw는 여전히 weighted() 1회.
    const kind = rng.weighted(kindWeightsAtIndex(index))
    // 죽은 별이어도 draw(rng.next())는 그대로 소비해 RNG 스트림·이후 속성·다른 행성을
    // 보존하고(append-only), 출력만 false로 덮어쓴다 (블랙홀 단일성계 보정과 같은 패턴).
    const lifeRoll = rng.next()
    const hasLife = !isSterileStar && lifeRoll < LIFE_PROBABILITY
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
