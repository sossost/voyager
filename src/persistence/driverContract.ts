import { beforeEach, describe, expect, it } from 'vitest'

import type { IndividualId, PlanetId, Seed, StarId } from '@/engine'
import { SAVE_VERSION, type Profile, type StorageDriver } from '@/persistence/types'

/**
 * StorageDriver 공유 계약 테스트 — Dexie/Memory 두 구현이 같은 케이스를 통과해야
 * 폴백 동등성 AC('메모리 모드에서도 전체 플레이 가능')가 성립한다 (결정 19).
 */

const starA = '0:0:0:0' as StarId
const starB = '1:0:0:2' as StarId
const planetA = '0:0:0:0:p0' as PlanetId
const planetB = '0:0:0:0:p1' as PlanetId

function profileOf(currentStarId: StarId): Profile {
  return {
    id: 1,
    seed: 'CONTRACT' as Seed,
    saveVersion: SAVE_VERSION,
    genVersion: 1,
    currentStarId,
    createdAt: 1_000,
  }
}

function entryOf(individualId: string, planetId: PlanetId, isFirstOfSpecies: boolean) {
  return {
    individualId: individualId as IndividualId,
    speciesId: 'sp001',
    rarity: 'common' as const,
    planetId,
    discoveredAt: 2_000,
    isFirstOfSpecies,
  }
}

export function describeStorageDriverContract(
  driverName: string,
  makeDriver: () => Promise<StorageDriver> | StorageDriver,
): void {
  describe(`StorageDriver 계약: ${driverName}`, () => {
    let driver: StorageDriver

    beforeEach(async () => {
      driver = await makeDriver()
      await driver.reset()
    })

    it('프로필: 최초에는 null, 저장 후 왕복 보존', async () => {
      expect(await driver.loadProfile()).toBeNull()

      const profile = profileOf(starA)
      await driver.saveProfile(profile)
      expect(await driver.loadProfile()).toEqual(profile)

      await driver.saveProfile({ ...profile, currentStarId: starB })
      expect((await driver.loadProfile())?.currentStarId).toBe(starB)
    })

    it('방문: starId 업서트 — 재방문은 visitedAt만 갱신한다', async () => {
      await driver.addVisit({ starId: starA, visitedAt: 100 })
      await driver.addVisit({ starId: starA, visitedAt: 300 })

      const { visits } = await driver.loadAll()
      expect(visits).toHaveLength(1)
      expect(visits[0]?.visitedAt).toBe(300)
    })

    it('방문 목록: 최근 방문 순 정렬 + 페이징', async () => {
      await driver.addVisit({ starId: starA, visitedAt: 100 })
      await driver.addVisit({ starId: starB, visitedAt: 200 })

      const firstPage = await driver.listVisits({ offset: 0, limit: 1 })
      expect(firstPage.map((visit) => visit.starId)).toEqual([starB])

      const secondPage = await driver.listVisits({ offset: 1, limit: 1 })
      expect(secondPage.map((visit) => visit.starId)).toEqual([starA])
    })

    it('탐사 기록: 최초 기록 우선 — 중복 추가는 무시된다 (멱등)', async () => {
      await driver.addExploration({ planetId: planetA, exploredAt: 100 })
      await driver.addExploration({ planetId: planetA, exploredAt: 999 })

      const { explorations } = await driver.loadAll()
      expect(explorations).toHaveLength(1)
      expect(explorations[0]?.exploredAt).toBe(100)
    })

    it('수집: individualId가 결정론 PK — 중복 등록이 차단된다 (멱등)', async () => {
      await driver.addCollectionEntry(entryOf('alien-1', planetA, true))
      await driver.addCollectionEntry(entryOf('alien-1', planetA, false)) // 무시되어야 함
      await driver.addCollectionEntry(entryOf('alien-2', planetB, false))

      const { collection } = await driver.loadAll()
      expect(collection).toHaveLength(2)
      const first = collection.find((entry) => entry.individualId === 'alien-1')
      expect(first?.isFirstOfSpecies).toBe(true) // 최초 기록 보존
    })

    it('reset: 모든 기록을 지운다', async () => {
      await driver.saveProfile(profileOf(starA))
      await driver.addVisit({ starId: starA, visitedAt: 100 })
      await driver.addExploration({ planetId: planetA, exploredAt: 100 })
      await driver.addCollectionEntry(entryOf('alien-1', planetA, true))

      await driver.reset()

      expect(await driver.loadProfile()).toBeNull()
      const { visits, explorations, collection } = await driver.loadAll()
      expect(visits).toHaveLength(0)
      expect(explorations).toHaveLength(0)
      expect(collection).toHaveLength(0)
    })
  })
}
