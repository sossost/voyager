import { describe, expect, it } from 'vitest'

import { PHENOMENA_BY_KIND, PHENOMENA_CATALOG } from './phenomena'

describe('PHENOMENA_CATALOG', () => {
  it('이색 천체 4종을 담고 주계열성은 제외한다', () => {
    const kinds = PHENOMENA_CATALOG.map((archetype) => archetype.kind).sort()
    expect(kinds).toEqual(['black_hole', 'pulsar', 'red_giant', 'white_dwarf'])
  })

  it('적색거성·백색왜성은 비범 희귀도다 (흔한 분광형 출현)', () => {
    expect(PHENOMENA_BY_KIND.get('red_giant')?.rarity).toBe('uncommon')
    expect(PHENOMENA_BY_KIND.get('white_dwarf')?.rarity).toBe('uncommon')
  })

  it('모든 항목에 라벨·로어·희귀도가 있다', () => {
    for (const archetype of PHENOMENA_CATALOG) {
      expect(archetype.label).not.toBe('')
      expect(archetype.lore.length).toBeGreaterThan(10)
      expect(['uncommon', 'rare', 'legendary']).toContain(archetype.rarity)
    }
  })

  it('블랙홀은 전설 희귀도다', () => {
    expect(PHENOMENA_BY_KIND.get('black_hole')?.rarity).toBe('legendary')
  })

  it('펄서는 희귀 희귀도다', () => {
    expect(PHENOMENA_BY_KIND.get('pulsar')?.rarity).toBe('rare')
  })
})

describe('PHENOMENA_BY_KIND', () => {
  it('카탈로그 전체를 kind로 색인한다 (도감 재생성용 단일 소스)', () => {
    expect(PHENOMENA_BY_KIND.size).toBe(PHENOMENA_CATALOG.length)
    for (const archetype of PHENOMENA_CATALOG) {
      expect(PHENOMENA_BY_KIND.get(archetype.kind)).toBe(archetype)
    }
  })
})
