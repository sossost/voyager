import { describe, expect, it } from 'vitest'

import type { Seed } from '@/engine'
import {
  alienAt,
  GEN_VERSION,
  makePlanetId,
  makeStarId,
  parseSeed,
  planetsOf,
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
  it('GEN_VERSION은 1이다 — 스냅샷이 바뀌면 이 값을 올려야 한다', () => {
    expect(GEN_VERSION).toBe(1)
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
