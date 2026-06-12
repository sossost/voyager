import { describe, expect, it } from 'vitest'

import { planetsOf } from './planets'
import { moonsOf } from './moons'

const SEED = 'TESTMOON'

describe('moonsOf', () => {
  it('같은 (seed, planet)에서 항상 동일한 위성 목록을 반환한다', () => {
    const planets = planetsOf(SEED, '0:0:0:0')
    const planet = planets[0]!
    const a = moonsOf(SEED, planet)
    const b = moonsOf(SEED, planet)
    expect(a).toEqual(b)
  })

  it('rocky 행성은 위성 0~2개를 가진다', () => {
    const TRIALS = 500
    const counts = new Set<number>()
    for (let i = 0; i < TRIALS; i++) {
      const planets = planetsOf(SEED, `0:0:0:${i}`)
      const rocky = planets.find((p) => p.kind === 'rocky')
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
      const planets = planetsOf(SEED, `0:0:0:${i}`)
      const gas = planets.find((p) => p.kind === 'gas')
      if (gas == null) continue
      const moons = moonsOf(SEED, gas)
      counts.add(moons.length)
      expect(moons.length).toBeGreaterThanOrEqual(0)
      expect(moons.length).toBeLessThanOrEqual(4)
    }
    expect(counts.size).toBeGreaterThanOrEqual(3)
  })

  it('각 위성의 팩터 값이 [0,1) 범위에 있다', () => {
    const planets = planetsOf(SEED, '5:3:2:1')
    for (const planet of planets) {
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
    const planets = planetsOf(SEED, '1:2:3:0')
    const [p0, p1] = planets
    if (p0 == null || p1 == null) return

    const before = moonsOf(SEED, p1)

    // p0의 위성을 호출해도 p1 결과가 동일해야 한다
    moonsOf(SEED, p0)
    const after = moonsOf(SEED, p1)

    expect(before).toEqual(after)
  })
})
