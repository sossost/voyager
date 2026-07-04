import { describe, expect, it } from 'vitest'

import type { Planet } from '@/engine'
import { normalizedOrbit } from '@/scenes/system/habitableZone'

import { deriveAtmosphere } from './atmosphere'

function makePlanet(overrides: Partial<Planet> = {}): Planet {
  return {
    id: 'S0:P0' as Planet['id'],
    starId: 'S0' as Planet['starId'],
    index: 0,
    kind: 'rocky',
    radius: 1,
    orbitAu: 1,
    hasLife: false,
    name: 'Test',
    paletteSeed: 0,
    ...overrides,
  }
}

/** G형 HZ 중심(1 AU)을 각 온도대에 놓는 정규화 궤도 x. */
const SCORCHING_X = normalizedOrbit(0.4, 'G') // x≈0.4 < 0.85
const HABITABLE_X = normalizedOrbit(1.0, 'G') // x=1.0 (가스: cloudless III)
const FROZEN_X = normalizedOrbit(2.0, 'G') // x=2.0 > 1.3
const AMMONIA_X = normalizedOrbit(3.5, 'G') // x=3.5 > 2.5 (가스: ammonia I)

describe('deriveAtmosphere — 가스행성', () => {
  it('가스행성은 온도 클래스와 무관하게 항상 헤이즈 대기를 가진다', () => {
    const gas = makePlanet({ kind: 'gas' })
    expect(deriveAtmosphere(gas, HABITABLE_X).kind).toBe('gas')
    expect(deriveAtmosphere(gas, SCORCHING_X).kind).toBe('gas')
    expect(deriveAtmosphere(gas, FROZEN_X).kind).toBe('gas')
  })

  it('무HZ 별(hzOrbit=null) 가스행성도 seed 색상 헤이즈를 가진다', () => {
    const gas = makePlanet({ kind: 'gas', paletteSeed: 123 })
    const profile = deriveAtmosphere(gas, null)
    expect(profile.kind).toBe('gas')
    expect(profile.intensity).toBeGreaterThan(0)
  })

  it('Sudarsky 클래스마다 대기색이 다르다 (감청 vs 황갈)', () => {
    const gas = makePlanet({ kind: 'gas' })
    const cloudless = deriveAtmosphere(gas, HABITABLE_X) // III 감청
    const ammonia = deriveAtmosphere(gas, AMMONIA_X) // I 황갈
    expect(cloudless.baseColor).not.toEqual(ammonia.baseColor)
  })
})

describe('deriveAtmosphere — 암석 생명/거주대', () => {
  it('생명 행성은 온도대 무관하게 파란 레일리 대기를 가진다', () => {
    const life = makePlanet({ hasLife: true })
    expect(deriveAtmosphere(life, HABITABLE_X).kind).toBe('rayleigh')
    expect(deriveAtmosphere(life, FROZEN_X).kind).toBe('rayleigh')
  })

  it('레일리 대기는 파랑(B>R) 기저에 따뜻한(R>B) 박명색을 가진다', () => {
    const profile = deriveAtmosphere(makePlanet({ hasLife: true }), HABITABLE_X)
    expect(profile.baseColor[2]).toBeGreaterThan(profile.baseColor[0]) // 파랑 우세
    expect(profile.warmColor[0]).toBeGreaterThan(profile.warmColor[2]) // 박명 적색 우세
  })
})

describe('deriveAtmosphere — 금성형 (작열 무생명 암석)', () => {
  it('작열 암석이 paletteSeed 해시에 선택되면 금성형 대기를 가진다', () => {
    // seed=0 → fract(0)=0 < 0.4 → 선택
    const selected = makePlanet({ hasLife: false, paletteSeed: 0 })
    expect(deriveAtmosphere(selected, SCORCHING_X).kind).toBe('venusian')
  })

  it('작열 암석이라도 해시에 비선택이면 대기가 없다', () => {
    // seed=20 → fract(0.526...)≈0.526 ≥ 0.4 → 비선택
    const notSelected = makePlanet({ hasLife: false, paletteSeed: 20 })
    expect(deriveAtmosphere(notSelected, SCORCHING_X).kind).toBe('none')
  })

  it('금성형 대기는 백황(R·G 높음) 고알베도다', () => {
    const profile = deriveAtmosphere(makePlanet({ paletteSeed: 0 }), SCORCHING_X)
    expect(profile.kind).toBe('venusian')
    expect(profile.baseColor[0]).toBeGreaterThan(0.8)
    expect(profile.baseColor[1]).toBeGreaterThan(0.8)
  })
})

describe('deriveAtmosphere — 대기 없는 암석', () => {
  it('거주대 무생명 암석(불모)은 대기가 없다', () => {
    expect(deriveAtmosphere(makePlanet({ hasLife: false }), HABITABLE_X).kind).toBe('none')
  })

  it('동결 무생명 암석(얼음)은 대기가 없다', () => {
    expect(deriveAtmosphere(makePlanet({ hasLife: false }), FROZEN_X).kind).toBe('none')
  })

  it('무HZ 별의 무생명 암석은 대기가 없다 (온도 미상 → 금성형 판정 불가)', () => {
    expect(deriveAtmosphere(makePlanet({ hasLife: false, paletteSeed: 0 }), null).kind).toBe('none')
  })
})

describe('deriveAtmosphere — 결정론·불변식', () => {
  it('같은 행성은 항상 같은 프로파일을 산출한다', () => {
    const planet = makePlanet({ kind: 'gas', paletteSeed: 777 })
    expect(deriveAtmosphere(planet, HABITABLE_X)).toEqual(deriveAtmosphere(planet, HABITABLE_X))
  })

  it('모든 대기색 채널은 0..1 범위다', () => {
    const cases: Planet[] = [
      makePlanet({ hasLife: true }),
      makePlanet({ kind: 'gas', paletteSeed: 42 }),
      makePlanet({ kind: 'gas', paletteSeed: 200 }),
      makePlanet({ paletteSeed: 0 }),
    ]
    const orbits = [SCORCHING_X, HABITABLE_X, FROZEN_X, null]
    for (const planet of cases) {
      for (const orbit of orbits) {
        const { baseColor, warmColor } = deriveAtmosphere(planet, orbit)
        for (const channel of [...baseColor, ...warmColor]) {
          expect(channel).toBeGreaterThanOrEqual(0)
          expect(channel).toBeLessThanOrEqual(1)
        }
      }
    }
  })
})
