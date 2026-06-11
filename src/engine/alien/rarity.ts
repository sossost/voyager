import type { WeightedEntry } from '../rng/streams'

export const RARITIES = ['common', 'rare', 'epic', 'legendary'] as const
export type Rarity = (typeof RARITIES)[number]

/** 조우 시 희귀도 출현 가중치 (01-spec.md 핵심 수치: 70/22/7/1). */
export const RARITY_WEIGHTS: readonly WeightedEntry<Rarity>[] = [
  { value: 'common', weight: 70 },
  { value: 'rare', weight: 22 },
  { value: 'epic', weight: 7 },
  { value: 'legendary', weight: 1 },
]

export function isRarity(value: unknown): value is Rarity {
  return typeof value === 'string' && (RARITIES as readonly string[]).includes(value)
}
