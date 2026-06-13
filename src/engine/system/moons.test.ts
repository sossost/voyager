import { describe, expect, it } from 'vitest'

import { makeStarId, parseSeed } from '../coords'
import { moonsOf } from './moons'
import { planetsOf } from './planets'
import { SOL_STAR_ID } from './sol'

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

describe('moonsOf — 태양계(Sol) 실제 위성', () => {
  const solPlanets = planetsOf(SEED, SOL_STAR_ID)
  const moonsByName = (planetIndex: number) =>
    moonsOf(SEED, solPlanets[planetIndex]!).map((m) => m.name)

  it('시드와 무관하게 동일한 태양계 위성을 반환한다', () => {
    const other = parseSeed('OTHERSEED')!
    expect(moonsOf(other, solPlanets[2]!)).toEqual(moonsOf(SEED, solPlanets[2]!))
  })

  it('수성·금성은 위성이 없다', () => {
    expect(moonsOf(SEED, solPlanets[0]!)).toHaveLength(0)
    expect(moonsOf(SEED, solPlanets[1]!)).toHaveLength(0)
  })

  it('지구는 달 1개를 가진다', () => {
    expect(moonsByName(2)).toEqual(['달'])
  })

  it('화성은 포보스·데이모스를 가진다', () => {
    expect(moonsByName(3)).toEqual(['포보스', '데이모스'])
  })

  it('목성은 갈릴레이 위성 4개를 가진다', () => {
    expect(moonsByName(4)).toEqual(['이오', '유로파', '가니메데', '칼리스토'])
  })

  it('천왕성은 주요 위성 5개를 가진다', () => {
    expect(moonsByName(6)).toEqual(['미란다', '아리엘', '움브리엘', '티타니아', '오베론'])
  })

  it('해왕성은 트리톤 1개를 가진다', () => {
    expect(moonsByName(7)).toEqual(['트리톤'])
  })

  it('위성은 궤도 거리(orbitFactor) 오름차순으로 정렬된다', () => {
    const jupiter = moonsOf(SEED, solPlanets[4]!)
    const factors = jupiter.map((m) => m.orbitFactor)
    expect(factors).toEqual([...factors].sort((a, b) => a - b))
  })

  it('렌더 팩터가 [0,1) 범위를 지킨다', () => {
    for (const planet of solPlanets) {
      for (const moon of moonsOf(SEED, planet)) {
        expect(moon.orbitFactor).toBeGreaterThanOrEqual(0)
        expect(moon.orbitFactor).toBeLessThan(1)
        expect(moon.phaseFactor).toBeGreaterThanOrEqual(0)
        expect(moon.phaseFactor).toBeLessThan(1)
      }
    }
  })
})
