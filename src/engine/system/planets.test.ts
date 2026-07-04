import { describe, expect, it } from 'vitest'

import type { PlanetId, Seed } from '../coords'
import { makePlanetId, makeStarId, parseSeed } from '../coords'
import { starById } from '../galaxy/position'
import type { SpectralClass, Star, StarKind } from '../galaxy/sectors'
import {
  getLifeProbability,
  habitability,
  hasHabitableZone,
  HZ_PEAK_PROBABILITY,
  planetById,
  planetsOf,
} from './planets'
import { SOL_STAR_ID, SOLAR_SYSTEM_PLANETS } from './sol'

/** 생명 확률 단위 테스트용 최소 Star — HZ 판정은 spectral·kind만 읽는다. */
function fakeStar(spectral: SpectralClass, kind: StarKind = 'main_sequence'): Star {
  return {
    id: makeStarId({ sx: 0, sy: 0, sz: 0 }, 0),
    sector: { sx: 0, sy: 0, sz: 0 },
    localPos: [0, 0, 0],
    spectral,
    name: 'TEST',
    multiplicity: 'single',
    companions: [],
    kind,
  }
}

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

  it('O/B 항성계는 생명체가 전혀 없다 (M-3 — 대질량 단명성·펄서·블랙홀 억제)', () => {
    let obStarsChecked = 0

    for (let i = 0; i < 20_000 && obStarsChecked < 12; i++) {
      const starId = makeStarId({ sx: i % 90, sy: (i % 5) - 2, sz: Math.floor(i / 90) }, i % 7)
      const spectral = starById(seed, starId)?.spectral
      if (spectral !== 'O' && spectral !== 'B') continue
      obStarsChecked += 1
      for (const planet of planetsOf(seed, starId)) {
        expect(planet.hasLife).toBe(false)
      }
    }

    expect(obStarsChecked).toBeGreaterThan(0)
  })

  it('M형 항성계는 사실상 생명체가 없다 (HZ 0.2AU vs 최소 궤도 0.6AU — 고증 수용)', () => {
    let mPlanetCount = 0
    let mLifeCount = 0

    for (let i = 0; i < 4_000; i++) {
      const starId = makeStarId({ sx: i % 60, sy: (i % 3) - 1, sz: Math.floor(i / 60) }, i % 7)
      if (starById(seed, starId)?.spectral !== 'M') continue
      for (const planet of planetsOf(seed, starId)) {
        mPlanetCount += 1
        if (planet.hasLife) mLifeCount += 1
      }
    }

    expect(mPlanetCount).toBeGreaterThan(100)
    expect(mLifeCount).toBe(0)
  })

  it('HZ 적용 후 전체 생명률은 균일 10%보다 낮다 (희귀화 — M-2)', () => {
    let planetCount = 0
    let lifeCount = 0

    for (let i = 0; i < 2_500; i++) {
      const starId = makeStarId({ sx: i % 50, sy: (i % 3) - 1, sz: Math.floor(i / 50) }, i % 7)
      for (const planet of planetsOf(seed, starId)) {
        planetCount += 1
        if (planet.hasLife) lifeCount += 1
      }
    }

    const ratio = lifeCount / planetCount
    expect(planetCount).toBeGreaterThan(10_000)
    // HZ 재배치 + M형·O/B 무생명 + 부적합 궤도 배제로 균일 10%보다 확연히 낮아진다.
    expect(ratio).toBeLessThan(0.1)
    // 그러나 전멸은 아니다 — F/G/K 태양형 HZ 궤도에 생명이 존재한다.
    expect(lifeCount).toBeGreaterThan(0)
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

describe('getLifeProbability (HZ 생명 확률 — 순수)', () => {
  it('null 별은 생명 확률 0이다 (방어)', () => {
    expect(getLifeProbability(null, 0)).toBe(0)
    expect(getLifeProbability(null, 5)).toBe(0)
  })

  it('O·B 스펙트럼은 모든 궤도에서 0이다 (펄서·블랙홀 자동 포함)', () => {
    for (let index = 0; index < 8; index++) {
      expect(getLifeProbability(fakeStar('O'), index)).toBe(0)
      expect(getLifeProbability(fakeStar('B'), index)).toBe(0)
      // O/B에서만 생성되는 펄서·블랙홀도 스펙트럼 규칙으로 커버된다.
      expect(getLifeProbability(fakeStar('O', 'pulsar'), index)).toBe(0)
      expect(getLifeProbability(fakeStar('B', 'black_hole'), index)).toBe(0)
    }
  })

  it('적색거성·백색왜성은 궤도와 무관하게 0이다 (기존 v8 규칙)', () => {
    expect(getLifeProbability(fakeStar('G', 'red_giant'), 1)).toBe(0)
    expect(getLifeProbability(fakeStar('G', 'white_dwarf'), 1)).toBe(0)
    expect(getLifeProbability(fakeStar('K', 'red_giant'), 0)).toBe(0)
  })

  it('G형 HZ 평지 궤도(index 1 ≈ 1.2AU)는 최대 확률이다', () => {
    // (1+1)·0.6 / 1.0 = 1.2 → 평지[0.85,1.3] → habitability 1 → P_PEAK.
    expect(getLifeProbability(fakeStar('G'), 1)).toBeCloseTo(HZ_PEAK_PROBABILITY, 10)
  })

  it('G형 최내행성(index 0 ≈ 0.6AU)은 0과 최대 사이다 (안쪽 감쇠 구간)', () => {
    const p = getLifeProbability(fakeStar('G'), 0)
    expect(p).toBeGreaterThan(0)
    expect(p).toBeLessThan(HZ_PEAK_PROBABILITY)
  })

  it('G형 먼 궤도(index 3 ≈ 2.4AU)는 0이다 (바깥 동결)', () => {
    // (3+1)·0.6 / 1.0 = 2.4 ≥ X_ZERO_OUTER(2.0) → 0.
    expect(getLifeProbability(fakeStar('G'), 3)).toBe(0)
  })

  it('M형은 모든 궤도에서 0이다 (HZ 중심 0.2AU가 최소 궤도보다 훨씬 안쪽)', () => {
    for (let index = 0; index < 8; index++) {
      expect(getLifeProbability(fakeStar('M'), index)).toBe(0)
    }
  })

  it('확률은 항상 [0, P_PEAK] 범위다', () => {
    const spectrals: SpectralClass[] = ['O', 'B', 'A', 'F', 'G', 'K', 'M']
    for (const spectral of spectrals) {
      for (let index = 0; index < 8; index++) {
        const p = getLifeProbability(fakeStar(spectral), index)
        expect(p).toBeGreaterThanOrEqual(0)
        expect(p).toBeLessThanOrEqual(HZ_PEAK_PROBABILITY)
      }
    }
  })
})

describe('habitability (거주성 곡선 — 순수)', () => {
  it('HZ 평지에서 정확히 1이다', () => {
    expect(habitability(0.85)).toBe(1)
    expect(habitability(1.0)).toBe(1)
    expect(habitability(1.3)).toBe(1)
  })

  it('안쪽·바깥쪽 0 경계에서 정확히 0이다', () => {
    expect(habitability(0.5)).toBe(0)
    expect(habitability(0.4)).toBe(0)
    expect(habitability(2.0)).toBe(0)
    expect(habitability(2.5)).toBe(0)
  })

  it('안쪽 감쇠 구간에서 단조 증가한다 (0 → 1)', () => {
    let previous = habitability(0.5)
    for (let x = 0.55; x <= 0.85; x += 0.05) {
      const current = habitability(x)
      expect(current).toBeGreaterThan(previous)
      expect(current).toBeGreaterThanOrEqual(0)
      expect(current).toBeLessThanOrEqual(1)
      previous = current
    }
  })

  it('바깥쪽 감쇠 구간에서 단조 감소한다 (1 → 0)', () => {
    let previous = habitability(1.3)
    for (let x = 1.35; x <= 2.0; x += 0.05) {
      const current = habitability(x)
      expect(current).toBeLessThan(previous)
      expect(current).toBeGreaterThanOrEqual(0)
      expect(current).toBeLessThanOrEqual(1)
      previous = current
    }
  })
})

describe('hasHabitableZone (HZ 시각화 게이팅 술어 — 순수)', () => {
  it('A/F/G/K/M 주계열성은 거주가능구역을 가진다', () => {
    for (const spectral of ['A', 'F', 'G', 'K', 'M'] as const) {
      expect(hasHabitableZone(fakeStar(spectral))).toBe(true)
    }
  })

  it('O/B 대질량성(펄서·블랙홀 포함)은 거주가능구역이 없다', () => {
    expect(hasHabitableZone(fakeStar('O'))).toBe(false)
    expect(hasHabitableZone(fakeStar('B'))).toBe(false)
    expect(hasHabitableZone(fakeStar('O', 'pulsar'))).toBe(false)
    expect(hasHabitableZone(fakeStar('O', 'black_hole'))).toBe(false)
  })

  it('적색거성·백색왜성은 거주가능구역이 없다', () => {
    expect(hasHabitableZone(fakeStar('G', 'red_giant'))).toBe(false)
    expect(hasHabitableZone(fakeStar('G', 'white_dwarf'))).toBe(false)
  })

  it('null 별은 거주가능구역이 없다 (방어)', () => {
    expect(hasHabitableZone(null)).toBe(false)
  })

  it('게이팅은 생명 확률 0과 일치한다 — HZ 없으면 모든 궤도에서 확률 0', () => {
    const noHzStars = [
      fakeStar('O'),
      fakeStar('B'),
      fakeStar('G', 'red_giant'),
      fakeStar('G', 'white_dwarf'),
    ]
    for (const star of noHzStars) {
      expect(hasHabitableZone(star)).toBe(false)
      for (let index = 0; index < 8; index++) {
        expect(getLifeProbability(star, index)).toBe(0)
      }
    }
  })
})
