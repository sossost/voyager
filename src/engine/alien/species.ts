import palettesJson from '../../data/species/palettes.json'
import speciesJson from '../../data/species/species.json'
import type { Rarity } from './rarity'
import { isRarity } from './rarity'

export const PART_SLOTS = ['body', 'eyes', 'mouth', 'appendage', 'pattern'] as const
export type PartSlot = (typeof PART_SLOTS)[number]

export interface AlienPalette {
  readonly primary: string
  readonly secondary: string
  readonly accent: string
}

export interface SpeciesArchetype {
  readonly id: string
  readonly name: string
  readonly rarity: Rarity
  readonly lore: string
  /** 종족 정체성 시그니처 — 모든 개체가 공유 (body는 항상 고정). */
  readonly fixedParts: Partial<Readonly<Record<PartSlot, string>>>
  /** 개체 변형 허용 풀 — fixed가 없는 슬롯은 여기서 뽑는다. */
  readonly allowedParts: Partial<Readonly<Record<PartSlot, readonly string[]>>>
  readonly paletteFamily: string
}

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/

export function validatePalettes(raw: unknown): Readonly<Record<string, readonly AlienPalette[]>> {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('palettes.json: 객체가 아닙니다')
  }
  for (const [family, palettes] of Object.entries(raw)) {
    if (!Array.isArray(palettes) || palettes.length === 0) {
      throw new Error(`palettes.json: ${family} 팔레트가 비어 있습니다`)
    }
    for (const palette of palettes) {
      for (const role of ['primary', 'secondary', 'accent'] as const) {
        const color: unknown = palette[role]
        if (typeof color !== 'string' || !HEX_COLOR_PATTERN.test(color)) {
          throw new Error(`palettes.json: ${family}의 ${role} 색상이 유효하지 않습니다`)
        }
      }
    }
  }
  return raw as Readonly<Record<string, readonly AlienPalette[]>>
}

export function validateSpecies(raw: unknown, paletteFamilies: readonly string[]): readonly SpeciesArchetype[] {
  if (!Array.isArray(raw)) {
    throw new Error('species.json: 배열이 아닙니다')
  }

  const seenIds = new Set<string>()
  for (const entry of raw as SpeciesArchetype[]) {
    if (typeof entry.id !== 'string' || entry.id === '') {
      throw new Error('species.json: id가 비어 있는 종족이 있습니다')
    }
    if (seenIds.has(entry.id)) {
      throw new Error(`species.json: 중복 id ${entry.id}`)
    }
    seenIds.add(entry.id)

    if (typeof entry.name !== 'string' || entry.name === '') {
      throw new Error(`species.json: ${entry.id}의 name이 비어 있습니다`)
    }
    if (!isRarity(entry.rarity)) {
      throw new Error(`species.json: ${entry.id}의 rarity가 유효하지 않습니다`)
    }
    if (entry.fixedParts.body == null) {
      throw new Error(`species.json: ${entry.id}는 body가 고정되어야 합니다 (종족 정체성)`)
    }
    if (!paletteFamilies.includes(entry.paletteFamily)) {
      throw new Error(`species.json: ${entry.id}의 paletteFamily(${entry.paletteFamily})가 존재하지 않습니다`)
    }

    for (const slot of PART_SLOTS) {
      const fixed = entry.fixedParts[slot]
      const allowed = entry.allowedParts[slot]
      if (fixed != null && allowed != null) {
        throw new Error(`species.json: ${entry.id}의 ${slot}는 fixed와 allowed에 동시에 있을 수 없습니다`)
      }
      if (fixed == null && (allowed == null || allowed.length === 0)) {
        throw new Error(`species.json: ${entry.id}의 ${slot} 슬롯을 채울 방법이 없습니다`)
      }
    }
  }
  return raw as readonly SpeciesArchetype[]
}

export const PALETTE_FAMILIES = validatePalettes(palettesJson)
export const SPECIES_CATALOG = validateSpecies(speciesJson, Object.keys(PALETTE_FAMILIES))

export const SPECIES_BY_RARITY: Readonly<Record<Rarity, readonly SpeciesArchetype[]>> = {
  common: SPECIES_CATALOG.filter((species) => species.rarity === 'common'),
  rare: SPECIES_CATALOG.filter((species) => species.rarity === 'rare'),
  epic: SPECIES_CATALOG.filter((species) => species.rarity === 'epic'),
  legendary: SPECIES_CATALOG.filter((species) => species.rarity === 'legendary'),
}

export const SPECIES_BY_ID: ReadonlyMap<string, SpeciesArchetype> = new Map(
  SPECIES_CATALOG.map((species) => [species.id, species]),
)
