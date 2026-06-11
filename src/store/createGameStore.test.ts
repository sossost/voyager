import { beforeEach, describe, expect, it } from 'vitest'

import type { Seed, StarId } from '@/engine'
import { originStar, parseSeed, starsInSector } from '@/engine'
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

beforeEach(() => {
  store = createGameStore({ seed, startStarId })
})

describe('초기 상태', () => {
  it('첫 화면은 시작 별계의 태양계 뷰다 (스펙 AC)', () => {
    expect(store.getState().scene).toEqual({ kind: 'system', starId: startStarId })
    expect(store.getState().currentStarId).toBe(startStarId)
  })

  it('시작 별은 방문한 것으로 기록된다', () => {
    expect(store.getState().visitedStars.has(startStarId)).toBe(true)
  })
})

describe('씬 전이 가드', () => {
  it('selectStar는 은하 뷰에서만 동작한다', () => {
    store.getState().selectStar(target)
    expect(store.getState().selectedStarId).toBeNull() // system 씬이라 무시

    store.getState().backToGalaxy()
    store.getState().selectStar(target)
    expect(store.getState().selectedStarId).toBe(target)
  })

  it('warpTo는 은하 뷰에서만, 다른 별로만 가능하다', () => {
    store.getState().warpTo(target)
    expect(store.getState().scene.kind).toBe('system') // system에서 워프 불가

    store.getState().backToGalaxy()
    store.getState().warpTo(startStarId)
    expect(store.getState().scene.kind).toBe('galaxy') // 현재 별로 워프 불가

    store.getState().warpTo(target)
    expect(store.getState().scene).toEqual({ kind: 'warping', from: startStarId, to: target })
  })

  it('워프 중 재워프는 가드로 차단된다', () => {
    store.getState().backToGalaxy()
    store.getState().warpTo(target)
    const during = store.getState().scene

    store.getState().warpTo(startStarId)
    expect(store.getState().scene).toEqual(during)
  })

  it('워프 시작 시점에 방문 기록과 현재 위치가 커밋된다 (연출 중단에도 안전)', () => {
    store.getState().backToGalaxy()
    store.getState().warpTo(target)

    expect(store.getState().currentStarId).toBe(target)
    expect(store.getState().visitedStars.has(target)).toBe(true)
  })

  it('onWarpComplete는 warping에서만 system으로 전이한다', () => {
    store.getState().onWarpComplete()
    expect(store.getState().scene.kind).toBe('system') // 이미 system — 변화 없음

    store.getState().backToGalaxy()
    store.getState().onWarpComplete()
    expect(store.getState().scene.kind).toBe('galaxy') // galaxy에서 무시

    store.getState().warpTo(target)
    store.getState().onWarpComplete()
    expect(store.getState().scene).toEqual({ kind: 'system', starId: target })
  })

  it('enterCurrentSystem은 현재 별을 선택했을 때만 워프 없이 진입한다', () => {
    store.getState().backToGalaxy()

    store.getState().selectStar(target)
    store.getState().enterCurrentSystem()
    expect(store.getState().scene.kind).toBe('galaxy') // 다른 별 선택 중 — 무시

    store.getState().selectStar(startStarId)
    const visitedBefore = store.getState().visitedStars
    store.getState().enterCurrentSystem()
    expect(store.getState().scene).toEqual({ kind: 'system', starId: startStarId })
    expect(store.getState().visitedStars).toBe(visitedBefore) // 재방문 기록 없음
  })

  it('backToGalaxy는 system에서만 동작한다', () => {
    store.getState().backToGalaxy()
    expect(store.getState().scene.kind).toBe('galaxy')

    store.getState().backToGalaxy()
    expect(store.getState().scene.kind).toBe('galaxy') // galaxy에서 무시 (변화 없음)
  })
})

describe('불변성', () => {
  it('visitedStars는 변이가 아니라 새 인스턴스로 교체된다', () => {
    const before = store.getState().visitedStars
    store.getState().backToGalaxy()
    store.getState().warpTo(target)
    expect(store.getState().visitedStars).not.toBe(before)
    expect(before.has(target)).toBe(false)
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
})
