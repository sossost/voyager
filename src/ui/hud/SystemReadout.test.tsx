// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Seed } from '@/engine'
import { originStar, parseSeed } from '@/engine'
import { MemoryDriver } from '@/persistence/memoryDriver'
import { initializeGameStore, useGameStore } from '@/store'
import { SystemReadout } from './SystemReadout'

function seedOf(value: string): Seed {
  const seed = parseSeed(value)
  if (seed == null) throw new Error(`테스트 시드가 유효하지 않습니다: ${value}`)
  return seed
}

describe('SystemReadout (항성계 진입 함교 리드아웃)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    const seed = seedOf('READOUT1')
    initializeGameStore({ seed, startStarId: originStar(seed), driver: new MemoryDriver() })
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('항성계 씬에서 마운트되면 항성 이름과 분광형을 표시한다', () => {
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

  it('항성계를 떠났다가 재진입하면 다시 표시된다', () => {
    render(<SystemReadout />)

    act(() => {
      vi.advanceTimersByTime(6_000)
    })
    expect(screen.queryByRole('status')).toBeNull()

    // 이탈과 재진입은 별개 렌더 — 같은 배치로 묶으면 starId가 동일 값으로 끝나
    // 변화 자체가 사라진다 (실제 UI 흐름도 항상 분리되어 있다)
    act(() => {
      useGameStore.getState().backToGalaxy()
    })
    act(() => {
      useGameStore.getState().selectStar(useGameStore.getState().currentStarId)
      useGameStore.getState().enterCurrentSystem()
    })
    expect(screen.getByRole('status')).toBeTruthy()
  })
})
