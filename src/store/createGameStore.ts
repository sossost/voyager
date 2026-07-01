import { create } from 'zustand'

import { PHENOMENA_BY_KIND } from '@/data/phenomena/phenomena'
import type { IndividualId, PlanetId, Seed, StarId } from '@/engine'
import {
  alienAt,
  GEN_VERSION,
  planetById,
  rareExoticBodiesNear,
  SCAN_RADIUS_SECTORS,
  starById,
} from '@/engine'
import { persist } from '@/persistence/persist'
import type {
  CollectionEntry,
  ExplorationRecord,
  HintKey,
  PhenomenonDiscovery,
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
  /** 이미 표시된 힌트 목록 — 없으면 빈 배열. */
  readonly initialSeenHints?: readonly HintKey[]
  /** 이미 발견한 이색 천체 — 없으면 빈 배열 (현상 도감 하이드레이션). */
  readonly initialDiscoveredPhenomena?: readonly PhenomenonDiscovery[]
  /**
   * 공유 우주 둘러보기 세션 (백로그 L-1 게스트 모드) — 진실이면 모든 저장 쓰기를 건너뛴다.
   * 다른 시드의 딥링크를 연 기존 플레이어가 자기 우주 기록을 잃지 않고 둘러볼 수 있게 한다.
   */
  readonly guestMode?: boolean
}

function buildSpeciesCounts(collection: readonly CollectionEntry[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const entry of collection) {
    counts.set(entry.speciesId, (counts.get(entry.speciesId) ?? 0) + 1)
  }
  return counts
}

/**
 * 게임 스토어 팩토리 — 테스트는 이 팩토리로 격리된 스토어를 만든다.
 *
 * 영속화 원칙 (02-decisions.md 결정 20): zustand/persist 미들웨어를 쓰지 않는다.
 * 진실 원천은 StorageDriver이고 스토어는 파생 캐시 — 변이 액션이 캐시 갱신과
 * persist 호출을 함께 수행하는 명시적 write-through만 허용한다.
 */
