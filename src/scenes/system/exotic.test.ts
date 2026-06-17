import { describe, expect, it } from 'vitest'

import type { StarKind } from '@/engine'
import {
  kindRadiusFactor,
  pulsarGlowPulse,
  PULSAR_PULSE_ALIGN_THRESHOLD,
  PULSAR_PULSE_MIN,
} from './exotic'

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

describe('pulsarGlowPulse (등대 글로우 펄스 강도)', () => {
  it('정렬 임계 이하는 PULSE_MIN으로 고정 — 완전 소등 없음(광과민성, 결정 5)', () => {
    expect(pulsarGlowPulse(0)).toBe(PULSAR_PULSE_MIN)
    expect(pulsarGlowPulse(PULSAR_PULSE_ALIGN_THRESHOLD)).toBe(PULSAR_PULSE_MIN)
    expect(pulsarGlowPulse(PULSAR_PULSE_ALIGN_THRESHOLD * 0.5)).toBe(PULSAR_PULSE_MIN)
  })

  it('완전 정렬(|dot|=1)에서 최대 강도 1 — 빔이 카메라 정면', () => {
    expect(pulsarGlowPulse(1)).toBeCloseTo(1)
  })

  it('임계와 1 사이에서 단조 증가한다 (부드러운 펄스)', () => {
    const mid = pulsarGlowPulse(0.78)
    expect(mid).toBeGreaterThan(PULSAR_PULSE_MIN)
    expect(mid).toBeLessThan(1)
    expect(pulsarGlowPulse(0.9)).toBeGreaterThan(mid)
  })

  it('정렬도가 [0,1] 밖이어도 강도는 항상 [PULSE_MIN,1] (clamp 안전)', () => {
    for (const align of [-0.5, 0, 0.3, 0.55, 0.8, 1, 1.5]) {
      const pulse = pulsarGlowPulse(align)
      expect(pulse).toBeGreaterThanOrEqual(PULSAR_PULSE_MIN)
      expect(pulse).toBeLessThanOrEqual(1)
    }
  })
})
