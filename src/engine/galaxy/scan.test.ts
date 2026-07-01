import { describe, expect, it } from 'vitest'

import type { Seed, StarId } from '../coords'
import { parseSeed } from '../coords'
import { GALAXY_HALF_THICKNESS_SECTORS, SECTOR_SIZE } from './density'
import { originStar } from './origin'
import { starById, starWorldPosition } from './position'
import { starsInSector } from './sectors'
import { RARE_EXOTIC_KINDS, rareExoticBodiesNear, SCAN_RADIUS_SECTORS } from './scan'

function seedOf(value: string): Seed {
  const seed = parseSeed(value)
  if (seed == null) throw new Error(`유효하지 않은 시드: ${value}`)
  return seed
}

/** 은하에서 첫 희귀 천체(블랙홀·펄서) 하나를 결정론적으로 찾는다 — 자기포함/거리 검증의 기준점. */
function findAnyRareExotic(seed: Seed): StarId | null {
  const RANGE = 30
  for (let sx = -RANGE; sx <= RANGE; sx++) {
    for (let sy = -GALAXY_HALF_THICKNESS_SECTORS; sy <= GALAXY_HALF_THICKNESS_SECTORS; sy++) {
      for (let sz = -RANGE; sz <= RANGE; sz++) {
        for (const star of starsInSector(seed, { sx, sy, sz })) {
          if (RARE_EXOTIC_KINDS.includes(star.kind)) return star.id
        }
      }
    }
  }
  return null
}

function worldDistanceSquared(seed: Seed, a: StarId, b: StarId): number {
  const pa = starWorldPosition(seed, a)
  const pb = starWorldPosition(seed, b)
  if (pa == null || pb == null) throw new Error('별 좌표 없음')
  const dx = pa[0] - pb[0]
  const dy = pa[1] - pb[1]
  const dz = pa[2] - pb[2]
  return dx * dx + dy * dy + dz * dz
}

const seed = seedOf('SCANTEST')
// 반경 내 특이 천체가 있어야 자기포함·거리·단조성 케이스가 의미를 가진다 — 없으면 즉시 실패.
const exoticId = findAnyRareExotic(seed)
if (exoticId == null) throw new Error('SCANTEST 시드에 희귀 천체가 없습니다 — 테스트 시드를 교체하세요')

describe('rareExoticBodiesNear (스캔 탐지)', () => {
  it('같은 입력은 항상 같은 결과 — 결정론', () => {
    const origin = originStar(seed)
    const first = rareExoticBodiesNear(seed, origin, SCAN_RADIUS_SECTORS)
    const second = rareExoticBodiesNear(seed, origin, SCAN_RADIUS_SECTORS)
    expect(first).toEqual(second)
  })

  it('반환된 별은 모두 희귀 천체(블랙홀·펄서)다', () => {
    const origin = exoticId
    // 넉넉한 반경으로 여러 개를 확보해 검증
    const found = rareExoticBodiesNear(seed, origin, 20)
    expect(found.length).toBeGreaterThan(0)
    for (const id of found) {
      const kind = starById(seed, id)?.kind
      expect(kind != null && RARE_EXOTIC_KINDS.includes(kind)).toBe(true) // 블랙홀·펄서만
    }
  })

  it('반환된 별은 모두 반경 구(球) 안에 있다', () => {
    const origin = exoticId
    const radius = 12
    const radiusWorld = radius * SECTOR_SIZE
    const radiusWorldSquared = radiusWorld * radiusWorld
    const found = rareExoticBodiesNear(seed, origin, radius)
    for (const id of found) {
      expect(worldDistanceSquared(seed, origin, id)).toBeLessThanOrEqual(radiusWorldSquared)
    }
  })

  it('반경을 넓히면 결과는 좁은 반경을 포함한다 — 단조성', () => {
    const origin = exoticId
    const narrow = new Set(rareExoticBodiesNear(seed, origin, 6))
    const wide = new Set(rareExoticBodiesNear(seed, origin, 14))
    for (const id of narrow) {
      expect(wide.has(id)).toBe(true)
    }
  })

  it('원점이 희귀 천체면 결과에 자기 자신을 포함한다', () => {
    const found = rareExoticBodiesNear(seed, exoticId, SCAN_RADIUS_SECTORS)
    expect(found).toContain(exoticId)
  })

  it('존재하지 않는 별에서 스캔하면 빈 배열', () => {
    const found = rareExoticBodiesNear(seed, '999:999:999:0' as StarId, SCAN_RADIUS_SECTORS)
    expect(found).toEqual([])
  })
})
