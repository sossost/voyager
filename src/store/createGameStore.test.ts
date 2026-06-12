import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PlanetId, Seed, StarId } from '@/engine'
import { originStar, parseSeed, starsInSector } from '@/engine'
import { MemoryDriver } from '@/persistence/memoryDriver'
import type { GameStoreApi } from './createGameStore'
import { createGameStore } from './createGameStore'

function seedOf(value: string): Seed {
  const seed = parseSeed(value)
  if (seed == null) throw new Error(`테스트 시드가 유효하지 않습니다: ${value}`)
  return seed
}

const seed = seedOf('STORETEST')
const startStarId = originStar(seed)

function otherStarId(): StarId {
  // 시작 별과 다른 실제 별을 하나 찾는다
  for (let sx = 0; sx < 10; sx++) {
    for (const star of starsInSector(seed, { sx, sy: 0, sz: 1 })) {
      if (star.id !== startStarId) return star.id
    }
  }
  throw new Error('테스트용 별을 찾지 못했습니다')
}

const target = otherStarId()

let store: GameStoreApi
let driver: MemoryDriver

beforeEach(() => {
  driver = new MemoryDriver()
  store = createGameStore({ seed, startStarId, driver, now: () => 12_345, createdAt: 1_000 })
})

describe('초기 상태', () => {
  it('첫 화면은 시작 별의 우주선 뷰다 — 항성계가 우주선 뷰에 통합됨 (스펙 AC, 결정 41)', () => {
    expect(store.getState().scene).toEqual({ kind: 'galaxy', view: 'ship' })
    expect(store.getState().currentStarId).toBe(startStarId)
  })

  it('시작 별은 방문한 것으로 기록된다', () => {
    expect(store.getState().visitedStars.has(startStarId)).toBe(true)
  })
})

describe('씬 전이 가드', () => {
  it('selectStar는 은하 뷰(ship·perspective)에서 동작하고 워프 중엔 무시된다 (결정 41-f)', () => {
    store.getState().selectStar(target)
    expect(store.getState().selectedStarId).toBe(target) // 우주선 뷰 — 동작

    store.getState().openPerspective()
    store.getState().selectStar(startStarId)
    expect(store.getState().selectedStarId).toBe(startStarId) // 퍼스펙티브 — 동작

    store.getState().returnToShip()
    store.getState().warpTo(target) // 워프 시작 → selectedStarId 리셋
    store.getState().selectStar(startStarId)
    expect(store.getState().selectedStarId).toBeNull() // 워프 중 — 무시
  })

  it('warpTo는 다른 별로만, 은하 뷰에서만 가능하다', () => {
    store.getState().warpTo(startStarId)
    expect(store.getState().scene).toEqual({ kind: 'galaxy', view: 'ship' }) // 현재 별로 워프 불가

    store.getState().warpTo(target)
    expect(store.getState().scene).toEqual({ kind: 'warping', from: startStarId, to: target })
  })

  it('워프 중 재워프는 가드로 차단된다', () => {
    store.getState().warpTo(target)
    const during = store.getState().scene

    store.getState().warpTo(startStarId)
    expect(store.getState().scene).toEqual(during)
  })

  it('워프 시작 시점에 방문 기록과 현재 위치가 커밋된다 (연출 중단에도 안전)', () => {
    store.getState().warpTo(target)

    expect(store.getState().currentStarId).toBe(target)
    expect(store.getState().visitedStars.has(target)).toBe(true)
  })

  it('onWarpComplete는 warping에서만 우주선 뷰로 전이한다 (결정 41)', () => {
    store.getState().onWarpComplete()
    expect(store.getState().scene).toEqual({ kind: 'galaxy', view: 'ship' }) // galaxy에서 무시

    store.getState().warpTo(target)
    store.getState().onWarpComplete()
    expect(store.getState().scene).toEqual({ kind: 'galaxy', view: 'ship' })
    expect(store.getState().currentStarId).toBe(target)
  })

  it('워프 도착은 pendingArrival을 켜고, consumeArrival이 1회성으로 끈다 (도착 확대 연출)', () => {
    expect(store.getState().pendingArrival).toBe(false)

    store.getState().warpTo(target)
    expect(store.getState().pendingArrival).toBe(false) // 발동 시점엔 아직
    store.getState().onWarpComplete()
    expect(store.getState().pendingArrival).toBe(true) // 도착 = 트리거

    store.getState().consumeArrival()
    expect(store.getState().pendingArrival).toBe(false) // 카메라가 소비

    store.getState().consumeArrival()
    expect(store.getState().pendingArrival).toBe(false) // 멱등 — 변화 없음
  })

  it('퍼스펙티브 뷰를 열고 우주선 뷰로 돌아온다 (결정 41)', () => {
    expect(store.getState().scene).toEqual({ kind: 'galaxy', view: 'ship' })

    store.getState().openPerspective()
    expect(store.getState().scene).toEqual({ kind: 'galaxy', view: 'perspective' })

    store.getState().returnToShip()
    expect(store.getState().scene).toEqual({ kind: 'galaxy', view: 'ship' })
  })

  it('뷰 전환은 은하 뷰에서만 — 워프 중엔 무시된다', () => {
    store.getState().openPerspective()
    store.getState().warpTo(target)
    store.getState().returnToShip() // warping에서 — 무시
    expect(store.getState().scene.kind).toBe('warping')
  })
})

