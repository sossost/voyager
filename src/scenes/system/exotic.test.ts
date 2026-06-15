import { describe, expect, it } from 'vitest'

import type { StarKind } from '@/engine'
import { kindRadiusFactor, surfaceModulationOf } from './exotic'

const ALL_KINDS: readonly StarKind[] = [
  'main_sequence',
  'red_giant',
  'white_dwarf',
  'pulsar',
  'black_hole',
]

describe('kindRadiusFactor', () => {
  it('main_sequence는 배수 1 — 기존 단일 항성 렌더가 한 픽셀도 안 바뀐다 (결정 12)', () => {
    expect(kindRadiusFactor('main_sequence')).toBe(1)
  })

  it('적색거성은 크고(>1) 백색왜성·펄서는 작다(<1)', () => {
    expect(kindRadiusFactor('red_giant')).toBeGreaterThan(1)
    expect(kindRadiusFactor('white_dwarf')).toBeLessThan(1)
    expect(kindRadiusFactor('pulsar')).toBeLessThan(1)
  })

  it('모든 kind에 유한한 양수 배수를 준다 (exhaustive)', () => {
    for (const kind of ALL_KINDS) {
      const factor = kindRadiusFactor(kind)
      expect(Number.isFinite(factor)).toBe(true)
      expect(factor).toBeGreaterThan(0)
    }
  })
})

describe('surfaceModulationOf', () => {
  it('main_sequence는 중립 변조(1, 1) — StarSurface 기본값과 동일', () => {
    expect(surfaceModulationOf('main_sequence')).toEqual({ emissiveBoost: 1, coronaScale: 1 })
  })

  it('백색왜성은 강렬(emissiveBoost>1), 적색거성은 은은(emissiveBoost<1)·큰 코로나', () => {
    expect(surfaceModulationOf('white_dwarf').emissiveBoost).toBeGreaterThan(1)
    expect(surfaceModulationOf('red_giant').emissiveBoost).toBeLessThan(1)
    expect(surfaceModulationOf('red_giant').coronaScale).toBeGreaterThan(1)
  })
})
