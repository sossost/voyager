import { useStore } from 'zustand'

import type { StorageDriver } from '@/persistence/types'
import type { CreateGameStoreOptions, GameStoreApi } from '@/store/createGameStore'
import { createGameStore } from '@/store/createGameStore'
import { syncSystemUrl } from '@/store/systemUrl'
import type { GameStore } from '@/store/types'

/**
 * 게임 스토어 싱글톤 홀더 — 부트 시퀀스(BootGate)가 프로필 복원 후 초기화한다.
 * <App/>은 초기화 이후에만 렌더되므로 컴포넌트에서의 접근은 항상 안전하다.
 */
let storeApi: GameStoreApi | null = null
let storageDriver: StorageDriver | null = null

export function initializeGameStore(options: CreateGameStoreOptions): GameStoreApi {
  storeApi = createGameStore(options)
  storageDriver = options.driver

  // 정박한 항성계를 주소창에 동기화 — 공유 가능한 딥링크 (백로그 L-1).
  // 진입 즉시 한 번, 이후엔 워프 완료(scene → galaxy)·시스템 이동 시에만 갱신한다.
  // 워프 중(scene.kind === 'warping')에는 보류 — URL은 '실제 정박한 항성계'만 가리킨다.
  syncSystemUrl(storeApi.getState().seed, storeApi.getState().currentStarId)
  storeApi.subscribe((state, previous) => {
    if (state.scene.kind !== 'galaxy') return
    const hasJustAnchored = previous.scene.kind !== 'galaxy'
    const hasMovedSystem = state.currentStarId !== previous.currentStarId
    if (!hasJustAnchored && !hasMovedSystem) return
    syncSystemUrl(state.seed, state.currentStarId)
  })

  // 개발/E2E 전용 — Playwright는 픽셀 비교 대신 상태를 단언한다 (테스트 전략)
  if (typeof window !== 'undefined' && import.meta.env.DEV) {
    ;(window as Window & { __gameStore?: GameStoreApi })['__gameStore'] = storeApi
  }
  return storeApi
}

export function getGameStoreApi(): GameStoreApi {
  if (storeApi == null) {
    throw new Error('게임 스토어가 초기화되지 않았습니다 — BootGate 이후에 사용하세요')
  }
  return storeApi
}

/** 일지 페이징 등 UI의 직접 조회 경로 (store 캐시 + listVisits만 허용 — 결정 19). */
export function getStorageDriver(): StorageDriver {
  if (storageDriver == null) {
    throw new Error('저장 드라이버가 초기화되지 않았습니다 — BootGate 이후에 사용하세요')
  }
  return storageDriver
}

function useGameStoreImpl<T>(selector: (state: GameStore) => T): T {
  return useStore(getGameStoreApi(), selector)
}

/** zustand 훅 인터페이스 호환 — useGameStore(selector) + useGameStore.getState(). */
export const useGameStore = Object.assign(useGameStoreImpl, {
  getState: (): GameStore => getGameStoreApi().getState(),
})

export type { GameStore, SceneState } from '@/store/types'
