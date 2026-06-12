// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Seed, StarId } from '@/engine'
import { originStar, parseSeed, starsInSector } from '@/engine'
import { MemoryDriver } from '@/persistence/memoryDriver'
import { initializeGameStore, useGameStore } from '@/store'
import { SystemReadout } from './SystemReadout'

function seedOf(value: string): Seed {
  const seed = parseSeed(value)
  if (seed == null) throw new Error(`테스트 시드가 유효하지 않습니다: ${value}`)
  return seed
}

const seed = seedOf('READOUT1')
const startStarId = originStar(seed)

/** 시작 별과 다른 실제 별 하나 — 워프 도착(새 항성계 진입)을 흉내내는 데 쓴다. */
function otherStarId(): StarId {
  for (let sx = 0; sx < 16; sx++) {
    for (const star of starsInSector(seed, { sx, sy: 0, sz: 1 })) {
      if (star.id !== startStarId) return star.id
    }
  }
  throw new Error('테스트용 별을 찾지 못했습니다')
}

describe('SystemReadout (항성계 진입 함교 리드아웃)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    initializeGameStore({ seed, startStarId, driver: new MemoryDriver() })
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('우주선 뷰에서 마운트되면 항성 이름과 분광형을 표시한다', () => {
    render(<SystemReadout />)

    const readout = screen.getByRole('status')
    expect(readout.textContent).not.toBe('')
    expect(readout.textContent).toMatch(/형/) // 분광형 라벨 (예: "G형 (황색 — 태양형)")
  })

  it('표시 수명이 지나면 사라진다', () => {
    render(<SystemReadout />)
    expect(screen.getByRole('status')).toBeTruthy()

    act(() => {
      vi.advanceTimersByTime(6_000)
    })
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('다른 별에 워프 도착하면(우주선 뷰 전이) 다시 표시된다 (결정 41)', () => {
    render(<SystemReadout />)

    act(() => {
      vi.advanceTimersByTime(6_000)
    })
    expect(screen.queryByRole('status')).toBeNull()

    // 새 별로 워프 → onWarpComplete = 우주선 뷰로 새 항성계 진입 → 재안내
    act(() => {
      useGameStore.getState().warpTo(otherStarId())
    })
    act(() => {
      useGameStore.getState().onWarpComplete()
    })
    expect(screen.getByRole('status')).toBeTruthy()
  })

  it('같은 별 재진입(퍼스펙티브↔우주선 토글)에는 다시 뜨지 않는다 (결정 41)', () => {
    render(<SystemReadout />)

    act(() => {
      vi.advanceTimersByTime(6_000)
    })
    expect(screen.queryByRole('status')).toBeNull()

    // 항법 뷰로 나갔다 돌아와도 같은 항성계 — 재안내는 새 별 진입에만 (lastAnnounced 가드)
    act(() => {
      useGameStore.getState().openPerspective()
    })
    act(() => {
      useGameStore.getState().returnToShip()
    })
    expect(screen.queryByRole('status')).toBeNull()
  })
})
