import type { AlienIndividual, IndividualId, PartSlot, SpeciesArchetype } from '@/engine'
import { PART_SLOTS } from '@/engine'

const SILHOUETTE_PALETTE = {
  primary: '#5a5f76',
  secondary: '#3a3f54',
  accent: '#7a7f96',
} as const

/** 미발견 종족의 실루엣 미리보기용 가짜 개체 — 시그니처(fixedParts)가 윤곽을 암시한다. */
export function archetypePreview(species: SpeciesArchetype): AlienIndividual {
  const parts = {} as Record<PartSlot, string>
  for (const slot of PART_SLOTS) {
    parts[slot] = species.fixedParts[slot] ?? species.allowedParts[slot]?.[0] ?? ''
  }

  return {
    individualId: `preview-${species.id}` as IndividualId,
    speciesId: species.id,
    rarity: species.rarity,
    parts,
    palette: SILHOUETTE_PALETTE,
    name: '???',
  }
}