export function createGameStore(options: CreateGameStoreOptions) {
  let nextToastId = 1
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
      seenHints: [...get().seenHints],
      discoveredPhenomena: [...get().discoveredPhenomena],
    })

    const reportPersistFailure = () => {
      get().pushToast('저장에 실패했어요 — 게임은 계속 진행됩니다')
    }

    // 게스트(공유 우주 둘러보기) 세션은 디스크 쓰기를 통째로 건너뛴다 — operation을 호출하지
    // 않으므로 driver 쓰기가 발생하지 않고, 방문자의 본 우주 기록이 보존된다 (백로그 L-1).
    // 모든 변이 액션은 write-through(set() 먼저, commit() 나중)라 in-memory 세션은 그대로 동작한다.
    const isGuestMode = options.guestMode === true
    const commit: typeof persist = isGuestMode ? () => Promise.resolve() : persist

    return {
    // ── universe (부트 후 불변) ──────────────────────────────
    seed: options.seed,
    genVersion: GEN_VERSION,
    isGuestMode,

    // ── sceneSlice ──────────────────────────────────────────
    // 첫 화면은 시작 별의 우주선 뷰 — 항성계가 은하 좌표에 통합되어 별도 'system' kind가 없다 (결정 41)
    scene: { kind: 'galaxy', view: 'ship' } satisfies SceneState,
    selectedStarId: null,
    selectedBodyIndex: 0,
    selectedPlanetId: null,
    pendingArrival: false,

    selectStar(starId, bodyIndex = 0) {
      if (get().scene.kind !== 'galaxy') return // ship·perspective 양쪽에서 별 선택 가능 (결정 41-f)
      // 새 선택은 행성 선택을 닫는다 — 콜아웃은 한 번에 하나 (결정 42-f 도킹 슬롯 전제).
      // 해제(null)는 상대 선택을 건드리지 않는다 (빈 공간 탭이 행성 패널을 닫지 않게).
      if (starId != null) {
        set({ selectedStarId: starId, selectedBodyIndex: bodyIndex, selectedPlanetId: null })
        return
      }
      set({ selectedStarId: null, selectedBodyIndex: 0 })
    },

    selectPlanet(planetId) {
      const { scene } = get()
      if (scene.kind !== 'galaxy' || scene.view !== 'ship') return // 행성은 우주선 뷰에서만 보인다
      if (planetId != null) {
        set({ selectedPlanetId: planetId, selectedStarId: null })
        return
      }
      set({ selectedPlanetId: null })
    },

    warpTo(target) {
      const { scene, currentStarId, visitedStars, discoveredPhenomena, seed } = get()
      if (scene.kind !== 'galaxy') return
      if (target === currentStarId) return

      // 저장 커밋은 연출 전에 — 워프 연출이 중단되어도 데이터는 안전 (결정 16)
      const visitedAt = now()
      const nextVisited = new Set(visitedStars)
      nextVisited.add(target)

      // 이색 천체면 현상 도감에 발견 기록 — addVisit과 같은 persist 트랜잭션 (결정 7·8).
      // 식별자만 저장하고 종류명·로어는 읽을 때 재생성한다 (철칙 4).
      const targetStar = starById(seed, target)
      const exoticKind =
        targetStar != null && targetStar.kind !== 'main_sequence' ? targetStar.kind : null
      const alreadyDiscovered = discoveredPhenomena.some((d) => d.starId === target)
      const isNewDiscovery = exoticKind != null && !alreadyDiscovered
      const isFirstOfKind = isNewDiscovery && !discoveredPhenomena.some((d) => d.kind === exoticKind)
      const nextPhenomena = isNewDiscovery
        ? [...discoveredPhenomena, { starId: target, kind: exoticKind, discoveredAt: visitedAt }]
        : discoveredPhenomena

      set({
        scene: { kind: 'warping', from: currentStarId, to: target },
        selectedStarId: null,
        currentStarId: target,
        visitedStars: nextVisited,
        discoveredPhenomena: nextPhenomena,
        // 이동하면 이전 위치의 스캔 마커를 비운다 — 마커는 현재 위치 전용 (맵 난잡 방지).
        scannedStars: new Set<StarId>(),
      })

      // 해당 종류 최초 발견 — 축하 토스트
      if (isFirstOfKind && exoticKind != null) {
        const label = PHENOMENA_BY_KIND.get(exoticKind)?.label ?? '이색 천체'
        get().pushToast(`✨ 최초 발견 — ${label}`)
      }

      // write-through: 캐시 갱신과 영속화를 같은 액션에서 (결정 20).
      // buildProfile()이 위 set()의 discoveredPhenomena를 포함하므로 saveProfile에 따라온다 (옵션 b).
      void commit(async () => {
        await driver.addVisit({ starId: target, visitedAt })
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
    discoveredPhenomena: [...(options.initialDiscoveredPhenomena ?? [])],

    explore(planetId) {
      const state = get()
      if (state.scene.kind !== 'galaxy' || state.scene.view !== 'ship') return // 행성은 우주선 뷰에서만
      if (state.encounter != null) return

      const planet = planetById(state.seed, planetId)
      if (planet == null || !planet.hasLife) return
      if (planet.starId !== state.currentStarId) return // 현재 항성계의 행성만 탐사 가능

      // 인류의 고향(지구) — hasLife이지만 외계 생명체 없음 (G-c-10)
      if (planet.isHomeWorld === true) {
        const nextExplored = new Set(state.exploredPlanets)
        nextExplored.add(planetId)
        set({ exploredPlanets: nextExplored })
        get().pushToast('인류의 고향 — 외계 생명체는 발견되지 않았습니다')
        void commit(async () => {
          await driver.addExploration({ planetId, exploredAt: now() })
        }, reportPersistFailure)
        return
      }

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
      void commit(async () => {
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
    seenHints: new Set<HintKey>(options.initialSeenHints ?? []),
    // 스캔 마커는 일시적 — 현재 위치의 탐사 결과만 보이고 이동(워프)하면 비워진다 (맵 난잡 방지).
    scannedStars: new Set<StarId>(),
    scanPulseToken: 0,

    openOverlay(overlay) {
      set({ overlay })
    },

    closeOverlay() {
      set({ overlay: null })
    },

    toggleJourneyPath() {
      set({ isJourneyPathVisible: !get().isJourneyPathVisible })
    },

    scanSurroundings() {
      const { scene, seed, currentStarId, scannedStars, scanPulseToken } = get()
      // 항법(퍼스펙티브 뷰)에서만 발동 — 마커가 뜨는 뷰와 같다. 버튼도 항법에만 있지만 방어적 가드 (결정 4)
      if (scene.kind !== 'galaxy' || scene.view !== 'perspective') return

      // 소나 파동은 탐사 발동 즉시 재생 — 결과와 무관 (연속값 아닌 이산 이벤트 토큰, 결정 14).
      const nextPulseToken = scanPulseToken + 1

      const found = rareExoticBodiesNear(seed, currentStarId, SCAN_RADIUS_SECTORS)
      const newlyFound = found.filter((id) => !scannedStars.has(id))

      if (newlyFound.length === 0) {
        set({ scanPulseToken: nextPulseToken })
        get().pushToast('이 주변엔 특이 천체가 없습니다')
        return
      }

      set({
        scannedStars: new Set<StarId>([...scannedStars, ...newlyFound]),
        scanPulseToken: nextPulseToken,
      })
      get().pushToast(`특이 천체 ${newlyFound.length}개 감지`)
      // 저장하지 않는다 — 마커는 현재 위치 전용 일시 상태다 (이동 시 warpTo가 비운다).
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

    markHintSeen(key) {
      const { seenHints } = get()
      if (seenHints.has(key)) return
      const nextSeen = new Set(seenHints)
      nextSeen.add(key)
      set({ seenHints: nextSeen })
      void commit(async () => {
        await driver.saveProfile(buildProfile())
      }, reportPersistFailure)
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
