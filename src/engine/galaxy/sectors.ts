import type { Seed, SectorCoords, StarId } from '../coords'
import { makeStarId } from '../coords'
import { starName } from '../naming/names'
import type { WeightedEntry } from '../rng/streams'
import { rngFor } from '../rng/streams'
import { SECTOR_SIZE, sectorDensity } from './density'

export const MAX_STARS_PER_SECTOR = 12

export type SpectralClass = 'O' | 'B' | 'A' | 'F' | 'G' | 'K' | 'M'

/** 실제 항성 분포를 단순화한 가중치 — M형이 가장 흔하고 O형이 가장 희귀. */
const SPECTRAL_WEIGHTS: readonly WeightedEntry<SpectralClass>[] = [
  { value: 'M', weight: 40 },
  { value: 'K', weight: 24 },
  { value: 'G', weight: 16 },
  { value: 'F', weight: 10 },
  { value: 'A', weight: 6 },
  { value: 'B', weight: 3 },
  { value: 'O', weight: 1 },
]

export interface Star {
  readonly id: StarId
  readonly sector: SectorCoords
  /** 섹터 로컬 좌표 [0, SECTOR_SIZE)³ — fp32 정밀도 보호를 위해 월드 좌표는 저장하지 않는다. */
  readonly localPos: readonly [number, number, number]
  readonly spectral: SpectralClass
  readonly name: string
}

/**
 * 섹터 → 별 목록. 순수 함수 — 같은 (seed, sector)는 항상 같은 별을 만든다.
 *
 * 별 개수는 섹터 스트림에서, 각 별의 속성은 별 자신의 독립 스트림에서 뽑는다
 * (스트림 격리 — 별 속성 추가가 이웃 별을 절대 바꾸지 않는다).
 */
export function starsInSector(seed: Seed, sector: SectorCoords): readonly Star[] {
  const density = sectorDensity(sector)
  if (density === 0) return []

  const sectorRng = rngFor(seed, 'sector', sector.sx, sector.sy, sector.sz)
  const expected = density * MAX_STARS_PER_SECTOR
  const base = Math.floor(expected)
  const fraction = expected - base
  const count = base + (sectorRng.next() < fraction ? 1 : 0)

  const stars: Star[] = []
  for (let index = 0; index < count; index++) {
    const id = makeStarId(sector, index)
    const starRng = rngFor(seed, 'star', id)
    // append-only: 새 속성은 반드시 아래 draw들 뒤에 추가할 것 (자기 스트림 내 호환성)
    const localPos = [
      starRng.next() * SECTOR_SIZE,
      starRng.next() * SECTOR_SIZE,
      starRng.next() * SECTOR_SIZE,
    ] as const
    const spectral = starRng.weighted(SPECTRAL_WEIGHTS)
    const name = starName(rngFor(seed, 'name', id))

    stars.push({ id, sector, localPos, spectral, name })
  }
  return stars
}
