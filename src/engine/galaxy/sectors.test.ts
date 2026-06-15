import { describe, expect, it } from 'vitest'

import type { Seed } from '../coords'
import { parseSeed } from '../coords'
import {
  GALAXY_HALF_THICKNESS_SECTORS,
  GALAXY_RADIUS_SECTORS,
  SECTOR_SIZE,
  sectorDensity,
} from './density'
import type { SpectralClass, StarKind } from './sectors'
import { MAX_STARS_PER_SECTOR, SOL_STAR, starsInSector } from './sectors'
import { SOL_SECTOR, SOL_STAR_ID, SOL_LOCAL_POS } from '../system/sol'

function seedOf(value: string): Seed {
  const seed = parseSeed(value)
  if (seed == null) throw new Error(`테스트 시드가 유효하지 않습니다: ${value}`)
  return seed
}

const seed = seedOf('GALAXYTEST')

describe('sectorDensity', () => {
  it('은하 중심부가 외곽보다 밀도가 높다', () => {
    const core = sectorDensity({ sx: 2, sy: 0, sz: 2 })
    const rim = sectorDensity({ sx: 40, sy: 0, sz: 20 })
    expect(core).toBeGreaterThan(rim)
  })

  it('원반 반경 밖과 두께 밖은 밀도 0이다', () => {
    expect(sectorDensity({ sx: GALAXY_RADIUS_SECTORS + 1, sy: 0, sz: 0 })).toBe(0)
    expect(sectorDensity({ sx: 0, sy: GALAXY_HALF_THICKNESS_SECTORS + 1, sz: 0 })).toBe(0)
    expect(sectorDensity({ sx: 0, sy: -(GALAXY_HALF_THICKNESS_SECTORS + 1), sz: 0 })).toBe(0)
  })

  it('밀도는 [0, 1] 범위다', () => {
    for (let sx = -50; sx <= 50; sx += 10) {
      for (let sz = -50; sz <= 50; sz += 10) {
        const density = sectorDensity({ sx, sy: 0, sz })
        expect(density).toBeGreaterThanOrEqual(0)
        expect(density).toBeLessThanOrEqual(1)
      }
    }
  })

  it('중심 섹터 (0,0,0)의 밀도는 1이다 (벌지 보장)', () => {
    expect(sectorDensity({ sx: 0, sy: 0, sz: 0 })).toBe(1)
  })

  it('같은 반경대에서 나선팔 위는 팔 사이보다 밀도가 높다', () => {
    // 반경 22~26 고리의 모든 섹터를 훑어 최대/최소를 비교 — 팔 변조가 실제로 작동하는지 확인
    // (engine/ 테스트도 순수성 린트 대상이라 Math.cos 대신 정수 격자 스캔을 쓴다)
    const densities: number[] = []
    for (let sx = -26; sx <= 26; sx++) {
      for (let sz = -26; sz <= 26; sz++) {
        const radius = Math.sqrt(sx * sx + sz * sz)
        if (radius < 22 || radius > 26) continue
        densities.push(sectorDensity({ sx, sy: 0, sz }))
      }
    }
    const onArm = Math.max(...densities)
    const betweenArms = Math.min(...densities)
    expect(onArm).toBeGreaterThan(betweenArms * 2)
  })

  it('원반 평면(sy=0)이 평면 밖(|sy|=4)보다 밀도가 높다', () => {
    const inPlane = sectorDensity({ sx: 12, sy: 0, sz: 9 })
    const offPlane = sectorDensity({ sx: 12, sy: 4, sz: 9 })
    expect(inPlane).toBeGreaterThan(offPlane)
  })
})

