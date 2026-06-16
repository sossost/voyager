import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'

import type { Companion, Star } from '@/engine'
import { bodyCount, bodyPositions, isCircumbinary, massOf } from './multiplicity'

function makeStar(overrides: Partial<Star>): Star {
  return {
    id: '0:0:0:0' as Star['id'],
    sector: { sx: 0, sy: 0, sz: 0 },
    localPos: [0, 0, 0],
    spectral: 'G',
    name: 'Test',
    multiplicity: 'single',
    companions: [],
    kind: 'main_sequence',
    ...overrides,
  }
}

function companion(overrides: Partial<Companion>): Companion {
  return {
    spectral: 'M',
    separation: 4,
    eccentricity: 0,
    phase: 0,
    hierarchy: 'inner',
    ...overrides,
  }
}

const scratch = [new Vector3(), new Vector3(), new Vector3()]

describe('multiplicity render math', () => {
  it('단일성은 주성을 원점에 둔다', () => {
    const star = makeStar({ multiplicity: 'single' })
    const n = bodyPositions(star, 12.3, scratch)
    expect(n).toBe(1)
    expect(scratch[0]?.toArray()).toEqual([0, 0, 0])
  })

  it('쌍성은 질량중심을 원점에 보존한다 (m₁r₁ + m₂r₂ = 0)', () => {
    const star = makeStar({
      multiplicity: 'binary',
      spectral: 'G',
      companions: [companion({ spectral: 'M', separation: 4, eccentricity: 0.4, phase: 0.3 })],
    })
    const n = bodyPositions(star, 7.7, scratch)
    expect(n).toBe(2)
    const m1 = massOf('G')
    const m2 = massOf('M')
    const primary = scratch[0] as Vector3
    const comp = scratch[1] as Vector3
    const cx = m1 * primary.x + m2 * comp.x
    const cz = m1 * primary.z + m2 * comp.z
    expect(Math.abs(cx)).toBeLessThan(1e-9)
    expect(Math.abs(cz)).toBeLessThan(1e-9)
  })

  it('쌍성에서 무거운 주성이 가벼운 동반성보다 질량중심에 가깝다', () => {
    const star = makeStar({
      multiplicity: 'binary',
      spectral: 'G',
      companions: [companion({ spectral: 'M', separation: 4, eccentricity: 0, phase: 0 })],
    })
    bodyPositions(star, 0, scratch)
    const primaryDist = (scratch[0] as Vector3).length()
    const companionDist = (scratch[1] as Vector3).length()
    expect(primaryDist).toBeLessThan(companionDist)
  })

  it('삼중성은 별 3개 위치를 채운다', () => {
    const star = makeStar({
      multiplicity: 'triple',
      companions: [
        companion({ hierarchy: 'inner', separation: 1.5 }),
        companion({ hierarchy: 'outer', separation: 12 }),
      ],
    })
    const n = bodyPositions(star, 3.0, scratch)
    expect(n).toBe(3)
  })

  it('같은 입력은 같은 위치를 만든다 (결정론)', () => {
    const star = makeStar({
      multiplicity: 'binary',
      companions: [companion({ separation: 6, eccentricity: 0.2, phase: 0.5 })],
    })
    const a = [new Vector3(), new Vector3(), new Vector3()]
    const b = [new Vector3(), new Vector3(), new Vector3()]
    bodyPositions(star, 5.5, a)
    bodyPositions(star, 5.5, b)
    expect(a[0]?.toArray()).toEqual(b[0]?.toArray())
    expect(a[1]?.toArray()).toEqual(b[1]?.toArray())
  })

  it('isCircumbinary: 다중성계는 항상 질량중심 공전(true), 단일성만 false', () => {
    expect(isCircumbinary(makeStar({ multiplicity: 'single' }))).toBe(false)
    expect(
      isCircumbinary(
        makeStar({ multiplicity: 'binary', companions: [companion({ separation: 2 })] }),
      ),
    ).toBe(true)
    // 원거리 쌍성도 질량중심 공전 (S-type 폐지 — 사용자 피드백)
    expect(
      isCircumbinary(
        makeStar({ multiplicity: 'binary', companions: [companion({ separation: 10 })] }),
      ),
    ).toBe(true)
    expect(
      isCircumbinary(
        makeStar({
          multiplicity: 'triple',
          companions: [companion({ hierarchy: 'inner' }), companion({ hierarchy: 'outer' })],
        }),
      ),
    ).toBe(true)
  })

  it('bodyCount는 주성 + 동반성 수다', () => {
    expect(bodyCount(makeStar({ multiplicity: 'single' }))).toBe(1)
    expect(
      bodyCount(makeStar({ multiplicity: 'binary', companions: [companion({})] })),
    ).toBe(2)
  })
})
