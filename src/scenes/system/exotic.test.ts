import { describe, expect, it } from 'vitest'

import type { StarKind } from '@/engine'
import { kindRadiusFactor } from './exotic'

const ALL_KINDS: readonly StarKind[] = ['main_sequence', 'black_hole']

describe('kindRadiusFactor', () => {
  it('main_sequence는 배수 1 — 기존 단일 항성 렌더가 한 픽셀도 안 바뀐다 (결정 12)', () => {
    expect(kindRadiusFactor('main_sequence')).toBe(1)
  })

  it('블랙홀 사건지평선은 항성보다 작다 (<1) — 디스크·렌즈 레이마칭이 시각 크기를 담당', () => {
    expect(kindRadiusFactor('black_hole')).toBeLessThan(1)
  })

  it('모든 kind에 유한한 양수 배수를 준다 (exhaustive)', () => {
    for (const kind of ALL_KINDS) {
      const factor = kindRadiusFactor(kind)
      expect(Number.isFinite(factor)).toBe(true)
      expect(factor).toBeGreaterThan(0)
    }
  })
})
