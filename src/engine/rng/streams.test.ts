import { describe, expect, it } from 'vitest'

import type { Seed } from '../coords'
import { parseSeed } from '../coords'
import type { Rng } from './streams'
import { rngFor } from './streams'

function seedOf(value: string): Seed {
  const seed = parseSeed(value)
  if (seed == null) throw new Error(`테스트 시드가 유효하지 않습니다: ${value}`)
  return seed
}

function collect(rng: Rng, count: number): number[] {
  return Array.from({ length: count }, () => rng.next())
}

const seed = seedOf('STREAMTEST')

describe('rngFor', () => {
  it('같은 (seed, namespace, key)는 항상 같은 수열을 만든다', () => {
    const first = collect(rngFor(seed, 'star', '0:0:0:1'), 20)
    const second = collect(rngFor(seed, 'star', '0:0:0:1'), 20)
    expect(second).toEqual(first)
  })

  it('다른 key는 다른 수열을 만든다', () => {
    const a = collect(rngFor(seed, 'star', '0:0:0:1'), 5)
    const b = collect(rngFor(seed, 'star', '0:0:0:2'), 5)
    expect(b).not.toEqual(a)
  })

  it('다른 namespace는 같은 key라도 다른 수열을 만든다', () => {
    const star = collect(rngFor(seed, 'star', 'X'), 5)
    const name = collect(rngFor(seed, 'name', 'X'), 5)
    expect(name).not.toEqual(star)
  })

  it('키 조각 경계가 다르면 다른 스트림이다 ("a","bc" ≠ "ab","c")', () => {
    const a = collect(rngFor(seed, 'star', 'a', 'bc'), 5)
    const b = collect(rngFor(seed, 'star', 'ab', 'c'), 5)
    expect(b).not.toEqual(a)
  })

  it('스트림 격리: 한 스트림을 아무리 소비해도 다른 스트림은 불변이다', () => {
    const reference = collect(rngFor(seed, 'planet', 'B'), 5)

    const noisy = rngFor(seed, 'planet', 'A')
    collect(noisy, 1_000)

    const after = collect(rngFor(seed, 'planet', 'B'), 5)
    expect(after).toEqual(reference)
  })

  it('next()는 [0, 1) 범위를 벗어나지 않는다', () => {
    const rng = rngFor(seed, 'sector', 1, 2, 3)
    for (const value of collect(rng, 1_000)) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })
})

describe('Rng.int', () => {
  it('[0, maxExclusive) 정수를 반환한다', () => {
    const rng = rngFor(seed, 'sector', 0, 0, 0)
    for (let i = 0; i < 1_000; i++) {
      const value = rng.int(8)
      expect(Number.isInteger(value)).toBe(true)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(8)
    }
  })

  it('유효하지 않은 maxExclusive는 거부한다', () => {
    const rng = rngFor(seed, 'sector', 0, 0, 0)
    expect(() => rng.int(0)).toThrow()
    expect(() => rng.int(-3)).toThrow()
    expect(() => rng.int(1.5)).toThrow()
  })
})

describe('Rng.pick', () => {
  it('항상 배열 내부의 원소를 반환한다', () => {
    const rng = rngFor(seed, 'name', 'pick')
    const items = ['a', 'b', 'c'] as const
    for (let i = 0; i < 300; i++) {
      expect(items).toContain(rng.pick(items))
    }
  })

  it('빈 배열은 거부한다', () => {
    const rng = rngFor(seed, 'name', 'pick')
    expect(() => rng.pick([])).toThrow()
  })
})

describe('Rng.weighted', () => {
  it('가중치 비율에 수렴한다 (70/22/7/1)', () => {
    const rng = rngFor(seed, 'alien', 'dist')
    const counts = { common: 0, rare: 0, epic: 0, legendary: 0 }
    const entries = [
      { value: 'common', weight: 70 },
      { value: 'rare', weight: 22 },
      { value: 'epic', weight: 7 },
      { value: 'legendary', weight: 1 },
    ] as const
    const TOTAL_DRAWS = 10_000

    for (let i = 0; i < TOTAL_DRAWS; i++) {
      counts[rng.weighted(entries)] += 1
    }

    expect(counts.common / TOTAL_DRAWS).toBeCloseTo(0.7, 1)
    expect(counts.rare / TOTAL_DRAWS).toBeCloseTo(0.22, 1)
    expect(counts.legendary / TOTAL_DRAWS).toBeLessThan(0.02)
  })

  it('가중치 0인 항목은 절대 선택되지 않는다', () => {
    const rng = rngFor(seed, 'alien', 'zero')
    const entries = [
      { value: 'always', weight: 1 },
      { value: 'never', weight: 0 },
    ] as const
    for (let i = 0; i < 500; i++) {
      expect(rng.weighted(entries)).toBe('always')
    }
  })

  it('빈 목록·음수 가중치는 거부한다', () => {
    const rng = rngFor(seed, 'alien', 'invalid')
    expect(() => rng.weighted([])).toThrow()
    expect(() => rng.weighted([{ value: 'x', weight: -1 }])).toThrow()
  })
})