describe('불변성', () => {
  it('visitedStars는 변이가 아니라 새 인스턴스로 교체된다', () => {
    const before = store.getState().visitedStars
    store.getState().warpTo(target)
    expect(store.getState().visitedStars).not.toBe(before)
    expect(before.has(target)).toBe(false)
  })
})

describe('write-through 영속화', () => {
  it('워프 시 방문 기록과 프로필이 드라이버에 저장된다', async () => {
    store.getState().warpTo(target)

    await vi.waitFor(async () => {
      const { visits } = await driver.loadAll()
      expect(visits.map((visit) => visit.starId)).toContain(target)
    })
    expect((await driver.loadProfile())?.currentStarId).toBe(target)
  })

  it('같은 별 왕복 재방문은 기록을 중복 생성하지 않는다 (멱등)', async () => {
    const roundTrip = (to: StarId) => {
      store.getState().warpTo(to)
      store.getState().onWarpComplete()
    }

    roundTrip(target)
    roundTrip(startStarId)
    roundTrip(target)

    await vi.waitFor(async () => {
      const { visits } = await driver.loadAll()
      expect(visits.filter((visit) => visit.starId === target)).toHaveLength(1)
      expect(visits.filter((visit) => visit.starId === startStarId)).toHaveLength(1)
    })
  })
})

describe('selectPlanet / setQuality', () => {
  it('selectPlanet은 우주선 뷰에서만 동작하고 퍼스펙티브 전환 시 해제된다 (결정 41)', () => {
    const planetId = `${startStarId}:p0` as PlanetId

    store.getState().selectPlanet(planetId)
    expect(store.getState().selectedPlanetId).toBe(planetId) // 우주선 뷰 — 동작

    store.getState().openPerspective()
    expect(store.getState().selectedPlanetId).toBeNull() // 퍼스펙티브엔 행성이 없음 — 해제

    store.getState().selectPlanet(planetId)
    expect(store.getState().selectedPlanetId).toBeNull() // 퍼스펙티브 — 무시
  })

  it('setQuality는 티어와 모드를 함께 바꾼다', () => {
    store.getState().setQuality('low', 'manual')
    expect(store.getState().qualityTier).toBe('low')
    expect(store.getState().qualityMode).toBe('manual')
  })
})

describe('영속화 실패 처리', () => {
  it('재시도 소진 후 토스트로 알리고 게임은 계속된다', async () => {
    vi.useFakeTimers()
    try {
      const failingDriver = new MemoryDriver()
      failingDriver.addVisit = () => Promise.reject(new Error('디스크 오류'))

      const failingStore = createGameStore({
        seed,
        startStarId,
        driver: failingDriver,
        now: () => 1,
        createdAt: 1,
      })

      failingStore.getState().warpTo(target)
      expect(failingStore.getState().currentStarId).toBe(target) // 진행 비차단

      await vi.advanceTimersByTimeAsync(200 + 600 + 1_800 + 10)
      expect(failingStore.getState().toasts.map((toast) => toast.message)).toContain(
        '저장에 실패했어요 — 게임은 계속 진행됩니다',
      )
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('uiSlice', () => {
  it('오버레이 열기/닫기', () => {
    store.getState().openOverlay('codex')
    expect(store.getState().overlay).toBe('codex')
    store.getState().closeOverlay()
    expect(store.getState().overlay).toBeNull()
  })

  it('토스트는 고유 id로 쌓이고 개별 해제된다', () => {
    store.getState().pushToast('첫 번째')
    store.getState().pushToast('두 번째')
    const [first, second] = store.getState().toasts
    expect(first?.id).not.toBe(second?.id)

    if (first != null) store.getState().dismissToast(first.id)
    expect(store.getState().toasts.map((toast) => toast.message)).toEqual(['두 번째'])
  })

  it('여정 경로선은 기본 꺼짐이고 토글로 켜고 끈다 (백로그 F-2)', () => {
    expect(store.getState().isJourneyPathVisible).toBe(false)
    store.getState().toggleJourneyPath()
    expect(store.getState().isJourneyPathVisible).toBe(true)
    store.getState().toggleJourneyPath()
    expect(store.getState().isJourneyPathVisible).toBe(false)
  })
})
