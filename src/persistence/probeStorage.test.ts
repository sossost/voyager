import 'fake-indexeddb/auto'

import { describe, expect, it } from 'vitest'

import { probeStorage } from '@/persistence/probeStorage'
import { MemoryDriver } from '@/persistence/memoryDriver'

describe('probeStorage', () => {
  it('open이 성공하면 영속 드라이버를 반환한다', async () => {
    const driver = await probeStorage()
    expect(driver.mode).toBe('persistent')
  })

  it('open이 실패하면 MemoryDriver로 폴백한다 (Safari 사생활 모드 시나리오)', async () => {
    const failing = () => {
      const memory = new MemoryDriver()
      return Object.assign(memory, {
        probe: () => Promise.reject(new Error('InvalidStateError: open 거부')),
      })
    }

    const driver = await probeStorage(failing)
    expect(driver).toBeInstanceOf(MemoryDriver)
    expect(driver.mode).toBe('memory')
  })

  it('드라이버 생성 자체가 throw해도 폴백한다', async () => {
    const driver = await probeStorage(() => {
      throw new Error('indexedDB 미정의')
    })
    expect(driver.mode).toBe('memory')
  })
})
