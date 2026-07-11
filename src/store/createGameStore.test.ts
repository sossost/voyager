import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PlanetId, Seed, Star, StarId, StarKind } from '@/engine'
import { DISK_BH_STAR_ID, originStar, parseSeed, starsInSector } from '@/engine'
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

// 블랙홀은 대질량 O/B의 종착이라 매우 희귀(평면 sy=0만으론 표본에 2개가 안 잡힌다).
// 수직 두께 전체(±SAMPLE_SY_SPAN)를 훑어 동종 블랙홀 2개를 확보한다.
const SAMPLE_XZ_SPAN = 12
const SAMPLE_SY_SPAN = 4

/** 시작 별 주변 3D 박스를 훑어 테스트용 별 표본을 모은다 (이색 천체 발견 테스트용). */
function sampleStars(): Star[] {
  const stars: Star[] = []
  for (let sx = -SAMPLE_XZ_SPAN; sx <= SAMPLE_XZ_SPAN; sx++) {
    for (let sy = -SAMPLE_SY_SPAN; sy <= SAMPLE_SY_SPAN; sy++) {
      for (let sz = -SAMPLE_XZ_SPAN; sz <= SAMPLE_XZ_SPAN; sz++) {
        stars.push(...starsInSector(seed, { sx, sy, sz }))
      }
    }
  }
  return stars
}

