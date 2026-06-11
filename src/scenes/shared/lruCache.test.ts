import { describe, expect, it, vi } from 'vitest'

import { LruCache } from './lruCache'

describe('LruCache', () => {
  it('캐시된 값은 재계산하지 않는다', () => {
    const cache = new LruCache<string, number>(2)
    const compute = vi.fn(() => 42)

    expect(cache.getOrCompute('a', compute)).toBe(42)
    expect(cache.getOrCompute('a', compute)).toBe(42)
    expect(compute).toHaveBeenCalledTimes(1)
  })

  it('용량 초과 시 가장 오래 사용하지 않은 항목을 내보낸다', () => {
    const cache = new LruCache<string, number>(2)
    cache.getOrCompute('a', () => 1)
    cache.getOrCompute('b', () => 2)
    cache.getOrCompute('a', () => 0) // a를 최근 사용으로 갱신 — 순서: b, a
    cache.getOrCompute('c', () => 3) // 가장 오래된 b 축출 — 순서: a, c

    const computeB = vi.fn(() => 2)
    cache.getOrCompute('b', computeB)
    expect(computeB).toHaveBeenCalledTimes(1) // b는 축출됐으므로 재계산

    const computeC = vi.fn(() => 3)
    cache.getOrCompute('c', computeC)
    expect(computeC).not.toHaveBeenCalled() // c는 살아 있음 (b 재추가 시 a가 축출됨)
  })

  it('용량이 양의 정수가 아니면 거부한다', () => {
    expect(() => new LruCache(0)).toThrow()
    expect(() => new LruCache(-1)).toThrow()
    expect(() => new LruCache(1.5)).toThrow()
  })
})
