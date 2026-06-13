import type { PlanetId, Seed } from '../coords'
import type { WeightedEntry } from '../rng/streams'
import { rngFor } from '../rng/streams'
import type { Planet } from './planets'
import { SOL_STAR_ID, SOLAR_SYSTEM_MOONS } from './sol'

const INT32_MAX = 2_147_483_647

const NO_MOONS: readonly Moon[] = []

export interface Moon {
  readonly planetId: PlanetId
  readonly index: number
  /** 궤도 반경 팩터 [0,1) — 렌더에서 행성 시각 반경 기준 선형 스케일. */
  readonly orbitFactor: number
  /** 공전 초기 위상 팩터 [0,1) — 렌더에서 2π 곱해 라디안 변환. */
  readonly phaseFactor: number
  /** 시각 표현(색·크기 변주)용 시드. */
  readonly paletteSeed: number
  /** 실제 위성 이름 — 태양계 등 큐레이션된 위성에만 존재. 절차 생성 위성은 undefined. */
  readonly name?: string
}

const ROCKY_MOON_COUNT_WEIGHTS: readonly WeightedEntry<number>[] = [
  { value: 0, weight: 60 },
  { value: 1, weight: 30 },
  { value: 2, weight: 10 },
]

const GAS_MOON_COUNT_WEIGHTS: readonly WeightedEntry<number>[] = [
  { value: 0, weight: 20 },
  { value: 1, weight: 40 },
  { value: 2, weight: 25 },
  { value: 3, weight: 10 },
  { value: 4, weight: 5 },
]

/**
 * 행성 → 위성 목록. 위성 전용 스트림('moon', planetId[, index])으로 완전 격리 —
 * 기존 별·행성·외계인 출력 불변, GEN_VERSION 불필요.
 * 개별 위성 속성은 (seed, 'moon', planetId, index) 스트림에서 append-only 드로.
 */
export function moonsOf(seed: Seed, planet: Planet): readonly Moon[] {
  // 태양계는 절차 생성 대신 실제 위성 상수를 반환한다 (planetsOf의 Sol 분기와 동일 규율).
  if (planet.starId === SOL_STAR_ID) {
    return SOLAR_SYSTEM_MOONS.get(planet.id) ?? NO_MOONS
  }

  const countRng = rngFor(seed, 'moon', planet.id)
  const weights = planet.kind === 'rocky' ? ROCKY_MOON_COUNT_WEIGHTS : GAS_MOON_COUNT_WEIGHTS
  const count = countRng.weighted(weights)

  const moons: Moon[] = []
  for (let index = 0; index < count; index++) {
    const rng = rngFor(seed, 'moon', planet.id, index)
    // append-only draw 순서: orbitFactor → phaseFactor → paletteSeed
    const orbitFactor = rng.next()
    const phaseFactor = rng.next()
    const paletteSeed = rng.int(INT32_MAX)
    moons.push({ planetId: planet.id, index, orbitFactor, phaseFactor, paletteSeed })
  }
  return moons
}
