/** engine/ 공개 API — 앱 레이어는 이 배럴을 통해서만 엔진을 사용한다. */

export type { Brand, IndividualId, PlanetId, SectorCoords, Seed, StarId } from './coords'
export {
  makeIndividualId,
  makePlanetId,
  makeStarId,
  parsePlanetId,
  parseSeed,
  parseStarId,
} from './coords'

export type { Rng, RngNamespace, WeightedEntry } from './rng/streams'
export { rngFor } from './rng/streams'

export {
  GALAXY_HALF_THICKNESS_SECTORS,
  GALAXY_RADIUS_SECTORS,
  SECTOR_SIZE,
  sectorDensity,
} from './galaxy/density'
export { hash01 } from './noise/valueNoise'
export type { SpectralClass, Star } from './galaxy/sectors'
export { MAX_STARS_PER_SECTOR, starsInSector } from './galaxy/sectors'
export { originStar } from './galaxy/origin'
export { starById, starWorldPosition } from './galaxy/position'

export type { Planet, PlanetKind } from './system/planets'
export { LIFE_PROBABILITY, planetById, planetsOf } from './system/planets'

export type { Rarity } from './alien/rarity'
export { RARITIES, RARITY_WEIGHTS } from './alien/rarity'
export type { AlienPalette, PartSlot, SpeciesArchetype } from './alien/species'
export {
  PALETTE_FAMILIES,
  PART_SLOTS,
  SPECIES_BY_ID,
  SPECIES_BY_RARITY,
  SPECIES_CATALOG,
} from './alien/species'
export type { AlienIndividual } from './alien/individual'
export { alienAt } from './alien/individual'

export { GEN_VERSION } from './version'
