import { describe, expect, it } from 'vitest'

import type { Seed } from '../coords'
import { parseSeed } from '../coords'
import { starsInSector } from '../galaxy/sectors'
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

/**
 * 유니크계 백업 상태 검증 (2026-07-11, PR 재범위 — 렌즈 업그레이드 전용).
 * 재투입 시 이 테스트를 핀 존재·결정론·행성 0·스캔 감지 검증으로 되돌릴 것 (git 이력 ccbc038).
 */
describe('유니크계 — 전체 백업 상태', () => {
  it('레지스트리가 비어 있다 — 은하에 유니크계가 생성되지 않는다', () => {
    expect(UNIQUE_SYSTEMS).toHaveLength(0)
    expect(uniqueSystemOf(DISK_BH_STAR_ID)).toBeNull()
    expect(uniqueSystemOf(FEEDING_BH_STAR_ID)).toBeNull()
  })

  it('백업 좌표의 섹터는 절차 생성 그대로다 — 핀 상수가 끼어들지 않는다', () => {
    const seed = seedOf('ANDROMEDA')
    for (const backup of [DISK_BH_STAR, FEEDING_BH_STAR]) {
      for (const star of starsInSector(seed, backup.sector)) {
        expect(star).not.toBe(backup)
      }
    }
  })

  it('백업 상수는 보존된다 — 재투입 시 렌더 경로(원반·스트림·티어드롭)가 재사용한다', () => {
    expect(DISK_BH_STAR.kind).toBe('black_hole')
    expect(DISK_BH_STAR.multiplicity).toBe('binary')
    expect(DISK_BH_STAR.companions[0]?.separation).toBeGreaterThan(5)

    expect(FEEDING_BH_STAR.kind).toBe('black_hole')
    expect(FEEDING_BH_STAR.companions[0]?.separation).toBeLessThan(2)
    expect(FEEDING_BH_STAR.companions[0]?.eccentricity).toBe(0)
  })
})
