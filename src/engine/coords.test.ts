import { describe, expect, it } from 'vitest'

import {
  makeIndividualId,
  makePlanetId,
  makeStarId,
  parsePlanetId,
  parseSeed,
  parseStarId,
} from './coords'

describe('parseSeed', () => {
  it('1~32자 영숫자를 허용하고 앞뒤 공백은 정규화한다', () => {
    expect(parseSeed('ANDROMEDA')).toBe('ANDROMEDA')
    expect(parseSeed('  abc123  ')).toBe('abc123')
    expect(parseSeed('a')).toBe('a')
    expect(parseSeed('A'.repeat(32))).toBe('A'.repeat(32))
  })

  it('빈 문자열·특수문자·33자 이상은 거부한다', () => {
    expect(parseSeed('')).toBeNull()
    expect(parseSeed('   ')).toBeNull()
    expect(parseSeed('has space')).toBeNull()
    expect(parseSeed('한글시드')).toBeNull()
    expect(parseSeed('semi;colon')).toBeNull()
    expect(parseSeed('A'.repeat(33))).toBeNull()
  })
})

describe('StarId', () => {
  it('인코딩-파싱 왕복이 보존된다 (음수 좌표 포함)', () => {
    const id = makeStarId({ sx: -12, sy: 3, sz: 0 }, 7)
    expect(id).toBe('-12:3:0:7')
    expect(parseStarId(id)).toEqual({ sector: { sx: -12, sy: 3, sz: 0 }, index: 7 })
  })

  it('정수가 아닌 좌표는 거부한다 (부동소수점 좌표 양자화 원칙)', () => {
    expect(() => makeStarId({ sx: 1.5, sy: 0, sz: 0 }, 0)).toThrow()
    expect(() => makeStarId({ sx: 0, sy: 0, sz: 0 }, 0.5)).toThrow()
  })

  it('형식이 깨진 문자열은 null을 반환한다', () => {
    expect(parseStarId('1:2:3')).toBeNull()
    expect(parseStarId('a:b:c:d')).toBeNull()
    expect(parseStarId('1:2:3:-1')).toBeNull()
    expect(parseStarId('1:2:3:4:5')).toBeNull()
    expect(parseStarId('')).toBeNull()
  })
})

describe('PlanetId', () => {
  const starId = makeStarId({ sx: 4, sy: -1, sz: 9 }, 2)

  it('인코딩-파싱 왕복이 보존된다', () => {
    const id = makePlanetId(starId, 3)
    expect(id).toBe('4:-1:9:2:p3')
    expect(parsePlanetId(id)).toEqual({ starId, planetIndex: 3 })
  })

  it('음수 인덱스는 거부한다', () => {
    expect(() => makePlanetId(starId, -1)).toThrow()
  })

  it('형식이 깨진 문자열은 null을 반환한다', () => {
    expect(parsePlanetId('4:-1:9:2')).toBeNull()
    expect(parsePlanetId('not-a-planet')).toBeNull()
    expect(parsePlanetId('4:-1:9:2:pX')).toBeNull()
  })
})

describe('makeIndividualId', () => {
  const seed = parseSeed('IDTEST')
  if (seed == null) throw new Error('unreachable')
  const planetId = makePlanetId(makeStarId({ sx: 0, sy: 0, sz: 10 }, 0), 1)

  it('같은 입력 → 같은 ID (결정론 PK)', () => {
    expect(makeIndividualId(seed, planetId)).toBe(makeIndividualId(seed, planetId))
  })

  it('32자 소문자 16진수다', () => {
    expect(makeIndividualId(seed, planetId)).toMatch(/^[0-9a-f]{32}$/)
  })

  it('행성이 다르면 ID도 다르다', () => {
    const other = makePlanetId(makeStarId({ sx: 0, sy: 0, sz: 10 }, 0), 2)
    expect(makeIndividualId(seed, other)).not.toBe(makeIndividualId(seed, planetId))
  })
})
