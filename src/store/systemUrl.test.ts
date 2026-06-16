import { describe, expect, it } from 'vitest'

import type { Seed, StarId } from '@/engine'
import { parseSeed, SOL_STAR_ID, starsInSector } from '@/engine'

import { buildSystemQuery, parseSystemParams, resolveDeepLinkStar } from './systemUrl'

const SEED = parseSeed('LIFE1') as Seed

/** Sol이 아닌, 실제로 존재하는 별 하나 — buildSystemQuery·resolveDeepLinkStar 양성 케이스용. */
function someNonSolStar(): StarId {
  for (let sx = 0; sx <= 4; sx++) {
    for (let sz = 0; sz <= 4; sz++) {
      for (const star of starsInSector(SEED, { sx, sy: 0, sz })) {
        if (star.id !== SOL_STAR_ID) return star.id
      }
    }
  }
  throw new Error('Sol이 아닌 별을 찾지 못했습니다')
}

const NON_SOL_STAR = someNonSolStar()

describe('parseSystemParams', () => {
  it('seed·star를 파싱한다', () => {
    expect(parseSystemParams(`?seed=LIFE1&star=${NON_SOL_STAR}`)).toEqual({
      seed: SEED,
      starId: NON_SOL_STAR,
    })
  })

  it('star가 없으면 starId는 null', () => {
    expect(parseSystemParams('?seed=LIFE1')).toEqual({ seed: SEED, starId: null })
  })

  it('빈 쿼리는 둘 다 null', () => {
    expect(parseSystemParams('')).toEqual({ seed: null, starId: null })
  })

  it('형식이 어긋난 seed는 null로 거른다', () => {
    expect(parseSystemParams('?seed=한글!').seed).toBeNull()
  })

  it('형식이 어긋난 star는 null로 거른다 (시드 유효성과 무관)', () => {
    expect(parseSystemParams('?seed=LIFE1&star=not-a-star').starId).toBeNull()
  })
})

describe('buildSystemQuery', () => {
  it('Sol(시작 항성계)이면 star를 생략한다 (결정 L-1)', () => {
    expect(buildSystemQuery(SEED, SOL_STAR_ID)).toBe('?seed=LIFE1')
  })

  it('일반 항성계는 star를 포함한다', () => {
    expect(buildSystemQuery(SEED, NON_SOL_STAR)).toBe(`?seed=LIFE1&star=${NON_SOL_STAR}`)
  })

  it('parseSystemParams로 왕복(round-trip)된다', () => {
    const query = buildSystemQuery(SEED, NON_SOL_STAR)
    expect(parseSystemParams(query)).toEqual({ seed: SEED, starId: NON_SOL_STAR })
  })
})

describe('resolveDeepLinkStar', () => {
  it('star가 없으면 기본 시작 별을 쓴다', () => {
    expect(resolveDeepLinkStar(SEED, SOL_STAR_ID, { seed: SEED, starId: null })).toBe(SOL_STAR_ID)
  })

  it('URL seed가 로드된 seed와 일치하고 별이 유효하면 그 별로 진입한다', () => {
    expect(resolveDeepLinkStar(SEED, SOL_STAR_ID, { seed: SEED, starId: NON_SOL_STAR })).toBe(
      NON_SOL_STAR,
    )
  })

  it('URL seed가 다르면 별을 적용하지 않는다 (교차 오염 방지)', () => {
    const otherSeed = parseSeed('OTHER') as Seed
    expect(
      resolveDeepLinkStar(SEED, SOL_STAR_ID, { seed: otherSeed, starId: NON_SOL_STAR }),
    ).toBe(SOL_STAR_ID)
  })

  it('이 시드에 존재하지 않는 별(인덱스 초과)이면 폴백한다', () => {
    const nonexistent = '26:0:10:99999' as StarId
    expect(resolveDeepLinkStar(SEED, SOL_STAR_ID, { seed: SEED, starId: nonexistent })).toBe(
      SOL_STAR_ID,
    )
  })
})
