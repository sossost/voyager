import { create } from 'zustand'

import type { IndividualId, PlanetId, Seed, StarId } from '@/engine'
import { alienAt, GEN_VERSION, planetById } from '@/engine'
import { persist } from '@/persistence/persist'
import type {
  CollectionEntry,
  ExplorationRecord,
  Profile,
  StorageDriver,
  VisitRecord,
} from '@/persistence/types'
import { SAVE_VERSION } from '@/persistence/types'
import type { GameStore, QualityMode, QualityTier, SceneState } from '@/store/types'

/** 부트 시 driver.loadAll()이 돌려준 영속 기록 — 스토어의 O(1) 캐시로 변환된다. */
export interface HydrationRecords {
  readonly visits: readonly VisitRecord[]
  readonly explorations: readonly ExplorationRecord[]
  readonly collection: readonly CollectionEntry[]
}

export interface CreateGameStoreOptions {
  readonly seed: Seed
  readonly startStarId: StarId
  readonly driver: StorageDriver
  readonly hydration?: HydrationRecords
  /** detect-gpu가 판정한 초기 품질 티어 (기본 high). */
  readonly initialQualityTier?: QualityTier
  /** 테스트에서 시각을 고정할 수 있도록 주입 가능. */
  readonly now?: () => number
  readonly createdAt?: number
}

