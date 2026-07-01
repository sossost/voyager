// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Seed, StarId } from '@/engine'
import { originStar, parseSeed, starsInSector } from '@/engine'
import { MemoryDriver } from '@/persistence/memoryDriver'
import { getStorageDriver, initializeGameStore, useGameStore } from '@/store'
import { JournalOverlay } from './JournalOverlay'

function seedOf(value: string): Seed {
  const seed = parseSeed(value)
  if (seed == null) throw new Error(`테스트 시드가 유효하지 않습니다: ${value}`)
  return seed
}

const seed = seedOf('JOURNAL1')
const startStarId = originStar(seed)

/** 시작 별과 다른 실제 별 하나 — 방문 기록에서 워프 대상이 된다. */
function otherStarId(): StarId {
  for (let sx = 0; sx < 16; sx++) {
    for (const star of starsInSector(seed, { sx, sy: 0, sz: 1 })) {
      if (star.id !== startStarId) return star.id
    }
  }
  throw new Error('테스트용 별을 찾지 못했습니다')
}

async function seedVisits(...starIds: readonly StarId[]): Promise<void> {
  const driver = getStorageDriver()
  // visitedAt 오름차순으로 넣되 listVisits는 내림차순(최근 먼저)으로 돌려준다
  for (const [index, starId] of starIds.entries()) {
    await driver.addVisit({ starId, visitedAt: 1_700_000_000_000 + index })
  }
}

describe('JournalOverlay 방문 타임라인 워프 (백로그 L-2)', () => {
  beforeEach(() => {
    initializeGameStore({ seed, startStarId, driver: new MemoryDriver() })
    useGameStore.getState().openOverlay('journal')
  })

  afterEach(() => {
    cleanup()
  })

  it('현재 위치가 아닌 방문 별에는 항행 버튼을 표시한다', async () => {
    const target = otherStarId()
    await seedVisits(startStarId, target)

    render(<JournalOverlay />)

    expect(await screen.findByRole('button', { name: /항행/ })).toBeTruthy()
  })

  it('현재 위치인 방문 별에는 항행 버튼 대신 "현재 위치" 배지를 표시한다', async () => {
    await seedVisits(startStarId)

    render(<JournalOverlay />)

    expect(await screen.findByText('현재 위치')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /항행/ })).toBeNull()
  })

  it('항행 버튼을 누르면 일지를 닫고 해당 항성계로 워프한다', async () => {
    const target = otherStarId()
    await seedVisits(startStarId, target)

    render(<JournalOverlay />)
    const warpButton = await screen.findByRole('button', { name: /항행/ })

    fireEvent.click(warpButton)

    await waitFor(() => {
      expect(useGameStore.getState().currentStarId).toBe(target)
    })
    expect(useGameStore.getState().overlay).toBeNull()
    expect(useGameStore.getState().scene.kind).toBe('warping')
  })
})
