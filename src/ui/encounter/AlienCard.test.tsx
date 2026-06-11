// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { Seed } from '@/engine'
import { alienAt, makePlanetId, makeStarId, parseSeed } from '@/engine'
import { AlienCard } from './AlienCard'

function seedOf(value: string): Seed {
  const seed = parseSeed(value)
  if (seed == null) throw new Error(`테스트 시드가 유효하지 않습니다: ${value}`)
  return seed
}

const seed = seedOf('CARDTEST')
const planetId = makePlanetId(makeStarId({ sx: 1, sy: 0, sz: 1 }, 0), 0)
const alien = alienAt(seed, planetId)

describe('AlienCard', () => {
  it('개체 → SVG 레이어 합성 스냅샷 (회귀 방지)', () => {
    const { container } = render(<AlienCard alien={alien} />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('팔레트가 CSS 변수로 주입된다', () => {
    const { container } = render(<AlienCard alien={alien} />)
    const card = container.firstChild as HTMLElement
    expect(card.style.getPropertyValue('--alien-primary')).toBe(alien.palette.primary)
    expect(card.style.getPropertyValue('--alien-accent')).toBe(alien.palette.accent)
  })

  it('실루엣 모드: 이름을 가리고 실루엣 클래스를 적용한다', () => {
    const { container, getByText } = render(<AlienCard alien={alien} silhouette />)
    const card = container.firstChild as HTMLElement
    expect(card.className).toContain('alien-card-silhouette')
    expect(getByText('???')).toBeDefined()
  })

  it('희귀도 프레임 클래스가 적용된다', () => {
    const { container } = render(<AlienCard alien={alien} />)
    const card = container.firstChild as HTMLElement
    expect(card.className).toContain(`alien-card-${alien.rarity}`)
  })
})
