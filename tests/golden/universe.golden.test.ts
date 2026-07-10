import { describe, expect, it } from 'vitest'

import type { Seed } from '@/engine'
import {
  alienAt,
  GEN_VERSION,
  makePlanetId,
  makeStarId,
  PALETTE_FAMILIES,
  parseSeed,
  planetsOf,
  SPECIES_CATALOG,
  starsInSector,
} from '@/engine'

/**
 * 생성물 레벨 골든 마스터 — 알려진 시드 3종의 우주 전체 직렬화 스냅샷.
 *
 * PRNG 해시 골든(prng.golden.test.ts)이 "깨졌다"를 알려준다면,
 * 이 스냅샷은 "무엇이 어떻게 변했는지"를 diff로 보여준다.
 * 스냅샷 변경 = 기존 플레이어의 우주가 바뀐다는 뜻 — GEN_VERSION을 올려라.
 */

const GOLDEN_SEEDS = ['ANDROMEDA', 'SOL1969', 'ZETA42'] as const

function seedOf(value: string): Seed {
  const seed = parseSeed(value)
  if (seed == null) throw new Error(`테스트 시드가 유효하지 않습니다: ${value}`)
  return seed
}

describe('우주 생성물 골든 마스터', () => {
  it('GEN_VERSION은 12이다 — 스냅샷이 바뀌면 이 값을 올려야 한다', () => {
    expect(GEN_VERSION).toBe(12)
  })

  it('SPECIES_CATALOG 전체 구조가 영구히 같다 (allowedParts 내부 순서 포함)', () => {
    // rng.pick은 배열 인덱스로 해석되므로 카탈로그의 "순서"가 곧 저장 포맷이다.
    // 종족 추가/수정/풀 재정렬 → 이 스냅샷이 깨진다 → GEN_VERSION을 올려라.
    // (조우 프로브 6건만으로는 60종 중 5종만 봉인되는 사각지대를 막는다)
    expect(SPECIES_CATALOG).toMatchSnapshot()
  })

  it('PALETTE_FAMILIES 구조가 영구히 같다 (셰이드 순서 포함)', () => {
    expect(PALETTE_FAMILIES).toMatchSnapshot()
  })

  it.each(GOLDEN_SEEDS)('시드 %s의 우주가 영구히 같다', (rawSeed) => {
    const seed = seedOf(rawSeed)
    const probeSector = { sx: 2, sy: 0, sz: 3 }
    const stars = starsInSector(seed, probeSector)
    const firstStarId = stars[0]?.id ?? makeStarId(probeSector, 0)
    const planets = planetsOf(seed, firstStarId)

    const payload = {
      genVersion: GEN_VERSION,
      sector: { coords: probeSector, stars },
      system: { starId: firstStarId, planets },
      encounters: [0, 1].map((index) => {
        const planetId = makePlanetId(firstStarId, index)
        return { planetId, alien: alienAt(seed, planetId) }
      }),
    }

    expect(payload).toMatchSnapshot()
  })
})
