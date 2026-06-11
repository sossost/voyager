import { describe, expect, it } from 'vitest'

import { validatePalettes, validateSpecies } from './species'

const VALID_PALETTES = {
  ember: [{ primary: '#ff6b35', secondary: '#7a2e12', accent: '#ffd166' }],
}

function validSpeciesEntry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'sp001',
    name: '글로팡',
    rarity: 'common',
    lore: '테스트 종족',
    fixedParts: { body: 'body01' },
    allowedParts: {
      eyes: ['eyes01'],
      mouth: ['mouth01'],
      appendage: ['app01'],
      pattern: ['pat01'],
    },
    paletteFamily: 'ember',
    ...overrides,
  }
}

describe('validatePalettes', () => {
  it('유효한 팔레트를 통과시킨다', () => {
    expect(() => validatePalettes(VALID_PALETTES)).not.toThrow()
  })

  it('객체가 아니면 거부한다', () => {
    expect(() => validatePalettes(null)).toThrow()
    expect(() => validatePalettes([])).toThrow()
    expect(() => validatePalettes('ember')).toThrow()
  })

  it('빈 패밀리를 거부한다', () => {
    expect(() => validatePalettes({ ember: [] })).toThrow('비어 있습니다')
  })

  it('유효하지 않은 색상을 거부한다', () => {
    expect(() =>
      validatePalettes({ ember: [{ primary: 'red', secondary: '#000000', accent: '#ffffff' }] }),
    ).toThrow('색상이 유효하지 않습니다')
    expect(() =>
      validatePalettes({ ember: [{ primary: '#FF6B35', secondary: '#000000', accent: '#ffffff' }] }),
    ).toThrow('색상이 유효하지 않습니다') // 대문자 불허 — 정규화된 소문자만
  })
})

describe('validateSpecies', () => {
  const families = Object.keys(VALID_PALETTES)

  it('유효한 카탈로그를 통과시킨다', () => {
    expect(() => validateSpecies([validSpeciesEntry()], families)).not.toThrow()
  })

  it('배열이 아니면 거부한다', () => {
    expect(() => validateSpecies({}, families)).toThrow('배열이 아닙니다')
  })

  it('id 누락·중복을 거부한다', () => {
    expect(() => validateSpecies([validSpeciesEntry({ id: '' })], families)).toThrow()
    expect(() =>
      validateSpecies([validSpeciesEntry(), validSpeciesEntry()], families),
    ).toThrow('중복 id')
  })

  it('빈 name을 거부한다', () => {
    expect(() => validateSpecies([validSpeciesEntry({ name: '' })], families)).toThrow('name')
  })

  it('유효하지 않은 rarity를 거부한다', () => {
    expect(() => validateSpecies([validSpeciesEntry({ rarity: 'mythic' })], families)).toThrow(
      'rarity',
    )
  })

  it('body 시그니처가 없으면 거부한다', () => {
    expect(() => validateSpecies([validSpeciesEntry({ fixedParts: {} })], families)).toThrow(
      'body',
    )
  })

  it('존재하지 않는 paletteFamily를 거부한다', () => {
    expect(() =>
      validateSpecies([validSpeciesEntry({ paletteFamily: 'unknown' })], families),
    ).toThrow('paletteFamily')
  })

  it('fixed와 allowed가 같은 슬롯에 동시에 있으면 거부한다', () => {
    const entry = validSpeciesEntry({
      fixedParts: { body: 'body01', eyes: 'eyes01' },
      allowedParts: {
        eyes: ['eyes02'],
        mouth: ['mouth01'],
        appendage: ['app01'],
        pattern: ['pat01'],
      },
    })
    expect(() => validateSpecies([entry], families)).toThrow('동시에')
  })

  it('채울 수 없는 슬롯이 있으면 거부한다', () => {
    const entry = validSpeciesEntry({
      allowedParts: { eyes: [], mouth: ['mouth01'], appendage: ['app01'], pattern: ['pat01'] },
    })
    expect(() => validateSpecies([entry], families)).toThrow('채울 방법이 없습니다')
  })
})
