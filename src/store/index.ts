import type { Seed } from '@/engine'
import { originStar, parseSeed } from '@/engine'
import { MemoryDriver } from '@/persistence/memoryDriver'
import { createGameStore } from '@/store/createGameStore'

/**
 * 임시 부트 시드 해석 — Phase 6에서 SeedSetup 온보딩 + IndexedDB 복원으로 대체된다.
 * ?seed= 딥링크가 있으면 사용, 없거나 유효하지 않으면 데모 시드.
 */
function resolveBootSeed(): Seed {
  const FALLBACK = parseSeed('STELLARDEMO')
  /* v8 ignore next -- 리터럴 상수는 항상 유효 */
  if (FALLBACK == null) throw new Error('unreachable')

  if (typeof window === 'undefined') return FALLBACK
  const raw = new URLSearchParams(window.location.search).get('seed')
  if (raw == null) return FALLBACK
  return parseSeed(raw) ?? FALLBACK
}

const bootSeed = resolveBootSeed()

/**
 * 앱 전역 게임 스토어 — Canvas 안팎이 같은 인스턴스를 공유한다.
 * 임시로 MemoryDriver 사용 — Phase 6에서 probeStorage(Dexie/Memory 자동 선택)로 대체.
 */
export const useGameStore = createGameStore({
  seed: bootSeed,
  startStarId: originStar(bootSeed),
  driver: new MemoryDriver(),
})

// 개발/E2E 전용 — 상태 단언용 (Playwright는 픽셀 비교 대신 상태를 단언한다, 결정: 테스트 전략)
if (import.meta.env.DEV || import.meta.env.MODE === 'e2e') {
  ;(window as unknown as Record<string, unknown>)['__gameStore'] = useGameStore
}

export type { GameStore, SceneState } from '@/store/types'
