import { describe, expect, it } from 'vitest'

import { makeStarId, parseSeed } from '../coords'
import { starById } from '../galaxy/position'
import type { SpectralClass } from '../galaxy/sectors'
import { starsInSector } from '../galaxy/sectors'
import { beltsOf } from './belts'
import { moonsOf } from './moons'
import { planetsOf } from './planets'
import { SOL_SECTOR, SOL_STAR_ID } from './sol'

const SEED = parseSeed('TESTBELT')!

const S0 = makeStarId({ sx: 0, sy: 0, sz: 0 }, 0)

/** Sol 주변 실제 별 표본 — 벨트 분포·분광형 의존성 검증용. */
function sampleRealStars(seed = parseSeed('LIFE1')!, radius = 14) {
  const stars = []
  for (let dsx = -radius; dsx <= radius; dsx++) {
    for (let dsz = -radius; dsz <= radius; dsz++) {
      for (const star of starsInSector(seed, {
        sx: SOL_SECTOR.sx + dsx,
        sy: 0,
        sz: SOL_SECTOR.sz + dsz,
      })) {
        const full = starById(seed, star.id)
        if (full != null) stars.push(full)
      }
    }
  }
  return stars
}

describe('beltsOf', () => {
  it('같은 (seed, starId)에서 항상 동일한 벨트 목록을 반환한다', () => {
    const a = beltsOf(SEED, S0)
    const b = beltsOf(SEED, S0)
    expect(a).toEqual(b)
  })

  it('종류별로 최대 1개씩, 시스템당 최대 2개의 벨트를 만든다', () => {
    const TRIALS = 400
    for (let i = 0; i < TRIALS; i++) {
      const sid = makeStarId({ sx: 0, sy: 0, sz: 0 }, i)
      const belts = beltsOf(SEED, sid)
      expect(belts.length).toBeLessThanOrEqual(2)
      expect(belts.filter((b) => b.kind === 'rocky').length).toBeLessThanOrEqual(1)
      expect(belts.filter((b) => b.kind === 'kuiper').length).toBeLessThanOrEqual(1)
    }
  })

  it('모든 벨트는 innerAu < outerAu이고 경계가 양수다', () => {
    const TRIALS = 400
    for (let i = 0; i < TRIALS; i++) {
      const sid = makeStarId({ sx: 3, sy: 1, sz: 4 }, i)
      for (const belt of beltsOf(SEED, sid)) {
        expect(belt.innerAu).toBeGreaterThan(0)
        expect(belt.outerAu).toBeGreaterThan(belt.innerAu)
        expect(belt.densitySeed).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('카이퍼대는 항상 최외곽 행성 바깥에 있다', () => {
    const TRIALS = 400
    for (let i = 0; i < TRIALS; i++) {
      const sid = makeStarId({ sx: 7, sy: 2, sz: 1 }, i)
      const planets = planetsOf(SEED, sid)
      const outermostAu = planets.reduce((max, p) => Math.max(max, p.orbitAu), 0)
      const kuiper = beltsOf(SEED, sid).find((b) => b.kind === 'kuiper')
      if (kuiper == null) continue
      expect(kuiper.innerAu).toBeGreaterThan(outermostAu)
    }
  })

  it('암석대는 인접한 두 행성 궤도 사이에 온전히 들어간다 (겹침 없음)', () => {
    const TRIALS = 400
    for (let i = 0; i < TRIALS; i++) {
      const sid = makeStarId({ sx: 2, sy: 5, sz: 6 }, i)
      const planets = planetsOf(SEED, sid)
      const rocky = beltsOf(SEED, sid).find((b) => b.kind === 'rocky')
      if (rocky == null) continue
      // 벨트 내부에 궤도를 두는 행성이 없어야 한다.
      const planetInsideBelt = planets.some(
        (p) => p.orbitAu > rocky.innerAu && p.orbitAu < rocky.outerAu,
      )
      expect(planetInsideBelt).toBe(false)
    }
  })

  it('실제 별 표본에서 암석대·카이퍼대·무벨트 시스템이 모두 등장한다 (물리 기반 분포)', () => {
    const seed = parseSeed('LIFE1')!
    const stars = sampleRealStars(seed)
    let hasRocky = false
    let hasKuiper = false
    let hasEmpty = false
    for (const star of stars) {
      const belts = beltsOf(seed, star.id)
      if (belts.length === 0) hasEmpty = true
      if (belts.some((b) => b.kind === 'rocky')) hasRocky = true
      if (belts.some((b) => b.kind === 'kuiper')) hasKuiper = true
    }
    expect(hasRocky).toBe(true)
    expect(hasKuiper).toBe(true)
    expect(hasEmpty).toBe(true)
  })

  it('잔해원반 빈도가 분광형에 의존한다 — 조기형 별이 M왜성보다 벨트가 흔하다 (고증)', () => {
    // Herschel/DEBRIS 검출률: 카이퍼대(차가운 원반)는 A~F형에서 흔하고 M형에서 급감한다.
    // 확률표를 문헌값으로 두었으니, 실제 별 표본의 카이퍼대 검출률도 그 서열을 따라야 한다.
    const seed = parseSeed('LIFE1')!
    const stars = sampleRealStars(seed)
    const kuiperCount: Partial<Record<SpectralClass, number>> = {}
    const total: Partial<Record<SpectralClass, number>> = {}
    for (const star of stars) {
      total[star.spectral] = (total[star.spectral] ?? 0) + 1
      if (beltsOf(seed, star.id).some((b) => b.kind === 'kuiper')) {
        kuiperCount[star.spectral] = (kuiperCount[star.spectral] ?? 0) + 1
      }
    }
    const rate = (c: SpectralClass) => (kuiperCount[c] ?? 0) / (total[c] ?? 1)
    // 조기형(F·G) 카이퍼대 검출률이 M형보다 뚜렷이 높다 — 문헌 서열 보존.
    expect(rate('F')).toBeGreaterThan(rate('M'))
    expect(rate('G')).toBeGreaterThan(rate('M'))
    expect(rate('K')).toBeGreaterThan(rate('M'))
  })

  it('벨트 생성은 행성·위성 출력에 영향을 주지 않는다 (스트림 격리)', () => {
    const sid = makeStarId({ sx: 1, sy: 2, sz: 3 }, 0)
    const planetsBefore = planetsOf(SEED, sid)
    const moonsBefore = moonsOf(SEED, planetsBefore[0]!)
    beltsOf(SEED, sid)
    expect(planetsOf(SEED, sid)).toEqual(planetsBefore)
    expect(moonsOf(SEED, planetsBefore[0]!)).toEqual(moonsBefore)
  })
})

describe('beltsOf — 태양계(Sol) 실제 소행성대', () => {
  it('시드와 무관하게 동일한 태양계 벨트를 반환한다', () => {
    const other = parseSeed('OTHERSEED')!
    expect(beltsOf(other, SOL_STAR_ID)).toEqual(beltsOf(SEED, SOL_STAR_ID))
  })

  it('메인 소행성대와 카이퍼대 2개를 가진다', () => {
    const belts = beltsOf(SEED, SOL_STAR_ID)
    expect(belts.map((b) => b.kind)).toEqual(['rocky', 'kuiper'])
  })

  it('메인벨트는 화성(1.5)–목성(2.5) 사이, 카이퍼대는 해왕성(6.0) 바깥이다', () => {
    const [rocky, kuiper] = beltsOf(SEED, SOL_STAR_ID)
    expect(rocky!.innerAu).toBeGreaterThan(1.5)
    expect(rocky!.outerAu).toBeLessThan(2.5)
    expect(kuiper!.innerAu).toBeGreaterThan(6.0)
  })
})
