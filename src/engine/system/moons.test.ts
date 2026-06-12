import { describe, expect, it } from 'vitest'

import { makeStarId, parseSeed } from '../coords'
import { moonsOf } from './moons'
import { planetsOf } from './planets'

const SEED = parseSeed('TESTMOON')!

const S0 = makeStarId({ sx: 0, sy: 0, sz: 0 }, 0)

describe('moonsOf', () => {
  it('같은 (seed, planet)에서 항상 동일한 위성 목록을 반환한다', () => {
    const planet = planetsOf(SEED, S0)[0]!
    const a = moonsOf(SEED, planet)
    const b = moonsOf(SEED, planet)
    expect(a).toEqual(b)
  })

  it('rocky 행성은 위성 0~2개를 가진다', () => {
    const TRIALS = 500
    const counts = new Set<number>()
    for (let i = 0; i < TRIALS; i++) {
      const sid = makeStarId({ sx: 0, sy: 0, sz: 0 }, i)
      const rocky = planetsOf(SEED, sid).find((p) => p.kind === 'rocky')
      if (rocky == null) continue
      const moons = moonsOf(SEED, rocky)
      counts.add(moons.length)
      expect(moons.length).toBeGreaterThanOrEqual(0)
      expect(moons.length).toBeLessThanOrEqual(2)
    }
    // 충분한 샘플에서 0·1·2 전부 등장한다
    expect(counts.has(0)).toBe(true)
    expect(counts.has(1)).toBe(true)
    expect(counts.has(2)).toBe(true)
  })

  it('gas 행성은 위성 0~4개를 가진다', () => {
    const TRIALS = 500
    const counts = new Set<number>()
    for (let i = 0; i < TRIALS; i++) {
      const sid = makeStarId({ sx: 0, sy: 0, sz: 0 }, i)
      const gas = planetsOf(SEED, sid).find((p) => p.kind === 'gas')
      if (gas == null) continue
      const moons = moonsOf(SEED, gas)
      counts.add(moons.length)
      expect(moons.length).toBeGreaterThanOrEqual(0)
      expect(moons.length).toBeLessThanOrEqual(4)
    }
    expect(counts.size).toBeGreaterThanOrEqual(3)
  })

  it('각 위성의 팩터 값이 [0,1) 범위에 있다', () => {
    const sid = makeStarId({ sx: 5, sy: 3, sz: 2 }, 1)
    for (const planet of planetsOf(SEED, sid)) {
      const moons = moonsOf(SEED, planet)
      for (const moon of moons) {
        expect(moon.orbitFactor).toBeGreaterThanOrEqual(0)
        expect(moon.orbitFactor).toBeLessThan(1)
        expect(moon.phaseFactor).toBeGreaterThanOrEqual(0)
        expect(moon.phaseFactor).toBeLessThan(1)
        expect(moon.paletteSeed).toBeGreaterThanOrEqual(0)
        expect(moon.index).toBe(moons.indexOf(moon))
      }
    }
  })

  it('한 행성의 위성 추가가 다른 행성의 위성 생성물에 영향을 주지 않는다 (스트림 격리)', () => {
    const sid = makeStarId({ sx: 1, sy: 2, sz: 3 }, 0)
    const planets = planetsOf(SEED, sid)
    const [p0, p1] = planets
    if (p0 == null || p1 == null) return

    const before = moonsOf(SEED, p1)
    moonsOf(SEED, p0)
    const after = moonsOf(SEED, p1)

    expect(before).toEqual(after)
  })
})
