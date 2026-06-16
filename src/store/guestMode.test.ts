import { describe, expect, it } from 'vitest'

import type { Seed, StarId } from '@/engine'
import { originStar, parseSeed, starsInSector } from '@/engine'
import { MemoryDriver } from '@/persistence/memoryDriver'

import { createGameStore } from './createGameStore'

const seed = parseSeed('GUESTTEST') as Seed
const startStarId = originStar(seed)

function otherStarId(): StarId {
  for (let sx = 0; sx < 12; sx++) {
    for (const star of starsInSector(seed, { sx, sy: 0, sz: 1 })) {
      if (star.id !== startStarId) return star.id
    }
  }
  throw new Error('테스트용 별을 찾지 못했습니다')
}

const target = otherStarId()

/** persist의 fire-and-forget 마이크로태스크가 끝나길 기다린다. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('게스트 모드 (공유 우주 둘러보기, 백로그 L-1)', () => {
  it('guestMode 옵션이 isGuestMode 상태로 노출된다', () => {
    const store = createGameStore({ seed, startStarId, driver: new MemoryDriver(), guestMode: true })
    expect(store.getState().isGuestMode).toBe(true)
  })

  it('기본값은 일반 모드 (isGuestMode=false)', () => {
    const store = createGameStore({ seed, startStarId, driver: new MemoryDriver() })
    expect(store.getState().isGuestMode).toBe(false)
  })

  it('게스트 모드에서 워프하면 in-memory만 갱신하고 디스크에는 쓰지 않는다', async () => {
    const driver = new MemoryDriver()
    const store = createGameStore({ seed, startStarId, driver, guestMode: true, now: () => 1 })

    store.getState().warpTo(target)
    await flush()

    // in-memory 세션은 정상 동작 — 현재 위치·방문 캐시 갱신
    expect(store.getState().currentStarId).toBe(target)
    expect(store.getState().visitedStars.has(target)).toBe(true)

    // 디스크는 그대로 — 방문 기록도 프로필도 없음 (방문자 본 우주 보존)
    const records = await driver.loadAll()
    expect(records.visits).toHaveLength(0)
    expect(await driver.loadProfile()).toBeNull()
  })

  it('대조: 일반 모드는 워프 시 디스크에 방문·프로필을 쓴다', async () => {
    const driver = new MemoryDriver()
    const store = createGameStore({ seed, startStarId, driver, now: () => 1 })

    store.getState().warpTo(target)
    await flush()

    const records = await driver.loadAll()
    expect(records.visits.some((visit) => visit.starId === target)).toBe(true)
    expect(await driver.loadProfile()).not.toBeNull()
  })
})
