import { describe, expect, it } from 'vitest'

import { gasClassOf, normalizedOrbit, temperatureZoneAt } from './habitableZone'

describe('temperatureZoneAt (정규화 궤도 → 온도대)', () => {
  it('평지 경계 안(0.85~1.3)은 거주가능이다', () => {
    expect(temperatureZoneAt(0.85)).toBe('habitable')
    expect(temperatureZoneAt(1.0)).toBe('habitable')
    expect(temperatureZoneAt(1.3)).toBe('habitable')
  })

  it('평지 안쪽(x<0.85)은 작열이다', () => {
    expect(temperatureZoneAt(0.84)).toBe('scorching')
    expect(temperatureZoneAt(0.5)).toBe('scorching')
    expect(temperatureZoneAt(0.1)).toBe('scorching')
  })

  it('평지 바깥쪽(x>1.3)은 동결이다', () => {
    expect(temperatureZoneAt(1.31)).toBe('frozen')
    expect(temperatureZoneAt(2.0)).toBe('frozen')
    expect(temperatureZoneAt(5.0)).toBe('frozen')
  })
})

describe('normalizedOrbit (실제 궤도 → 정규화 x)', () => {
  it('HZ 중심 궤도(G형 1.0 AU)에서 x=1이다', () => {
    expect(normalizedOrbit(1.0, 'G')).toBe(1)
  })

  it('분광형마다 같은 AU라도 정규화 x가 다르다 (광도 차이)', () => {
    // M형(중심 0.2 AU)에서 1 AU는 동결, F형(중심 1.7 AU)에서 1 AU는 작열.
    expect(normalizedOrbit(1.0, 'M')).toBeGreaterThan(1)
    expect(normalizedOrbit(1.0, 'F')).toBeLessThan(1)
  })

  it('실제 궤도 → 온도대: G형 1 AU 거주가능, M형 1 AU 동결', () => {
    expect(temperatureZoneAt(normalizedOrbit(1.0, 'G'))).toBe('habitable')
    expect(temperatureZoneAt(normalizedOrbit(1.0, 'M'))).toBe('frozen')
  })
})

describe('gasClassOf (Sudarsky 온도 클래스 — 정규화 궤도 x)', () => {
  it('고온→저온이 x 증가에 따라 단조 전환한다', () => {
    expect(gasClassOf(0.1)).toBe('silicate') // V 최고온
    expect(gasClassOf(0.4)).toBe('alkali') // IV
    expect(gasClassOf(0.9)).toBe('cloudless') // III (HZ 안쪽)
    expect(gasClassOf(1.5)).toBe('water') // II
    expect(gasClassOf(3.0)).toBe('ammonia') // I 저온 (목성형)
  })

  it('HZ 중심(x=1) 가스행성은 무운 감청(III)이다', () => {
    expect(gasClassOf(1.0)).toBe('cloudless')
  })
})
