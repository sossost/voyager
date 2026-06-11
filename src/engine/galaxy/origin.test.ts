import { describe, expect, it } from 'vitest'

import type { Seed } from '../coords'
import { parseSeed } from '../coords'
import { originStar } from './origin'
import { starById, starWorldPosition } from './position'

function seedOf(value: string): Seed {
  const seed = parseSeed(value)
  if (seed == null) throw new Error(`테스트 시드가 유효하지 않습니다: ${value}`)
  return seed
}

describe('originStar', () => {
  it('같은 시드는 항상 같은 시작 별을 얻는다', () => {
    const seed = seedOf('ORIGINTEST')
    expect(originStar(seed)).toBe(originStar(seed))
  })

  it('시작 별은 실제로 존재하는 별이다', () => {
    const seed = seedOf('ORIGINTEST')
    expect(starById(seed, originStar(seed))).not.toBeNull()
  })

  it('시드 LIFE1의 시작 별은 0:0:0:0이다 — E2E 코어 루프가 의존하는 고정 계약', () => {
    // 중심 섹터 밀도 1 보장(density.ts) 덕에 모든 시드가 0:0:0:0에서 시작하지만,
    // E2E가 의존하는 LIFE1만큼은 회귀 시 즉시 단위 레벨에서 잡는다.
    expect(originStar(seedOf('LIFE1'))).toBe('0:0:0:0')
  })
})

describe('starById / starWorldPosition', () => {
  const seed = seedOf('POSITIONTEST')

  it('존재하는 별의 월드 좌표 = 섹터 원점 + 로컬 좌표', () => {
    const starId = originStar(seed)
    const star = starById(seed, starId)
    const world = starWorldPosition(seed, starId)
    expect(star).not.toBeNull()
    expect(world).not.toBeNull()
    if (star == null || world == null) return

    expect(world[0]).toBe(star.sector.sx * 100 + star.localPos[0])
    expect(world[1]).toBe(star.sector.sy * 100 + star.localPos[1])
    expect(world[2]).toBe(star.sector.sz * 100 + star.localPos[2])
  })

  it('형식이 깨졌거나 존재하지 않는 별은 null이다', () => {
    expect(starById(seed, 'broken' as never)).toBeNull()
    expect(starById(seed, '0:0:0:9999' as never)).toBeNull()
    expect(starWorldPosition(seed, 'broken' as never)).toBeNull()
  })
})
