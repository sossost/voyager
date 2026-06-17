import { describe, expect, it } from 'vitest'

import type { StarKind } from '@/engine'
import { kindRadiusFactor, pulsarPulse, PULSAR_PULSE_HZ, PULSAR_PULSE_MIN } from './exotic'

const ALL_KINDS: readonly StarKind[] = ['main_sequence', 'black_hole', 'pulsar']

describe('kindRadiusFactor', () => {
  it('main_sequence는 배수 1 — 기존 단일 항성 렌더가 한 픽셀도 안 바뀐다 (결정 12)', () => {
    expect(kindRadiusFactor('main_sequence')).toBe(1)
  })

  it('블랙홀 사건지평선은 항성보다 작다 (<1) — 디스크·렌즈 레이마칭이 시각 크기를 담당', () => {
    expect(kindRadiusFactor('black_hole')).toBeLessThan(1)
  })

  it('펄서 본체는 항성보다 작다 (<1) — 등대 빔·제트가 시각 크기를 담당 (펄서 결정 3)', () => {
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

describe('pulsarPulse (맥동 강도)', () => {
  it('항상 [PULSE_MIN, 1] 범위 — 완전 소등 없음(대비 상한, 광과민성 결정 5)', () => {
    for (let i = 0; i <= 40; i++) {
      const t = i * 0.1
      const pulse = pulsarPulse(t)
      expect(pulse).toBeGreaterThanOrEqual(PULSAR_PULSE_MIN - 1e-9)
      expect(pulse).toBeLessThanOrEqual(1 + 1e-9)
    }
  })

  it('한 주기(1/HZ초)에 최저(PULSE_MIN)와 최고(1)에 모두 도달한다', () => {
    const period = 1 / PULSAR_PULSE_HZ
    // sin 최저는 t=0.75·주기(위상 3π/2), 최고는 t=0.25·주기(위상 π/2)
    expect(pulsarPulse(period * 0.75)).toBeCloseTo(PULSAR_PULSE_MIN)
    expect(pulsarPulse(period * 0.25)).toBeCloseTo(1)
  })

  it('맥동 주파수가 광과민성 안전 상한(≤3Hz) 이하다 (결정 5)', () => {
    expect(PULSAR_PULSE_HZ).toBeLessThanOrEqual(3)
  })
})
