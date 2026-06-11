import { describe, expect, it } from 'vitest'

import type { Seed } from '../coords'
import { parseSeed } from '../coords'
import {
  GALAXY_HALF_THICKNESS_SECTORS,
  GALAXY_RADIUS_SECTORS,
  SECTOR_SIZE,
  sectorDensity,
} from './density'
import { MAX_STARS_PER_SECTOR, starsInSector } from './sectors'

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
})
