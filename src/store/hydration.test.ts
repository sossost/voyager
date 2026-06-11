import { describe, expect, it } from 'vitest'

import type { IndividualId, PlanetId, Seed, StarId } from '@/engine'
import { originStar, parseSeed } from '@/engine'
import { MemoryDriver } from '@/persistence/memoryDriver'
import type { CollectionEntry } from '@/persistence/types'
import { createGameStore } from './createGameStore'

function seedOf(value: string): Seed {
  const seed = parseSeed(value)
  if (seed == null) throw new Error(`테스트 시드가 유효하지 않습니다: ${value}`)
  return seed
}

const seed = seedOf('HYDRATETEST')
const startStarId = originStar(seed)
const otherStar = '3:0:1:0' as StarId
const planetA = '3:0:1:0:p0' as PlanetId
const planetB = '3:0:1:0:p1' as PlanetId

function entryOf(individualId: string, speciesId: string, planetId: PlanetId, isFirst: boolean): CollectionEntry {
  return {
    individualId: individualId as IndividualId,
    speciesId,
    rarity: 'common',
    planetId,
    discoveredAt: 5_000,
    isFirstOfSpecies: isFirst,
  }
}

describe('하이드레이션 — 영속 기록 → O(1) 캐시 복원 (스펙 AC: 새로고침 복원)', () => {
  it('방문/탐사/수집 기록이 캐시로 변환된다', () => {
    const store = createGameStore({
      seed,
      startStarId,
      driver: new MemoryDriver(),
      hydration: {
        visits: [
          { starId: startStarId, visitedAt: 1_000 },
          { starId: otherStar, visitedAt: 2_000 },
        ],
        explorations: [{ planetId: planetA, exploredAt: 3_000 }],
        collection: [
          entryOf('alien-1', 'sp001', planetA, true),
          entryOf('alien-2', 'sp001', planetB, false),
          entryOf('alien-3', 'sp005', planetB, true),
        ],
      },
    })

    const state = store.getState()
    expect(state.visitedStars.has(startStarId)).toBe(true)
    expect(state.visitedStars.has(otherStar)).toBe(true)
    expect(state.exploredPlanets.has(planetA)).toBe(true)
    expect(state.collectedIndividuals.size).toBe(3)
    expect(state.discoveredSpecies.get('sp001')).toBe(2)
    expect(state.discoveredSpecies.get('sp005')).toBe(1)
    expect(state.collectionEntries).toHaveLength(3)
    expect(state.scene).toEqual({ kind: 'system', starId: startStarId })
  })

  it('방문 별 캐시는 visitedAt 오름차순이다 — Set 순서가 여정 타임라인 (백로그 F-2)', () => {
    const laterStar = '3:0:2:0' as StarId
    const store = createGameStore({
      seed,
      startStarId: laterStar,
      driver: new MemoryDriver(),
      hydration: {
        // 드라이버 loadAll의 정렬은 구현마다 다르다 — 일부러 뒤섞어 넣는다
        visits: [
          { starId: laterStar, visitedAt: 3_000 },
          { starId: startStarId, visitedAt: 1_000 },
          { starId: otherStar, visitedAt: 2_000 },
        ],
        explorations: [],
        collection: [],
      },
    })

    expect([...store.getState().visitedStars]).toEqual([startStarId, otherStar, laterStar])
  })

  it('하이드레이션 없이도 시작 별 방문만으로 부팅된다 (새 우주)', () => {
    const store = createGameStore({ seed, startStarId, driver: new MemoryDriver() })
    expect(store.getState().visitedStars.size).toBe(1)
    expect(store.getState().collectionEntries).toHaveLength(0)
  })

  it('메모리 드라이버로 부팅하면 storageMode가 memory다 (경고 배너 조건)', () => {
    const store = createGameStore({ seed, startStarId, driver: new MemoryDriver() })
    expect(store.getState().storageMode).toBe('memory')
  })
})
