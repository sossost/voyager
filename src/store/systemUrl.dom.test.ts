// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'

import type { Seed, StarId } from '@/engine'
import { parseSeed, SOL_STAR_ID, starsInSector } from '@/engine'

import { buildSeedShareUrl, buildSystemShareUrl, syncSystemUrl } from './systemUrl'

const SEED = parseSeed('LIFE1') as Seed

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

beforeEach(() => {
  // 각 테스트는 쿼리 없는 깨끗한 주소에서 시작한다
  window.history.replaceState(null, '', window.location.pathname)
})

describe('buildSeedShareUrl / buildSystemShareUrl', () => {
  it('우주 공유 링크는 절대 URL + ?seed=', () => {
    const url = buildSeedShareUrl(SEED)
    expect(url).toBe(`${window.location.origin}${window.location.pathname}?seed=LIFE1`)
  })

  it('항성계 공유 링크는 Sol이면 star를 생략한다', () => {
    expect(buildSystemShareUrl(SEED, SOL_STAR_ID)).toBe(
      `${window.location.origin}${window.location.pathname}?seed=LIFE1`,
    )
  })

  it('항성계 공유 링크는 일반 별이면 star를 포함한다', () => {
    expect(buildSystemShareUrl(SEED, NON_SOL_STAR)).toBe(
      `${window.location.origin}${window.location.pathname}?seed=LIFE1&star=${NON_SOL_STAR}`,
    )
  })
})

describe('syncSystemUrl', () => {
  it('주소창 쿼리를 정박 항성계로 교체한다 (replaceState)', () => {
    syncSystemUrl(SEED, NON_SOL_STAR)
    expect(window.location.search).toBe(`?seed=LIFE1&star=${NON_SOL_STAR}`)
  })

  it('Sol이면 star 없이 ?seed=만 남긴다', () => {
    syncSystemUrl(SEED, SOL_STAR_ID)
    expect(window.location.search).toBe('?seed=LIFE1')
  })

  it('히스토리를 쌓지 않는다 — replaceState라 length가 그대로다', () => {
    const before = window.history.length
    syncSystemUrl(SEED, NON_SOL_STAR)
    syncSystemUrl(SEED, SOL_STAR_ID)
    expect(window.history.length).toBe(before)
  })
})
