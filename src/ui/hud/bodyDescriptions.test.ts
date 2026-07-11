import { describe, expect, it } from 'vitest'

import type { Planet, PlanetId, StarId } from '@/engine'
import { SOL_STAR_ID } from '@/engine'
import { planetDescriptionOf } from '@/ui/hud/bodyDescriptions'

function makePlanet(overrides: Partial<Planet>): Planet {
  return {
    id: 'test:p0' as PlanetId,
    starId: 'test' as StarId,
    index: 0,
    kind: 'rocky',
    radius: 1,
    orbitAu: 1,
    hasLife: false,
    name: '테스트 행성',
    paletteSeed: 1,
    ...overrides,
  }
}

describe('planetDescriptionOf', () => {
  it('인류의 고향은 전용 설명을 돌려준다', () => {
    const earth = makePlanet({ isHomeWorld: true, starId: SOL_STAR_ID, index: 2 })
    expect(planetDescriptionOf(earth, 1)).toContain('인류의 고향')
  })

  it('태양계 행성은 index 키의 전용 사전을 쓴다 (온도 모델 우회)', () => {
    const saturn = makePlanet({ starId: SOL_STAR_ID, index: 5, kind: 'gas' })
    expect(planetDescriptionOf(saturn, null)).toContain('고리')
  })

  it('암석형은 정규화 궤도의 온도대로 갈린다 — 작열/거주가능/동결', () => {
    const rocky = makePlanet({ kind: 'rocky' })
    expect(planetDescriptionOf(rocky, 0.5)).toContain('작열')
    expect(planetDescriptionOf(rocky, 1.0)).toContain('거주가능구역')
    expect(planetDescriptionOf(rocky, 1.8)).toContain('얼음')
  })

  it('가스형은 Sudarsky 온도 클래스로 갈린다', () => {
    const gas = makePlanet({ kind: 'gas' })
    expect(planetDescriptionOf(gas, 0.1)).toContain('초고온')
    expect(planetDescriptionOf(gas, 3.0)).toContain('암모니아')
  })

  it('HZ가 없는 계(x=null)는 종류 폴백 설명을 쓴다', () => {
    expect(planetDescriptionOf(makePlanet({ kind: 'rocky' }), null)).toContain('지구형')
    expect(planetDescriptionOf(makePlanet({ kind: 'gas' }), null)).toContain('목성형')
  })
})
