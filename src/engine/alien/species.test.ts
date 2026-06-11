import { describe, expect, it } from 'vitest'

import { PALETTE_FAMILIES, PART_SLOTS, SPECIES_BY_RARITY, SPECIES_CATALOG } from './species'

describe('종족 카탈로그', () => {
  it('정확히 60종이다', () => {
    expect(SPECIES_CATALOG).toHaveLength(60)
  })

  it('희귀도 분포가 커먼32/레어18/에픽8/레전더리2다', () => {
    expect(SPECIES_BY_RARITY.common).toHaveLength(32)
    expect(SPECIES_BY_RARITY.rare).toHaveLength(18)
    expect(SPECIES_BY_RARITY.epic).toHaveLength(8)
    expect(SPECIES_BY_RARITY.legendary).toHaveLength(2)
  })

  it('id는 유일하다', () => {
    const ids = SPECIES_CATALOG.map((species) => species.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('모든 종족이 body 시그니처를 가지고 모든 슬롯을 채울 수 있다', () => {
    for (const species of SPECIES_CATALOG) {
      expect(species.fixedParts.body).toBeDefined()

      for (const slot of PART_SLOTS) {
        const fixed = species.fixedParts[slot]
        const allowed = species.allowedParts[slot]
        const isResolvable = fixed != null || (allowed != null && allowed.length > 0)
        expect(isResolvable).toBe(true)
        // fixed와 allowed가 동시에 있으면 모호하다 — validateSpecies와 동일 규칙
        expect(fixed != null && allowed != null).toBe(false)
      }
    }
  })

  it('모든 paletteFamily가 팔레트 정의에 존재한다', () => {
    for (const species of SPECIES_CATALOG) {
      expect(PALETTE_FAMILIES[species.paletteFamily]).toBeDefined()
    }
  })
})
