import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PlanetId, Seed, StarId } from '@/engine'
import { originStar, parseSeed, planetsOf, starsInSector } from '@/engine'
import { MemoryDriver } from '@/persistence/memoryDriver'
import type { GameStoreApi } from './createGameStore'
import { createGameStore } from './createGameStore'

function seedOf(value: string): Seed {
  const seed = parseSeed(value)
  if (seed == null) throw new Error(`테스트 시드가 유효하지 않습니다: ${value}`)
  return seed
}

const seed = seedOf('EXPLORETEST')
const startStarId = originStar(seed)

/** 조건에 맞는 첫 행성을 찾는다 (결정론 — 항상 같은 결과). */
function findFirstPlanet(matches: (hasLife: boolean) => boolean): { planet: PlanetId; star: StarId } {
  for (let sx = 0; sx < 30; sx++) {
    for (const star of starsInSector(seed, { sx, sy: 0, sz: 2 })) {
      for (const planet of planetsOf(seed, star.id)) {
        if (matches(planet.hasLife)) return { planet: planet.id, star: star.id }
      }
    }
  }
  throw new Error('테스트용 행성을 찾지 못했습니다')
}

const lifeTarget = findFirstPlanet((hasLife) => hasLife)
const barrenTarget = findFirstPlanet((hasLife) => !hasLife)
const lifePlanet = lifeTarget.planet
const lifeStar = lifeTarget.star
const barrenPlanet = barrenTarget.planet
const barrenStar = barrenTarget.star

let store: GameStoreApi
let driver: MemoryDriver

function warpToStar(starId: StarId) {
  // 워프 → 도착 = 우주선 뷰 (통합 후 explore는 우주선 뷰에서만, 결정 41)
  store.getState().warpTo(starId)
  store.getState().onWarpComplete()
}

beforeEach(() => {
  driver = new MemoryDriver()
  store = createGameStore({ seed, startStarId, driver, now: () => 99_999, createdAt: 1_000 })
})

describe('explore 가드', () => {
  it('무생명 행성은 조우가 발생하지 않는다', () => {
    warpToStar(barrenStar)
    store.getState().explore(barrenPlanet)
    expect(store.getState().encounter).toBeNull()
  })

  it('다른 항성계의 행성은 탐사할 수 없다', () => {
    warpToStar(barrenStar) // lifePlanet은 lifeStar 소속
    store.getState().explore(lifePlanet)
    expect(store.getState().encounter).toBeNull()
  })

  it('조우가 열려 있는 동안 추가 탐사는 무시된다', () => {
    warpToStar(lifeStar)
    store.getState().explore(lifePlanet)
    const first = store.getState().encounter
    store.getState().explore(lifePlanet)
    expect(store.getState().encounter).toBe(first)
  })
})

describe('explore 수집', () => {
  it('첫 탐사: 조우 생성 + 캐시 갱신 + 최초 발견 플래그 + write-through', async () => {
    warpToStar(lifeStar)
    store.getState().explore(lifePlanet)

    const { encounter, exploredPlanets, collectedIndividuals, discoveredSpecies } = store.getState()
    expect(encounter).not.toBeNull()
    expect(encounter?.phase).toBe('scanning')
    expect(encounter?.alreadyCollected).toBe(false)
    expect(encounter?.isFirstOfSpecies).toBe(true)
    expect(exploredPlanets.has(lifePlanet)).toBe(true)
    if (encounter == null) return
    expect(collectedIndividuals.has(encounter.alien.individualId)).toBe(true)
    expect(discoveredSpecies.get(encounter.alien.speciesId)).toBe(1)

    await vi.waitFor(async () => {
      const { explorations, collection } = await driver.loadAll()
      expect(explorations.map((record) => record.planetId)).toContain(lifePlanet)
      expect(collection).toHaveLength(1)
      expect(collection[0]?.isFirstOfSpecies).toBe(true)
    })
  })

  it('재탐사: 동일 개체 + 이미 조우함 + 중복 등록 없음 (멱등 — 스펙 AC)', async () => {
    warpToStar(lifeStar)
    store.getState().explore(lifePlanet)
    const firstAlien = store.getState().encounter?.alien
    store.getState().closeEncounter()

    store.getState().explore(lifePlanet)
    const second = store.getState().encounter

    expect(second?.alien).toEqual(firstAlien) // 결정론 — 같은 행성 = 같은 개체
    expect(second?.alreadyCollected).toBe(true)
    expect(second?.isFirstOfSpecies).toBe(false)
    expect(store.getState().collectedIndividuals.size).toBe(1)
    expect(store.getState().discoveredSpecies.get(second?.alien.speciesId ?? '')).toBe(1)

    await vi.waitFor(async () => {
      const { collection } = await driver.loadAll()
      expect(collection).toHaveLength(1)
    })
  })
})

describe('조우 전이', () => {
  it('scanning → reveal → close', () => {
    warpToStar(lifeStar)
    store.getState().explore(lifePlanet)

    store.getState().revealEncounter()
    expect(store.getState().encounter?.phase).toBe('reveal')

    store.getState().revealEncounter() // reveal에서 재호출은 무시
    expect(store.getState().encounter?.phase).toBe('reveal')

    store.getState().closeEncounter()
    expect(store.getState().encounter).toBeNull()
  })
})