const allStars = sampleStars()
// 같은 종류가 2개 이상 있는 이색 kind를 골라 A·B 두 별을 확보 (최초/두 번째 발견 구분 테스트).
// 이번 PR=블랙홀만 (거성·왜성·펄서는 후속 PR에서 EXOTIC_KINDS에 추가).
const EXOTIC_KINDS: readonly StarKind[] = ['black_hole']
const pairKind = EXOTIC_KINDS.find(
  (kind) => allStars.filter((s) => s.id !== startStarId && s.kind === kind).length >= 2,
)
if (pairKind == null) throw new Error('테스트용 동종 이색 천체 2개를 찾지 못했습니다')
const sameKindStars = allStars.filter((s) => s.id !== startStarId && s.kind === pairKind)
const exoticStarA = sameKindStars[0] as Star
const exoticStarB = sameKindStars[1] as Star
const mainStar = allStars.find((s) => s.id !== startStarId && s.kind === 'main_sequence')
if (mainStar == null) throw new Error('테스트용 주계열성을 찾지 못했습니다')
// 펄서 — 블랙홀보다 흔해 표본에 반드시 있다 (펄서 발견 트리거·kind 기록 검증용).
const pulsarStar = allStars.find((s) => s.id !== startStarId && s.kind === 'pulsar')
if (pulsarStar == null) throw new Error('테스트용 펄서를 찾지 못했습니다')

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

  it('selectStar는 bodyIndex를 기록하고 미지정 시 주성(0)으로 둔다 (다중성계)', () => {
    store.getState().selectStar(target, 2)
    expect(store.getState().selectedStarId).toBe(target)
    expect(store.getState().selectedBodyIndex).toBe(2)

    // 미지정 = 주성(0)
    store.getState().selectStar(startStarId)
    expect(store.getState().selectedBodyIndex).toBe(0)

    // 해제 시 0으로 리셋
    store.getState().selectStar(null)
    expect(store.getState().selectedStarId).toBeNull()
    expect(store.getState().selectedBodyIndex).toBe(0)
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

describe('능동 스캔 (scanSurroundings)', () => {
  /** 블랙홀에 정박한 항법(퍼스펙티브) 뷰 → 그 별 반경 안엔 최소 자기 자신이 있다 (자기포함). */
  const anchorAtBlackHoleInNav = () => {
    store.getState().warpTo(exoticStarA.id)
    store.getState().onWarpComplete()
    store.getState().openPerspective() // 스캔은 항법 뷰 전용
  }

  const lastToast = () => {
    const { toasts } = store.getState()
    return toasts[toasts.length - 1]?.message
  }

  it('항법에서 스캔하면 반경 내 블랙홀을 scannedStars에 기록하고 감지 토스트를 띄운다', () => {
    anchorAtBlackHoleInNav()
    store.getState().scanSurroundings()

    expect(store.getState().scannedStars.has(exoticStarA.id)).toBe(true)
    expect(lastToast()).toMatch(/특이 천체 \d+개 감지/)
  })

  it('탐사 발동마다 소나 토큰이 증가한다 (연출 트리거)', () => {
    anchorAtBlackHoleInNav()
    const before = store.getState().scanPulseToken
    store.getState().scanSurroundings()
    expect(store.getState().scanPulseToken).toBe(before + 1)
  })

  it('함교(우주선) 뷰에서는 스캔이 무시된다 — 항법 전용', () => {
    store.getState().warpTo(exoticStarA.id)
    store.getState().onWarpComplete() // 도착 = 우주선(함교) 뷰
    const before = store.getState().scanPulseToken
    store.getState().scanSurroundings()

    expect(store.getState().scannedStars.size).toBe(0)
    expect(store.getState().scanPulseToken).toBe(before) // 토큰도 안 오른다 — 발동 자체가 없음
  })

  it('새로 감지된 천체가 없으면 안내 토스트만 띄우고 기록은 그대로다 (재스캔 멱등)', () => {
    anchorAtBlackHoleInNav()
    store.getState().scanSurroundings()
    const afterFirst = store.getState().scannedStars

    store.getState().scanSurroundings() // 두 번째 — 같은 반경, 새 감지 없음
    expect(store.getState().scannedStars).toBe(afterFirst) // 새 Set으로 교체 안 됨
    expect(lastToast()).toBe('이 주변엔 특이 천체가 없습니다')
  })

  it('마커는 일시적 — 이동(워프)하면 스캔 기록이 비워진다 (맵 난잡 방지)', () => {
    anchorAtBlackHoleInNav()
    store.getState().scanSurroundings()
    expect(store.getState().scannedStars.size).toBeGreaterThan(0)

    store.getState().warpTo(target) // 다른 별로 이동
    expect(store.getState().scannedStars.size).toBe(0)
  })

  it('스캔 결과는 저장되지 않는다 — 새로고침(하이드레이션)에 딸려오지 않는다', async () => {
    anchorAtBlackHoleInNav()
    store.getState().scanSurroundings()

    // 프로필에 스캔 관련 필드가 실리지 않는다 (일시 상태라 persist 대상 아님)
    await vi.waitFor(async () => {
      expect(await driver.loadProfile()).not.toBeNull()
    })
    const profile = await driver.loadProfile()
    expect(profile).not.toHaveProperty('scannedStars')
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

describe('시뮬레이션 배속 (setTimeScale)', () => {
  it('기본 배속은 1이다', () => {
    expect(store.getState().timeScale).toBe(1)
  })

  it('setTimeScale은 배속을 바꾼다', () => {
    store.getState().setTimeScale(16)
    expect(store.getState().timeScale).toBe(16)
  })

  it('0(일시정지)을 설정할 수 있다', () => {
    store.getState().setTimeScale(0)
    expect(store.getState().timeScale).toBe(0)
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

describe('현상 발견 (exotic-bodies)', () => {
  it('이색 천체로 워프하면 현상이 기록되고 최초 발견 토스트가 뜬다', () => {
    expect(store.getState().discoveredPhenomena).toHaveLength(0)

    store.getState().warpTo(exoticStarA.id)

    const discoveries = store.getState().discoveredPhenomena
    expect(discoveries).toHaveLength(1)
    expect(discoveries[0]).toMatchObject({ starId: exoticStarA.id, kind: exoticStarA.kind })
    expect(store.getState().toasts.some((toast) => toast.message.includes('최초 발견'))).toBe(true)
  })

  it('주계열성으로 워프하면 현상은 기록되지 않는다', () => {
    store.getState().warpTo(mainStar.id)

    expect(store.getState().discoveredPhenomena).toHaveLength(0)
    expect(store.getState().toasts.some((toast) => toast.message.includes('최초 발견'))).toBe(false)
  })

  it('펄서로 워프하면 kind:pulsar 현상이 기록된다 (펄서)', () => {
    store.getState().warpTo(pulsarStar.id)

    const discoveries = store.getState().discoveredPhenomena
    expect(discoveries).toHaveLength(1)
    expect(discoveries[0]).toMatchObject({ starId: pulsarStar.id, kind: 'pulsar' })
  })

  it('같은 이색 천체 재방문은 중복 기록하지 않는다 (멱등)', () => {
    store.getState().warpTo(exoticStarA.id)
    store.getState().onWarpComplete()
    store.getState().warpTo(mainStar.id)
    store.getState().onWarpComplete()
    store.getState().warpTo(exoticStarA.id)

    expect(
      store.getState().discoveredPhenomena.filter((d) => d.starId === exoticStarA.id),
    ).toHaveLength(1)
  })

  it('같은 종류의 두 번째 발견은 기록되지만 최초 발견 토스트는 한 번뿐이다', () => {
    store.getState().warpTo(exoticStarA.id)
    store.getState().onWarpComplete()
    store.getState().warpTo(exoticStarB.id)

    expect(store.getState().discoveredPhenomena).toHaveLength(2)
    expect(
      store.getState().toasts.filter((toast) => toast.message.includes('최초 발견')),
    ).toHaveLength(1)
  })

  it('발견은 프로필에 영속된다 (Profile.discoveredPhenomena, 옵션 b)', async () => {
    store.getState().warpTo(exoticStarA.id)

    await vi.waitFor(async () => {
      const profile = await driver.loadProfile()
      expect(profile?.discoveredPhenomena?.map((d) => d.starId)).toContain(exoticStarA.id)
    })
  })
})

describe('특이계 발견 (exotic-codex)', () => {
  it('유니크계로 워프하면 특이계 도감에 등록되고 토스트가 뜬다', () => {
    expect(store.getState().discoveredUniques).toHaveLength(0)

    store.getState().warpTo(DISK_BH_STAR_ID)

    const discoveries = store.getState().discoveredUniques
    expect(discoveries).toHaveLength(1)
    expect(discoveries[0]).toMatchObject({ uniqueId: 'disk_bh', discoveredAt: 12_345 })
    expect(store.getState().toasts.some((toast) => toast.message.includes('특이계 발견'))).toBe(
      true,
    )
    // 유니크계는 블랙홀이기도 하다 — 현상 도감(kind)에도 같은 워프로 함께 기록된다.
    expect(
      store.getState().discoveredPhenomena.some((d) => d.starId === DISK_BH_STAR_ID),
    ).toBe(true)
  })

  it('유니크계 재방문은 중복 등록하지 않는다 (멱등)', () => {
    store.getState().warpTo(DISK_BH_STAR_ID)
    store.getState().onWarpComplete()
    store.getState().warpTo(mainStar.id)
    store.getState().onWarpComplete()
    store.getState().warpTo(DISK_BH_STAR_ID)

    expect(store.getState().discoveredUniques).toHaveLength(1)
    expect(
      store.getState().toasts.filter((toast) => toast.message.includes('특이계 발견')),
    ).toHaveLength(1)
  })

  it('일반 별 워프는 특이계를 기록하지 않는다', () => {
    store.getState().warpTo(mainStar.id)
    expect(store.getState().discoveredUniques).toHaveLength(0)
  })

  it('발견은 프로필에 영속된다 (Profile.discoveredUniques)', async () => {
    store.getState().warpTo(DISK_BH_STAR_ID)

    await vi.waitFor(async () => {
      const profile = await driver.loadProfile()
      expect(profile?.discoveredUniques?.map((d) => d.uniqueId)).toContain('disk_bh')
    })
  })

  it('initialDiscoveredUniques로 하이드레이션된다', () => {
    const hydrated = createGameStore({
      seed,
      startStarId,
      driver,
      now: () => 12_345,
      createdAt: 1_000,
      initialDiscoveredUniques: [{ uniqueId: 'feeding_bh', discoveredAt: 7 }],
    })
    expect(hydrated.getState().discoveredUniques).toEqual([
      { uniqueId: 'feeding_bh', discoveredAt: 7 },
    ])
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
