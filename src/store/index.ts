import type { Seed } from '@/engine'
import { originStar, parseSeed } from '@/engine'
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

/** 앱 전역 게임 스토어 — Canvas 안팎이 같은 인스턴스를 공유한다. */
export const useGameStore = createGameStore({
  seed: bootSeed,
  startStarId: originStar(bootSeed),
})

export type { GameStore, SceneState } from '@/store/types'