describe('starsInSector', () => {
  it('같은 (seed, sector)는 항상 같은 별 목록을 만든다 (이름 포함)', () => {
    const sector = { sx: 3, sy: 0, sz: -7 }
    expect(starsInSector(seed, sector)).toEqual(starsInSector(seed, sector))
  })

  it('시드가 다르면 다른 별이 생성된다', () => {
    const sector = { sx: 3, sy: 0, sz: -7 }
    const universeA = starsInSector(seedOf('UNIVERSEA'), sector)
    const universeB = starsInSector(seedOf('UNIVERSEB'), sector)
    expect(universeA).not.toEqual(universeB)
  })

  it('별 개수는 0~MAX 범위이고 로컬 좌표는 섹터 안에 있다', () => {
    for (let sx = -10; sx <= 10; sx += 5) {
      const stars = starsInSector(seed, { sx, sy: 0, sz: 4 })
      expect(stars.length).toBeLessThanOrEqual(MAX_STARS_PER_SECTOR)

      for (const star of stars) {
        for (const coordinate of star.localPos) {
          expect(coordinate).toBeGreaterThanOrEqual(0)
          expect(coordinate).toBeLessThan(SECTOR_SIZE)
        }
        expect(star.name).not.toBe('')
        expect(star.id).toBe(`${sx}:0:4:${stars.indexOf(star)}`)
      }
    }
  })

  it('은하 밖 섹터는 빈 배열을 반환한다', () => {
    expect(starsInSector(seed, { sx: 100, sy: 0, sz: 100 })).toEqual([])
  })

  it('중심부 섹터에는 별이 실제로 존재한다', () => {
    const stars = starsInSector(seed, { sx: 1, sy: 0, sz: 1 })
    expect(stars.length).toBeGreaterThan(0)
  })

  it('Sol 섹터(26,0,10) 인덱스 0은 항상 태양이다 — 시드 무관', () => {
    for (const s of [seed, seedOf('ANOTHERSEED'), seedOf('ZETA42')]) {
      const first = starsInSector(s, SOL_SECTOR)[0]
      expect(first).toEqual(SOL_STAR)
      expect(first?.id).toBe(SOL_STAR_ID)
      expect(first?.name).toBe('태양')
      expect(first?.spectral).toBe('G')
    }
  })

  it('SOL_STAR 좌표는 SOL_LOCAL_POS와 일치한다', () => {
    expect(SOL_STAR.localPos).toEqual(SOL_LOCAL_POS)
  })

  it('SOL_STAR는 단일성이고 동반성이 없다', () => {
    expect(SOL_STAR.multiplicity).toBe('single')
    expect(SOL_STAR.companions).toEqual([])
  })

  it('SOL_STAR는 주계열성이다 (kind = main_sequence)', () => {
    expect(SOL_STAR.kind).toBe('main_sequence')
  })
})

/** 질량 내림차순 — 동반성 제약 검증용. */
const SPECTRAL_BY_MASS: readonly SpectralClass[] = ['O', 'B', 'A', 'F', 'G', 'K', 'M']

/** 은하 평면을 훑어 충분한 표본의 별을 모은다 (분포·불변식 검증용). */
function sampleStars(sampleSeed: Seed) {
  const stars = []
  for (let sx = -20; sx <= 20; sx++) {
    for (let sz = -20; sz <= 20; sz++) {
      stars.push(...starsInSector(sampleSeed, { sx, sy: 0, sz }))
    }
  }
  return stars
}

