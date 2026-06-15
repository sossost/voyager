import { describe, expect, it } from 'vitest'

import { consumeStarPickSuppress, suppressStarPick } from './starPickSuppress'

describe('starPickSuppress', () => {
  it('기본값은 억제 안 함', () => {
    // 직전 테스트가 소비했으므로 초기 상태는 false
    consumeStarPickSuppress()
    expect(consumeStarPickSuppress()).toBe(false)
  })

  it('suppress 후 consume 한 번만 true (정확히 1회 억제)', () => {
    suppressStarPick()
    expect(consumeStarPickSuppress()).toBe(true)
    expect(consumeStarPickSuppress()).toBe(false)
  })
})
