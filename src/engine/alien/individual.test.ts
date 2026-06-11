import { describe, expect, it } from 'vitest'

import type { Seed } from '../coords'
import { makePlanetId, makeStarId, parseSeed } from '../coords'
import { alienAt } from './individual'
import type { Rarity } from './rarity'
import { PART_SLOTS, SPECIES_BY_ID } from './species'

function seedOf(value: string): Seed {
  const seed = parseSeed(value)
  if (seed == null) throw new Error(`테스트 시드가 유효하지 않습니다: ${value}`)
  return seed
}

const seed = seedOf('ALIENTEST')

function planetIdAt(index: number): ReturnType<typeof makePlanetId> {
  const starId = makeStarId({ sx: index % 40, sy: (index % 5) - 2, sz: Math.floor(index / 40) }, index % 6)
  return makePlanetId(starId, index % 8)
}

describe('alienAt', () => {
  it('같은 (seed, planetId)는 항상 같은 개체를 만든다 — 재방문 = 동일 개체', () => {
    const planetId = planetIdAt(7)
    expect(alienAt(seed, planetId)).toEqual(alienAt(seed, planetId))
  })

  it('개체의 파츠는 종족 제약(fixedParts/allowedParts)을 벗어나지 않는다', () => {
    for (let i = 0; i < 300; i++) {
      const alien = alienAt(seed, planetIdAt(i))
      const species = SPECIES_BY_ID.get(alien.speciesId)
      expect(species).toBeDefined()
      if (species == null) continue

      expect(alien.rarity).toBe(species.rarity)
      for (const slot of PART_SLOTS) {
        const fixed = species.fixedParts[slot]
        if (fixed != null) {
          expect(alien.parts[slot]).toBe(fixed)
        } else {
          expect(species.allowedParts[slot]).toContain(alien.parts[slot])
        }
      }
    }
  })

  it('이름과 팔레트가 채워진다', () => {
    const alien = alienAt(seed, planetIdAt(11))
    expect(alien.name).not.toBe('')
    expect(alien.palette.primary).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('individualId는 행성마다 고유하다 (10k 충돌 검사)', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 10_000; i++) {
      ids.add(alienAt(seed, planetIdAt(i)).individualId)
    }
    expect(ids.size).toBe(10_000)
  })

  it('몬테카를로 10k: 희귀도 분포가 70/22/7/1에서 ±1%p 이내다', () => {
    const counts: Record<Rarity, number> = { common: 0, rare: 0, epic: 0, legendary: 0 }
    const TOTAL = 10_000

    for (let i = 0; i < TOTAL; i++) {
      counts[alienAt(seed, planetIdAt(i)).rarity] += 1
    }

    expect(counts.common / TOTAL).toBeGreaterThan(0.69)
    expect(counts.common / TOTAL).toBeLessThan(0.71)
    expect(counts.rare / TOTAL).toBeGreaterThan(0.21)
    expect(counts.rare / TOTAL).toBeLessThan(0.23)
    expect(counts.epic / TOTAL).toBeGreaterThan(0.06)
    expect(counts.epic / TOTAL).toBeLessThan(0.08)
    expect(counts.legendary / TOTAL).toBeGreaterThan(0)
    expect(counts.legendary / TOTAL).toBeLessThan(0.02)
  })
})
