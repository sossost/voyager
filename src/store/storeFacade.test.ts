import { describe, expect, it } from 'vitest'

import type { Seed } from '@/engine'
import { originStar, parseSeed } from '@/engine'
import { MemoryDriver } from '@/persistence/memoryDriver'
import { getGameStoreApi, getStorageDriver, initializeGameStore, useGameStore } from './index'

function seedOf(value: string): Seed {
  const seed = parseSeed(value)
  if (seed == null) throw new Error(`테스트 시드가 유효하지 않습니다: ${value}`)
  return seed
}

describe('스토어 파사드 (부트 초기화 패턴)', () => {
  it('초기화 전 접근은 명확한 에러를 던진다', () => {
    expect(() => getGameStoreApi()).toThrow('초기화되지 않았습니다')
    expect(() => getStorageDriver()).toThrow('초기화되지 않았습니다')
  })

  it('초기화 후 스토어와 드라이버에 접근할 수 있다', () => {
    const seed = seedOf('FACADETEST')
    const driver = new MemoryDriver()
    const api = initializeGameStore({ seed, startStarId: originStar(seed), driver })

    expect(getGameStoreApi()).toBe(api)
    expect(getStorageDriver()).toBe(driver)
    expect(useGameStore.getState().seed).toBe(seed)
  })
})
