import { describe, expect, it } from 'vitest'

import type { Seed } from '@/engine'
import { originStar, parseSeed, SOL_STAR_ID, starsInSector } from '@/engine'
import { arrivalFramingOf, systemExtentOf } from '@/scenes/system/systemExtent'

function seedOf(value: string): Seed {
  const seed = parseSeed(value)
  if (seed == null) throw new Error(`테스트 시드가 유효하지 않습니다: ${value}`)
  return seed
}

const seed = seedOf('EXTENT1')

describe('arrivalFramingOf', () => {
  it('태양계는 기존 고정 프레이밍과 동치다 — zoom 1.0 · 고도 28°', () => {
    const framing = arrivalFramingOf(seed, SOL_STAR_ID)
    expect(framing.zoom).toBe(1)
    expect(framing.elevationDeg).toBe(28)
  })

  it('모든 표본 계에서 zoom ∈ [0.45, 1] · 고도 ∈ [28°, 38°]를 지킨다', () => {
    const stars = [
      originStar(seed),
      ...starsInSector(seed, { sx: 0, sy: 0, sz: 1 }).map((star) => star.id),
      ...starsInSector(seed, { sx: 1, sy: 0, sz: 0 }).map((star) => star.id),
    ]
    for (const starId of stars) {
      const framing = arrivalFramingOf(seed, starId)
      expect(framing.zoom).toBeGreaterThanOrEqual(0.45)
      expect(framing.zoom).toBeLessThanOrEqual(1)
      expect(framing.elevationDeg).toBeGreaterThanOrEqual(28)
      expect(framing.elevationDeg).toBeLessThanOrEqual(38)
    }
  })

  it('외곽 반경이 클수록 zoom이 크다(멀리 정박) — 단조성', () => {
    const stars = [
      ...starsInSector(seed, { sx: 0, sy: 0, sz: 1 }),
      ...starsInSector(seed, { sx: 1, sy: 0, sz: 0 }),
    ]
    const sorted = [...stars].sort(
      (a, b) => systemExtentOf(seed, a.id) - systemExtentOf(seed, b.id),
    )
    const zooms = sorted.map((star) => arrivalFramingOf(seed, star.id).zoom)
    for (let i = 1; i < zooms.length; i++) {
      expect(zooms[i]).toBeGreaterThanOrEqual(zooms[i - 1] as number)
    }
  })
})
