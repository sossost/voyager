import fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import type { Seed } from '@/engine'
import { alienAt, makePlanetId, makeStarId, parseSeed, planetsOf, starsInSector } from '@/engine'

/**
 * fast-check 속성 테스트 — "임의의 (seed, coords)에 대해 2회 생성 = 항상 동일".
 * 골든 마스터(고정 입력 검출)와 상호 보완하는 결정론 증명.
 */

const SEED_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

const seedArb = fc
  .array(fc.constantFrom(...SEED_ALPHABET.split('')), { minLength: 1, maxLength: 32 })
  .map((chars) => {
    const seed = parseSeed(chars.join(''))
    if (seed == null) throw new Error('unreachable: 알파벳이 시드 규칙을 벗어남')
    return seed
  })

const sectorArb = fc.record({
  sx: fc.integer({ min: -48, max: 48 }),
  sy: fc.integer({ min: -5, max: 5 }),
  sz: fc.integer({ min: -48, max: 48 }),
})

function starIdArbOf(seedAndSector: { seed: Seed; sx: number; sy: number; sz: number; starIndex: number }) {
  return makeStarId(
    { sx: seedAndSector.sx, sy: seedAndSector.sy, sz: seedAndSector.sz },
    seedAndSector.starIndex,
  )
}

describe('결정론 속성 테스트', () => {
  it('starsInSector: 임의 (seed, sector) 2회 생성은 항상 동일하다', () => {
    fc.assert(
      fc.property(seedArb, sectorArb, (seed, sector) => {
        expect(starsInSector(seed, sector)).toEqual(starsInSector(seed, sector))
      }),
      { numRuns: 200 },
    )
  })

  it('planetsOf: 임의 (seed, starId) 2회 생성은 항상 동일하다', () => {
    fc.assert(
      fc.property(
        seedArb,
        sectorArb,
        fc.integer({ min: 0, max: 79 }),
        (seed, sector, starIndex) => {
          const starId = starIdArbOf({ seed, ...sector, starIndex })
          expect(planetsOf(seed, starId)).toEqual(planetsOf(seed, starId))
        },
      ),
      { numRuns: 500 },
    )
  })

  it('alienAt: 임의 (seed, planetId) 2회 생성은 항상 동일하다 (1000케이스)', () => {
    fc.assert(
      fc.property(
        seedArb,
        sectorArb,
        fc.integer({ min: 0, max: 79 }),
        fc.integer({ min: 0, max: 7 }),
        (seed, sector, starIndex, planetIndex) => {
          const planetId = makePlanetId(starIdArbOf({ seed, ...sector, starIndex }), planetIndex)
          expect(alienAt(seed, planetId)).toEqual(alienAt(seed, planetId))
        },
      ),
      { numRuns: 1_000 },
    )
  })
})