function buildSpeciesCounts(collection: readonly CollectionEntry[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const entry of collection) {
    counts.set(entry.speciesId, (counts.get(entry.speciesId) ?? 0) + 1)
  }
  return counts
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
  const { driver } = options
  const now = options.now ?? Date.now
  const createdAt = options.createdAt ?? now()
  const hydration = options.hydration ?? { visits: [], explorations: [], collection: [] }

  // visitedAt 오름차순으로 Set을 구성한다 — Set 순회 순서가 곧 여정 타임라인이 되어
  // JourneyPath(백로그 F-2)가 별도 기록 없이 시간순 폴리라인을 그릴 수 있다.
  // (드라이버 loadAll의 정렬은 구현마다 다르므로 여기서 보장한다)
  const chronologicalVisits = [...hydration.visits].sort((a, b) => a.visitedAt - b.visitedAt)
  const initialVisited = new Set<StarId>(chronologicalVisits.map((visit) => visit.starId))
  initialVisited.add(options.startStarId)

  return create<GameStore>()((set, get) => {
    const buildProfile = (): Profile => ({
      id: 1,
      seed: get().seed,
      saveVersion: SAVE_VERSION,
      genVersion: get().genVersion,
      currentStarId: get().currentStarId,
      createdAt,
    })

    const reportPersistFailure = () => {
      get().pushToast('저장에 실패했어요 — 게임은 계속 진행됩니다')
    }

    return {
    // ── universe (부트 후 불변) ──────────────────────────────
    seed: options.seed,
    genVersion: GEN_VERSION,

    // ── sceneSlice ──────────────────────────────────────────
    // 첫 화면은 시작 별의 우주선 뷰 — 항성계가 은하 좌표에 통합되어 별도 'system' kind가 없다 (결정 41)
    scene: { kind: 'galaxy', view: 'ship' } satisfies SceneState,
    selectedStarId: null,
    selectedPlanetId: null,
    pendingArrival: false,

    selectStar(starId) {
      if (get().scene.kind !== 'galaxy') return // ship·perspective 양쪽에서 별 선택 가능 (결정 41-f)
      set({ selectedStarId: starId })
    },

    selectPlanet(planetId) {
      const { scene } = get()
      if (scene.kind !== 'galaxy' || scene.view !== 'ship') return // 행성은 우주선 뷰에서만 보인다
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

      // write-through: 캐시 갱신과 영속화를 같은 액션에서 (결정 20)
      void persist(async () => {
        await driver.addVisit({ starId: target, visitedAt: now() })
        await driver.saveProfile(buildProfile())
      }, reportPersistFailure)
    },

    onWarpComplete() {
      const { scene } = get()
      if (scene.kind !== 'warping') return
      // 도착 = 새 별의 우주선 뷰 (항성계가 우주선 뷰에 통합됨, 결정 41-b).
      // pendingArrival로 우주선 카메라의 도착 확대 연출을 1회 트리거한다.
      set({ scene: { kind: 'galaxy', view: 'ship' }, pendingArrival: true })
    },

    openPerspective() {
      if (get().scene.kind !== 'galaxy') return
      // 퍼스펙티브 뷰는 행성을 클릭하지 않으므로 행성 선택을 해제한다
      set({ scene: { kind: 'galaxy', view: 'perspective' }, selectedPlanetId: null })
    },

    returnToShip() {
      if (get().scene.kind !== 'galaxy') return
      // 별 선택은 유지 — 우주선 뷰에서도 StarInfoPanel·항행이 동작한다
      set({ scene: { kind: 'galaxy', view: 'ship' } })
    },

    consumeArrival() {
      if (!get().pendingArrival) return
      set({ pendingArrival: false })
    },

    // ── playerSlice (영속 기록의 O(1) 캐시) ──────────────────
    currentStarId: options.startStarId,
    visitedStars: initialVisited,
    exploredPlanets: new Set<PlanetId>(hydration.explorations.map((record) => record.planetId)),
    collectedIndividuals: new Set<IndividualId>(
      hydration.collection.map((entry) => entry.individualId),
    ),
    discoveredSpecies: buildSpeciesCounts(hydration.collection),
    collectionEntries: [...hydration.collection],

    explore(planetId) {
      const state = get()
      if (state.scene.kind !== 'galaxy' || state.scene.view !== 'ship') return // 행성은 우주선 뷰에서만
      if (state.encounter != null) return

      const planet = planetById(state.seed, planetId)
      if (planet == null || !planet.hasLife) return
      if (planet.starId !== state.currentStarId) return // 현재 항성계의 행성만 탐사 가능

      // 결정론: 같은 행성 = 항상 같은 개체 (재방문 = 재조우)
      const alien = alienAt(state.seed, planetId)
      const alreadyCollected = state.collectedIndividuals.has(alien.individualId)
      const isFirstOfSpecies = !state.discoveredSpecies.has(alien.speciesId)

      const nextExplored = new Set(state.exploredPlanets)
      nextExplored.add(planetId)

      if (alreadyCollected) {
        set({
          encounter: { planetId, alien, alreadyCollected, isFirstOfSpecies: false, phase: 'scanning' },
          exploredPlanets: nextExplored,
        })
        return // 중복 등록 없음 — 캐시·영속 모두 변화 없음
      }

      const nextCollected = new Set(state.collectedIndividuals)
      nextCollected.add(alien.individualId)
      const nextSpecies = new Map(state.discoveredSpecies)
      nextSpecies.set(alien.speciesId, (nextSpecies.get(alien.speciesId) ?? 0) + 1)

      const discoveredAt = now()
      const entry: CollectionEntry = {
        individualId: alien.individualId,
        speciesId: alien.speciesId,
        rarity: alien.rarity,
        planetId,
        discoveredAt,
        isFirstOfSpecies,
      }

      set({
        encounter: { planetId, alien, alreadyCollected: false, isFirstOfSpecies, phase: 'scanning' },
        exploredPlanets: nextExplored,
        collectedIndividuals: nextCollected,
        discoveredSpecies: nextSpecies,
        collectionEntries: [...state.collectionEntries, entry],
      })

      // write-through — 연출이 끝나기 전에 커밋 (스캔 중 이탈해도 수집은 안전)
      void persist(async () => {
        await driver.addExploration({ planetId, exploredAt: discoveredAt })
        await driver.addCollectionEntry(entry)
      }, reportPersistFailure)
    },

    // ── uiSlice ─────────────────────────────────────────────
    overlay: null,
    encounter: null,
    storageMode: driver.mode,
    toasts: [],
    isJourneyPathVisible: false,

    openOverlay(overlay) {
      set({ overlay })
    },

    closeOverlay() {
      set({ overlay: null })
    },

    toggleJourneyPath() {
      set({ isJourneyPathVisible: !get().isJourneyPathVisible })
    },

    revealEncounter() {
      const { encounter } = get()
      if (encounter == null || encounter.phase !== 'scanning') return
      set({ encounter: { ...encounter, phase: 'reveal' } })
    },

    closeEncounter() {
      set({ encounter: null })
    },

    pushToast(message) {
      const toast = { id: nextToastId++, message }
      set({ toasts: [...get().toasts, toast] })
    },

    dismissToast(id) {
      set({ toasts: get().toasts.filter((toast) => toast.id !== id) })
    },

    // ── settingsSlice ───────────────────────────────────────
    qualityTier: options.initialQualityTier ?? ('high' satisfies QualityTier),
    qualityMode: 'auto' satisfies QualityMode,

    setQuality(tier, mode) {
      set({ qualityTier: tier, qualityMode: mode })
    },
    }
  })
}

export type GameStoreApi = ReturnType<typeof createGameStore>
