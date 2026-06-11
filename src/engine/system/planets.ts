import type { PlanetId, Seed, StarId } from '../coords'
import { makePlanetId, parsePlanetId } from '../coords'
import { planetName } from '../naming/names'
import type { WeightedEntry } from '../rng/streams'
import { rngFor } from '../rng/streams'

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
}

const MAX_PLANETS_PER_SYSTEM = 8
/** 행성당 생명체 확률 (01-spec.md 핵심 수치). */
export const LIFE_PROBABILITY = 0.1

const KIND_WEIGHTS: readonly WeightedEntry<PlanetKind>[] = [
  { value: 'rocky', weight: 60 },
  { value: 'gas', weight: 40 },
]

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
 */
export function planetsOf(seed: Seed, starId: StarId): readonly Planet[] {
  const countRng = rngFor(seed, 'planets', starId)
  const count = 1 + countRng.int(MAX_PLANETS_PER_SYSTEM)

  const planets: Planet[] = []
  for (let index = 0; index < count; index++) {
    const id = makePlanetId(starId, index)
    const rng = rngFor(seed, 'planet', id)
    // append-only draw 순서: kind → hasLife → radius → orbit → paletteSeed
    const kind = rng.weighted(KIND_WEIGHTS)
    const hasLife = rng.next() < LIFE_PROBABILITY
    const radius =
      kind === 'rocky'
        ? ROCKY_RADIUS_MIN + rng.next() * ROCKY_RADIUS_SPAN
        : GAS_RADIUS_MIN + rng.next() * GAS_RADIUS_SPAN
    const orbitAu = (index + 1) * ORBIT_BASE_AU + rng.next() * ORBIT_JITTER_AU
    const paletteSeed = rng.int(2147483647)
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