describe('다중성계 (binary-stars, GEN_VERSION 4)', () => {
  const sample = sampleStars(seedOf('MULTIPLICITY'))

  it('companions 개수는 multiplicity와 일치한다 (single:0 binary:1 triple:2)', () => {
    for (const star of sample) {
      const expected = star.multiplicity === 'single' ? 0 : star.multiplicity === 'binary' ? 1 : 2
      expect(star.companions.length).toBe(expected)
    }
  })

  it('삼중성은 [inner, outer] 계층형이다', () => {
    const triples = sample.filter((s) => s.multiplicity === 'triple')
    expect(triples.length).toBeGreaterThan(0)
    for (const star of triples) {
      expect(star.companions[0]?.hierarchy).toBe('inner')
      expect(star.companions[1]?.hierarchy).toBe('outer')
    }
  })

  it('모든 동반성 분광형은 주성 이하 질량이다 (SPECTRAL_BY_MASS 인덱스 ≥ 주성)', () => {
    for (const star of sample) {
      const primaryIndex = SPECTRAL_BY_MASS.indexOf(star.spectral)
      for (const companion of star.companions) {
        expect(SPECTRAL_BY_MASS.indexOf(companion.spectral)).toBeGreaterThanOrEqual(primaryIndex)
      }
    }
  })

  it('동반성 궤도 파라미터는 유효 범위 안에 있다', () => {
    for (const star of sample) {
      for (const companion of star.companions) {
        expect(companion.separation).toBeGreaterThan(0)
        expect(companion.eccentricity).toBeGreaterThanOrEqual(0)
        expect(companion.eccentricity).toBeLessThan(0.6)
        expect(companion.phase).toBeGreaterThanOrEqual(0)
        expect(companion.phase).toBeLessThan(1)
      }
    }
  })

  it('계층형 삼중성에서 outer 동반성이 inner보다 멀다', () => {
    const triples = sample.filter((s) => s.multiplicity === 'triple')
    for (const star of triples) {
      const inner = star.companions[0]
      const outer = star.companions[1]
      if (inner == null || outer == null) continue
      expect(outer.separation).toBeGreaterThan(inner.separation)
    }
  })

  it('다중성 분포가 목표 비율 근방이다 (single≈55 / binary≈33 / triple≈12)', () => {
    const counts = { single: 0, binary: 0, triple: 0 }
    for (const star of sample) counts[star.multiplicity]++
    const total = sample.length
    expect(total).toBeGreaterThan(500) // 표본 충분성
    // 허용 오차 ±6%p — 표본이 수백~수천이라 충분히 수렴
    expect(counts.single / total).toBeGreaterThan(0.49)
    expect(counts.single / total).toBeLessThan(0.61)
    expect(counts.binary / total).toBeGreaterThan(0.27)
    expect(counts.binary / total).toBeLessThan(0.39)
    expect(counts.triple / total).toBeGreaterThan(0.06)
    expect(counts.triple / total).toBeLessThan(0.18)
  })

  it('M형 주성은 동반성도 항상 M형이다 (질량 제약 경계)', () => {
    const mPrimaries = sample.filter((s) => s.spectral === 'M' && s.companions.length > 0)
    expect(mPrimaries.length).toBeGreaterThan(0)
    for (const star of mPrimaries) {
      for (const companion of star.companions) {
        expect(companion.spectral).toBe('M')
      }
    }
  })

  it('같은 (seed, sector)는 companions까지 동일하다 (결정론)', () => {
    const sector = { sx: 5, sy: 0, sz: -3 }
    const a = starsInSector(seedOf('DETERM'), sector)
    const b = starsInSector(seedOf('DETERM'), sector)
    expect(a).toEqual(b)
  })
})

/** 별 종류 — 주계열성 + 이색 천체 4종. */
const STAR_KINDS: readonly StarKind[] = [
  'main_sequence',
  'red_giant',
  'white_dwarf',
  'pulsar',
  'black_hole',
]

/** 대질량 분광형 — 블랙홀·펄서의 진화 종착이 되는 별. */
const MASSIVE_CLASSES: readonly SpectralClass[] = ['O', 'B']

describe('이색 천체 (exotic-bodies, GEN_VERSION 5)', () => {
  const sample = sampleStars(seedOf('STARKINDS'))

  it('표본이 분포 검증에 충분하다', () => {
    expect(sample.length).toBeGreaterThan(500)
  })

  it('모든 별은 유효한 kind를 가진다', () => {
    for (const star of sample) {
      expect(STAR_KINDS).toContain(star.kind)
    }
  })

  it('주계열성이 압도적 다수다 (long-tail 희귀도)', () => {
    const mainSequence = sample.filter((s) => s.kind === 'main_sequence').length
    expect(mainSequence / sample.length).toBeGreaterThan(0.8)
  })

  it('이색 천체는 long-tail이다 (전체 exotic 비율 상한)', () => {
    const exotic = sample.filter((s) => s.kind !== 'main_sequence').length
    expect(exotic / sample.length).toBeLessThan(0.2)
  })

  it('블랙홀·펄서는 대질량(O/B) 분광형에서만 출현한다', () => {
    for (const star of sample) {
      if (star.kind === 'black_hole' || star.kind === 'pulsar') {
        expect(MASSIVE_CLASSES).toContain(star.spectral)
      }
    }
  })

  it('블랙홀·펄서는 전체의 ~1% 미만으로 희귀하다', () => {
    const remnants = sample.filter((s) => s.kind === 'black_hole' || s.kind === 'pulsar').length
    expect(remnants / sample.length).toBeLessThan(0.02)
  })

  it('적색거성·백색왜성은 우주에 실제로 존재한다', () => {
    expect(sample.some((s) => s.kind === 'red_giant')).toBe(true)
    expect(sample.some((s) => s.kind === 'white_dwarf')).toBe(true)
  })

  it('같은 (seed, sector)는 kind까지 동일하다 (결정론)', () => {
    const sector = { sx: 7, sy: 0, sz: -2 }
    const a = starsInSector(seedOf('KINDDETERM'), sector)
    const b = starsInSector(seedOf('KINDDETERM'), sector)
    expect(a).toEqual(b)
  })
})
