import type { IndividualId, PlanetId, Seed } from '../coords'
import { makeIndividualId } from '../coords'
import { alienName } from '../naming/names'
import { rngFor } from '../rng/streams'
import type { Rarity } from './rarity'
import { RARITY_WEIGHTS } from './rarity'
import type { AlienPalette, PartSlot } from './species'
import { PALETTE_FAMILIES, PART_SLOTS, SPECIES_BY_RARITY } from './species'

export interface AlienIndividual {
  readonly individualId: IndividualId
  readonly speciesId: string
  readonly rarity: Rarity
  readonly parts: Readonly<Record<PartSlot, string>>
  readonly palette: AlienPalette
  readonly name: string
}

/**
 * 행성 → 외계인 개체. 순수 함수 — 같은 (seed, planetId)는 항상 같은 개체를 만든다.
 * 재방문 = 동일 개체, individualId = 결정론 PK (중복 등록은 저장 계층 제약으로도 차단).
 *
 * 생명체 유무(hasLife) 판정은 호출자(explore 액션)의 책임이다.
 */
export function alienAt(seed: Seed, planetId: PlanetId): AlienIndividual {
  const rng = rngFor(seed, 'alien', planetId)
  // append-only draw 순서: rarity → species → 슬롯별 파츠 → 팔레트
  const rarity = rng.weighted(RARITY_WEIGHTS)
  const species = rng.pick(SPECIES_BY_RARITY[rarity])

  const parts = {} as Record<PartSlot, string>
  for (const slot of PART_SLOTS) {
    const fixed = species.fixedParts[slot]
    if (fixed != null) {
      parts[slot] = fixed
      continue
    }
    const pool = species.allowedParts[slot]
    /* v8 ignore next 3 -- validateSpecies가 모듈 로드 시점에 보장하는 도달 불가 방어선 */
    if (pool == null || pool.length === 0) {
      throw new Error(`종족 ${species.id}의 ${slot} 파츠 풀이 비어 있습니다`)
    }
    parts[slot] = rng.pick(pool)
  }

  const shades = PALETTE_FAMILIES[species.paletteFamily]
  /* v8 ignore next 3 -- validateSpecies가 모듈 로드 시점에 보장하는 도달 불가 방어선 */
  if (shades == null) {
    throw new Error(`팔레트 패밀리 ${species.paletteFamily}가 존재하지 않습니다`)
  }
  const palette = rng.pick(shades)
  const name = alienName(rngFor(seed, 'name', 'alien', planetId))

  return {
    individualId: makeIndividualId(seed, planetId),
    speciesId: species.id,
    rarity,
    parts,
    palette,
    name,
  }
}
