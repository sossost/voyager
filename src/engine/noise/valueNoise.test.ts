import { describe, expect, it } from 'vitest'

import { valueNoise3 } from './valueNoise'

describe('valueNoise3', () => {
  it('같은 입력 → 같은 출력 (결정론)', () => {
    expect(valueNoise3(1.25, -3.5, 7.75, 42)).toBe(valueNoise3(1.25, -3.5, 7.75, 42))
  })

  it('출력은 [0, 1) 범위다', () => {
    for (let i = 0; i < 500; i++) {
      const value = valueNoise3(i * 0.37, i * -0.21, i * 0.53, 7)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })

  it('salt가 다르면 다른 노이즈 필드를 만든다', () => {
    const samples = [0.3, 1.7, 4.2]
    const fieldA = samples.map((v) => valueNoise3(v, v, v, 1))
    const fieldB = samples.map((v) => valueNoise3(v, v, v, 2))
    expect(fieldB).not.toEqual(fieldA)
  })

  it('연속적이다 — 인접 샘플의 차이가 작다', () => {
    const STEP = 0.01
    const MAX_LOCAL_DELTA = 0.1
    for (let i = 0; i < 200; i++) {
      const x = i * 0.13
      const delta = Math.abs(valueNoise3(x + STEP, 2, 3, 5) - valueNoise3(x, 2, 3, 5))
      expect(delta).toBeLessThan(MAX_LOCAL_DELTA)
    }
  })
})
