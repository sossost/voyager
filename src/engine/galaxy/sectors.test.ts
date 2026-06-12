import { describe, expect, it } from 'vitest'

import type { Seed } from '../coords'
import { parseSeed } from '../coords'
import {
  GALAXY_HALF_THICKNESS_SECTORS,
  GALAXY_RADIUS_SECTORS,
  SECTOR_SIZE,
  sectorDensity,
} from './density'
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
})
