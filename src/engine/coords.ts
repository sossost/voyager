import { cyrb128 } from './rng/cyrb128'

/** 도메인 원시값 혼용을 컴파일 타임에 차단하는 브랜디드 타입. */
export type Brand<T, B extends string> = T & { readonly __brand: B }

/** 1~32자 영숫자. parseSeed로만 생성된다. */
export type Seed = Brand<string, 'Seed'>
/** "sx:sy:sz:i" — 정수 섹터 좌표 + 섹터 내 인덱스. 무한 공간에서 저장 없이 별을 재식별하는 키. */
export type StarId = Brand<string, 'StarId'>
/** `${StarId}:p${index}` */
export type PlanetId = Brand<string, 'PlanetId'>
/** hash128(seed, 'alien', planetId).hex — 결정론 PK. 같은 행성 = 항상 같은 개체. */
export type IndividualId = Brand<string, 'IndividualId'>

/** 정수 좌표만 허용 — 부동소수점 좌표는 해싱 전 양자화가 원칙. */
export interface SectorCoords {
  readonly sx: number
  readonly sy: number
  readonly sz: number
}

const SEED_PATTERN = /^[A-Za-z0-9]{1,32}$/
const INTEGER_PATTERN = /^-?\d+$/

export function parseSeed(input: string): Seed | null {
  const trimmed = input.trim()
  return SEED_PATTERN.test(trimmed) ? (trimmed as Seed) : null
}

function assertInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label}은(는) 안전한 정수여야 합니다: ${value}`)
  }
}

export function makeStarId(sector: SectorCoords, index: number): StarId {
  assertInteger(sector.sx, 'sector.sx')
  assertInteger(sector.sy, 'sector.sy')
  assertInteger(sector.sz, 'sector.sz')
  assertInteger(index, 'index')
  return `${sector.sx}:${sector.sy}:${sector.sz}:${index}` as StarId
}

export function parseStarId(id: string): { sector: SectorCoords; index: number } | null {
  const parts = id.split(':')
  if (parts.length !== 4) return null
  if (!parts.every((part) => INTEGER_PATTERN.test(part))) return null

  const [sx, sy, sz, index] = parts.map(Number)
  if (sx == null || sy == null || sz == null || index == null) return null
  if (index < 0) return null
  return { sector: { sx, sy, sz }, index }
}

export function makePlanetId(starId: StarId, planetIndex: number): PlanetId {
  assertInteger(planetIndex, 'planetIndex')
  if (planetIndex < 0) {
    throw new Error(`planetIndex는 0 이상이어야 합니다: ${planetIndex}`)
  }
  return `${starId}:p${planetIndex}` as PlanetId
}

export function parsePlanetId(id: string): { starId: StarId; planetIndex: number } | null {
  const markerIndex = id.lastIndexOf(':p')
  if (markerIndex < 0) return null

  const starPart = id.slice(0, markerIndex)
  const indexPart = id.slice(markerIndex + 2)
  if (!INTEGER_PATTERN.test(indexPart)) return null

  const planetIndex = Number(indexPart)
  if (planetIndex < 0) return null
  if (parseStarId(starPart) == null) return null
  return { starId: starPart as StarId, planetIndex }
}

const ID_SEPARATOR = '\u001f'

function toHex8(value: number): string {
  return value.toString(16).padStart(8, '0')
}

/** 결정론 PK — 같은 (seed, planetId)는 항상 같은 individualId를 만든다. */
export function makeIndividualId(seed: Seed, planetId: PlanetId): IndividualId {
  const [h1, h2, h3, h4] = cyrb128(`${seed}${ID_SEPARATOR}alien${ID_SEPARATOR}${planetId}`)
  return `${toHex8(h1)}${toHex8(h2)}${toHex8(h3)}${toHex8(h4)}` as IndividualId
}
