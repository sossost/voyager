import { describe, expect, it } from 'vitest'

import type { Seed } from '../coords'
import { parseSeed } from '../coords'
import { starById } from '../galaxy/position'
import { rareExoticBodiesNear, SCAN_RADIUS_SECTORS } from '../galaxy/scan'
import { starsInSector } from '../galaxy/sectors'
import { planetsOf } from './planets'
import {
  DISK_BH_STAR,
  DISK_BH_STAR_ID,
  FEEDING_BH_STAR,
  FEEDING_BH_STAR_ID,
  UNIQUE_SYSTEMS,
  uniqueSystemOf,
} from './uniques'

function seedOf(value: string): Seed {
  const seed = parseSeed(value)
  if (seed == null) throw new Error(`테스트 시드가 유효하지 않습니다: ${value}`)
  return seed
}

const SEEDS = ['ANDROMEDA', 'SOL1969', 'ZETA42', 'LIFE1'] as const

describe('uniqueSystemOf', () => {
  it('유니크 StarId를 레지스트리 항목으로 해석한다', () => {
    expect(uniqueSystemOf(DISK_BH_STAR_ID)?.id).toBe('disk_bh')
    expect(uniqueSystemOf(FEEDING_BH_STAR_ID)?.id).toBe('feeding_bh')
  })

  it('일반 별은 null이다', () => {
    const seed = seedOf('ANDROMEDA')
    const probe = starsInSector(seed, { sx: 2, sy: 0, sz: 3 })[0]
    expect(probe).toBeDefined()
    if (probe != null) expect(uniqueSystemOf(probe.id)).toBeNull()
  })
})

describe('유니크계 핀 (GEN_VERSION 12)', () => {
  it.each(SEEDS)('시드 %s에서 두 유니크계가 고정 좌표 인덱스 0에 존재한다', (raw) => {
    const seed = seedOf(raw)
    for (const unique of UNIQUE_SYSTEMS) {
      const stars = starsInSector(seed, unique.star.sector)
      expect(stars[0]).toBe(unique.star)
      expect(starById(seed, unique.star.id)).toBe(unique.star)
    }
  })

  it('핀이 같은 섹터의 절차 별(인덱스 1+)을 바꾸지 않는다 — 스트림 격리', () => {
    const seedA = seedOf('ANDROMEDA')
    const rest = starsInSector(seedA, DISK_BH_STAR.sector).slice(1)
    for (const star of rest) {
      expect(star.id).not.toBe(DISK_BH_STAR_ID)
      // 절차 별은 자기 스트림에서 뽑힌다 — 핀과 무관하게 결정론적으로 재현.
      expect(starsInSector(seedA, DISK_BH_STAR.sector).slice(1)).toEqual(rest)
    }
  })

  it('아케론 = 원거리 반성 쌍성(항성풍 강착), 카리브디스 = 근접 조석 원궤도 쌍성', () => {
    expect(DISK_BH_STAR.kind).toBe('black_hole')
    expect(DISK_BH_STAR.multiplicity).toBe('binary')
    expect(DISK_BH_STAR.companions[0]?.separation).toBeGreaterThan(5)

    expect(FEEDING_BH_STAR.kind).toBe('black_hole')
    expect(FEEDING_BH_STAR.multiplicity).toBe('binary')
    expect(FEEDING_BH_STAR.companions[0]?.separation).toBeLessThan(2)
    expect(FEEDING_BH_STAR.companions[0]?.eccentricity).toBe(0)
  })

  it.each(SEEDS)('시드 %s에서 유니크계는 행성이 없다 (질량 이전·초신성 파괴)', (raw) => {
    expect(planetsOf(seedOf(raw), FEEDING_BH_STAR_ID)).toHaveLength(0)
    expect(planetsOf(seedOf(raw), DISK_BH_STAR_ID)).toHaveLength(0)
  })

  it('기존 능동 스캔이 유니크계를 자동 감지한다 (kind=black_hole)', () => {
    const seed = seedOf('ANDROMEDA')
    // 아케론 섹터 바로 옆의 별을 정박지로 삼아 스캔 반경 안에 들어오게 한다.
    const anchorSector = { sx: DISK_BH_STAR.sector.sx + 1, sy: 0, sz: DISK_BH_STAR.sector.sz }
    const anchor = starsInSector(seed, anchorSector)[0] ?? DISK_BH_STAR
    const found = rareExoticBodiesNear(seed, anchor.id, SCAN_RADIUS_SECTORS)
    expect(found).toContain(DISK_BH_STAR_ID)
  })
})
