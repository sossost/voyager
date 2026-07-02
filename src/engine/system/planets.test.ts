import { describe, expect, it } from 'vitest'

import type { PlanetId, Seed } from '../coords'
import { makePlanetId, makeStarId, parseSeed } from '../coords'
import { starById } from '../galaxy/position'
import { LIFE_PROBABILITY, planetById, planetsOf } from './planets'
import { SOL_STAR_ID, SOLAR_SYSTEM_PLANETS } from './sol'

function seedOf(value: string): Seed {
  const seed = parseSeed(value)
  if (seed == null) throw new Error(`테스트 시드가 유효하지 않습니다: ${value}`)
  return seed
}

const seed = seedOf('PLANETTEST')

describe('planetsOf', () => {
  it('같은 (seed, starId)는 항상 같은 행성계를 만든다', () => {
    const starId = makeStarId({ sx: 0, sy: 0, sz: 5 }, 3)
    expect(planetsOf(seed, starId)).toEqual(planetsOf(seed, starId))
  })

  it('행성 수는 1~8개다', () => {
    for (let i = 0; i < 200; i++) {
      const starId = makeStarId({ sx: i, sy: 0, sz: 0 }, 0)
      const count = planetsOf(seed, starId).length
      expect(count).toBeGreaterThanOrEqual(1)
      expect(count).toBeLessThanOrEqual(8)
    }
  })

  it('행성 속성이 자기 종류의 범위 안에 있고 궤도는 단조 증가한다', () => {
    for (let i = 0; i < 50; i++) {
      const planets = planetsOf(seed, makeStarId({ sx: i, sy: 1, sz: -i }, 1))
      let previousOrbit = 0
      for (const planet of planets) {
        if (planet.kind === 'rocky') {
          expect(planet.radius).toBeGreaterThanOrEqual(0.4)
          expect(planet.radius).toBeLessThanOrEqual(1.6)
        } else {
          expect(planet.radius).toBeGreaterThanOrEqual(2.0)
          expect(planet.radius).toBeLessThanOrEqual(5.0)
        }
        expect(planet.orbitAu).toBeGreaterThan(previousOrbit)
        previousOrbit = planet.orbitAu
        expect(planet.name).not.toBe('')
      }
    }
  })

  it('동결선: 내행성(index 0)은 암석, 외행성(index 7)은 가스가 지배적이다 (M-1 — 고증)', () => {
    // 궤도 인덱스별 kind 분포를 몬테카를로로 집계 — index가 커질수록 gas 비율이 단조 증가해야
    // 한다(눈선 안쪽 암석·바깥쪽 가스). 8행성 이상 나오는 별만 세면 index별 표본이 고르다.
    const gasCountByIndex = new Array<number>(8).fill(0)
    const totalByIndex = new Array<number>(8).fill(0)

    for (let i = 0; i < 6_000; i++) {
      const starId = makeStarId({ sx: i % 60, sy: (i % 3) - 1, sz: Math.floor(i / 60) }, i % 7)
      const kind = starById(seed, starId)?.kind
      if (kind === 'red_giant' || kind === 'white_dwarf') continue
      for (const planet of planetsOf(seed, starId)) {
        totalByIndex[planet.index] = (totalByIndex[planet.index] ?? 0) + 1
        if (planet.kind === 'gas') gasCountByIndex[planet.index] = (gasCountByIndex[planet.index] ?? 0) + 1
      }
    }

    const gasRatio = (index: number) => (gasCountByIndex[index] ?? 0) / (totalByIndex[index] ?? 1)
    // 최내행성은 암석 지배(가스 <25%), 최외행성은 가스 지배(가스 >70%).
    expect(gasRatio(0)).toBeLessThan(0.25)
    expect(gasRatio(7)).toBeGreaterThan(0.7)
    // 램프는 단조 증가 — 안쪽에서 바깥쪽으로 가스 비율이 꾸준히 오른다.
    expect(gasRatio(0)).toBeLessThan(gasRatio(3))
    expect(gasRatio(3)).toBeLessThan(gasRatio(7))
  })

  it('몬테카를로 10k+: 생명 가능 별의 생명체 행성 비율이 9~11%다', () => {
    // 적색거성·백색왜성은 생명이 없으므로(exotic-stars 결정 8) raw LIFE_PROBABILITY 검증에서
    // 제외한다 — 죽은 별을 섞으면 비율이 구조적으로 낮아져 측정 대상이 흐려진다.
    let planetCount = 0
    let lifeCount = 0

    for (let i = 0; i < 2_500; i++) {
      const starId = makeStarId({ sx: i % 50, sy: (i % 3) - 1, sz: Math.floor(i / 50) }, i % 7)
      const kind = starById(seed, starId)?.kind
      if (kind === 'red_giant' || kind === 'white_dwarf') continue
      for (const planet of planetsOf(seed, starId)) {
        planetCount += 1
        if (planet.hasLife) lifeCount += 1
      }
    }

    const ratio = lifeCount / planetCount
    expect(planetCount).toBeGreaterThan(10_000)
    expect(ratio).toBeGreaterThan(LIFE_PROBABILITY - 0.01)
    expect(ratio).toBeLessThan(LIFE_PROBABILITY + 0.01)
  })

  it('적색거성·백색왜성 항성계는 생명체가 전혀 없다 (exotic-stars 결정 8 — 고증)', () => {
    let sterileStarsChecked = 0

    for (let i = 0; i < 4_000 && sterileStarsChecked < 12; i++) {
      const starId = makeStarId({ sx: i % 60, sy: (i % 5) - 2, sz: Math.floor(i / 60) }, i % 5)
      const kind = starById(seed, starId)?.kind
      if (kind !== 'red_giant' && kind !== 'white_dwarf') continue
      sterileStarsChecked += 1
      for (const planet of planetsOf(seed, starId)) {
        expect(planet.hasLife).toBe(false)
      }
    }

    expect(sterileStarsChecked).toBeGreaterThan(0)
  })

  it('planetById는 planetsOf의 해당 행성과 동일한 객체를 만든다', () => {
    const starId = makeStarId({ sx: 2, sy: 0, sz: 2 }, 1)
    const planets = planetsOf(seed, starId)
    const second = planets[1]
    if (second != null) {
      expect(planetById(seed, second.id)).toEqual(second)
    }
    expect(planetById(seed, makePlanetId(starId, 99))).toBeNull()
    expect(planetById(seed, 'broken' as PlanetId)).toBeNull()
  })

  it('SOL_STAR_ID는 시드 무관 SOLAR_SYSTEM_PLANETS를 반환한다', () => {
    for (const s of [seed, seedOf('ANOTHER'), seedOf('ZETA42')]) {
      expect(planetsOf(s, SOL_STAR_ID)).toBe(SOLAR_SYSTEM_PLANETS)
    }
  })

  it('SOLAR_SYSTEM_PLANETS: 8행성, 지구만 isHomeWorld=true', () => {
    expect(SOLAR_SYSTEM_PLANETS).toHaveLength(8)
    const earth = SOLAR_SYSTEM_PLANETS.find((p) => p.isHomeWorld === true)
    expect(earth).toBeDefined()
    expect(earth?.name).toBe('지구')
    expect(earth?.hasLife).toBe(true)
    const nonEarth = SOLAR_SYSTEM_PLANETS.filter((p) => p.isHomeWorld !== true)
    expect(nonEarth.every((p) => !p.hasLife)).toBe(true)
  })

  it('planetById는 SOL 행성도 올바르게 반환한다', () => {
    const earth = SOLAR_SYSTEM_PLANETS[2]
    if (earth == null) throw new Error('Earth not found')
    expect(planetById(seed, earth.id)).toEqual(earth)
  })

  it('몬테카를로: 전체 암석 비율이 암석 편중이다 (동결선 + 내행성 다수, M-1)', () => {
    // 동결선(M-1) 도입 후 전체 rocky/gas는 더 이상 고정 60/40이 아니다. 행성 수는 1~8 균등이라
    // 내행성 인덱스(암석 지배)가 외행성보다 훨씬 자주 등장 → 집계는 암석 쪽으로 쏠린다(~65%).
    let rockyCount = 0
    let total = 0
    for (let i = 0; i < 2_000; i++) {
      for (const planet of planetsOf(seed, makeStarId({ sx: i, sy: 0, sz: 1 }, 2))) {
        total += 1
        if (planet.kind === 'rocky') rockyCount += 1
      }
    }
    const rockyRatio = rockyCount / total
    expect(rockyRatio).toBeGreaterThan(0.55)
    expect(rockyRatio).toBeLessThan(0.75)
  })
})
