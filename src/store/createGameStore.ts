import { create } from 'zustand'

import type { IndividualId, PlanetId, Seed, StarId } from '@/engine'
import { GEN_VERSION } from '@/engine'
import type { GameStore, QualityMode, QualityTier, SceneState } from '@/store/types'

export interface CreateGameStoreOptions {
  readonly seed: Seed
  readonly startStarId: StarId
}

let nextToastId = 1

/**
 * 게임 스토어 팩토리 — 테스트는 이 팩토리로 격리된 스토어를 만든다.
 *
 * 영속화 원칙 (02-decisions.md 결정 20): zustand/persist 미들웨어를 쓰지 않는다.
 * 진실 원천은 StorageDriver이고 스토어는 파생 캐시 — 변이 액션이 캐시 갱신과
 * persist 호출을 함께 수행하는 명시적 write-through만 허용한다.
 */
export function createGameStore(options: CreateGameStoreOptions) {
  return create<GameStore>()((set, get) => ({
    // ── universe (부트 후 불변) ──────────────────────────────
    seed: options.seed,
    genVersion: GEN_VERSION,

    // ── sceneSlice ──────────────────────────────────────────
    scene: { kind: 'system', starId: options.startStarId } satisfies SceneState,
    selectedStarId: null,
    selectedPlanetId: null,

    selectStar(starId) {
      if (get().scene.kind !== 'galaxy') return
      set({ selectedStarId: starId })
    },

    selectPlanet(planetId) {
      if (get().scene.kind !== 'system') return
      set({ selectedPlanetId: planetId })
    },

    warpTo(target) {
      const { scene, currentStarId, visitedStars } = get()
      if (scene.kind !== 'galaxy') return
      if (target === currentStarId) return

      // 저장 커밋은 연출 전에 — 워프 연출이 중단되어도 데이터는 안전 (결정 16)
      const nextVisited = new Set(visitedStars)
      nextVisited.add(target)
      set({
        scene: { kind: 'warping', from: currentStarId, to: target },
        selectedStarId: null,
        currentStarId: target,
        visitedStars: nextVisited,
      })
    },

    onWarpComplete() {
      const { scene } = get()
      if (scene.kind !== 'warping') return
      set({ scene: { kind: 'system', starId: scene.to } })
    },

    enterCurrentSystem() {
      const { scene, selectedStarId, currentStarId } = get()
      if (scene.kind !== 'galaxy') return
      if (selectedStarId !== currentStarId) return
      set({ scene: { kind: 'system', starId: currentStarId }, selectedStarId: null })
    },

    backToGalaxy() {
      if (get().scene.kind !== 'system') return
      set({ scene: { kind: 'galaxy' }, selectedPlanetId: null })
    },

    // ── playerSlice (영속 기록의 O(1) 캐시) ──────────────────
    currentStarId: options.startStarId,
    visitedStars: new Set<StarId>([options.startStarId]),
    exploredPlanets: new Set<PlanetId>(),
    collectedIndividuals: new Set<IndividualId>(),
    discoveredSpecies: new Map<string, number>(),

    // ── uiSlice ─────────────────────────────────────────────
    overlay: null,
    encounter: null,
    storageMode: 'persistent',
    toasts: [],

    openOverlay(overlay) {
      set({ overlay })
    },

    closeOverlay() {
      set({ overlay: null })
    },

    pushToast(message) {
      const toast = { id: nextToastId++, message }
      set({ toasts: [...get().toasts, toast] })
    },

    dismissToast(id) {
      set({ toasts: get().toasts.filter((toast) => toast.id !== id) })
    },

    // ── settingsSlice ───────────────────────────────────────
    qualityTier: 'high' satisfies QualityTier,
    qualityMode: 'auto' satisfies QualityMode,

    setQuality(tier, mode) {
      set({ qualityTier: tier, qualityMode: mode })
    },
  }))
}

export type GameStoreApi = ReturnType<typeof createGameStore>
