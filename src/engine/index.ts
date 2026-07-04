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
export type { Companion, Multiplicity, SpectralClass, Star, StarKind } from './galaxy/sectors'
export { MAX_STARS_PER_SECTOR, SOL_STAR, starsInSector } from './galaxy/sectors'
export { originStar } from './galaxy/origin'
export { starById, starWorldPosition } from './galaxy/position'
export { rareExoticBodiesNear, RARE_EXOTIC_KINDS, SCAN_RADIUS_SECTORS } from './galaxy/scan'

export type { Planet, PlanetKind } from './system/planets'
export {
  hasHabitableZone,
  HZ_CENTER_AU,
  HZ_PEAK_PROBABILITY,
  HZ_X_PLATEAU_INNER,
  HZ_X_PLATEAU_OUTER,
  planetById,
  planetsOf,
} from './system/planets'
export type { Moon } from './system/moons'
export { moonsOf } from './system/moons'
export { SOL_STAR_ID, SOLAR_SYSTEM_PLANETS } from './system/sol'

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
