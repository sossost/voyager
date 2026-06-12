import type { AlienIndividual, IndividualId, PlanetId, Seed, StarId } from '@/engine'
import type { CollectionEntry } from '@/persistence/types'

/**
 * 은하 공간의 두 시점 (결정 34·41) — 항성계 씬이 은하에 통합되어 'system' kind가 사라졌다.
 * - ship: 1인칭 우주선 뷰. 현재 별 구체 + 행성이 은하 좌표에 렌더된다(= 항성계 안). 시뮬레이션 기본.
 * - perspective: 3인칭. 우주선 모델 + 우주선 중심 공전 — 항행 목적지를 고르는 항법 뷰 (구 'map').
 * 항성계 활성 여부는 별도 kind가 아니라 `view === 'ship'` + `currentStarId`로 암묵 결정된다 (결정 41-b).
 */
export type GalaxyViewMode = 'ship' | 'perspective'

/** 씬 상태머신 — 전이는 sceneSlice의 가드 액션으로만 가능하다 (02-decisions.md 결정 15·41). */
export type SceneState =
  | { readonly kind: 'galaxy'; readonly view: GalaxyViewMode }
  | { readonly kind: 'warping'; readonly from: StarId; readonly to: StarId }

export type Overlay = 'codex' | 'journal' | null

export type EncounterPhase = 'scanning' | 'reveal'

export interface EncounterState {
  readonly planetId: PlanetId
  readonly alien: AlienIndividual
  readonly alreadyCollected: boolean
  readonly isFirstOfSpecies: boolean
  readonly phase: EncounterPhase
}

export interface Toast {
  readonly id: number
  readonly message: string
}

export type StorageMode = 'persistent' | 'memory'

export type QualityTier = 'high' | 'medium' | 'low'
export type QualityMode = 'auto' | 'manual'

export interface SceneSlice {
  readonly scene: SceneState
  readonly selectedStarId: StarId | null
  readonly selectedPlanetId: PlanetId | null
  /**
   * 워프 도착 직후 한 번만 true — 우주선 뷰 진입 시 도착 확대 연출을 트리거한다 (결정 41-c 보강).
   * 뷰 토글(perspective↔ship)이 아니라 워프 도착만 표지하도록 onWarpComplete만 set, 카메라가 소비.
   */
  readonly pendingArrival: boolean
  selectStar(starId: StarId | null): void
  selectPlanet(planetId: PlanetId | null): void
  warpTo(target: StarId): void
  onWarpComplete(): void
  /** 우주선 뷰 → 퍼스펙티브 뷰 (은하 뷰에서만). 행성 선택은 해제된다. */
  openPerspective(): void
  /** 퍼스펙티브 뷰 → 우주선 뷰 (은하 뷰에서만). 별 선택은 유지된다. */
  returnToShip(): void
  /** 도착 확대 연출이 카메라에 소비됐음을 표시 — 1회성 플래그를 끈다. */
  consumeArrival(): void
}

export interface PlayerSlice {
  readonly currentStarId: StarId
  readonly visitedStars: ReadonlySet<StarId>
  readonly exploredPlanets: ReadonlySet<PlanetId>
  readonly collectedIndividuals: ReadonlySet<IndividualId>
  /** speciesId → 수집 개체 수. */
  readonly discoveredSpecies: ReadonlyMap<string, number>
  /** 수집 기록 전체 — 도감 상세(개체 목록)용 캐시. */
  readonly collectionEntries: readonly CollectionEntry[]
  /** 생명체 행성 탐사 — 조우 판정·캐시 갱신·영속화를 한 곳에서 처리한다. */
  explore(planetId: PlanetId): void
}

export interface UiSlice {
  readonly overlay: Overlay
  readonly encounter: EncounterState | null
  readonly storageMode: StorageMode
  readonly toasts: readonly Toast[]
  /** 은하 지도 여정 경로선 표시 여부 — 취향 타는 요소라 기본 off (백로그 F-2). */
  readonly isJourneyPathVisible: boolean
  /** 이미 표시된 온보딩 힌트 — 한 번 기록되면 재표시 없음 (백로그 I-1). */
  readonly seenHints: ReadonlySet<import('@/persistence/types').HintKey>
  openOverlay(overlay: Exclude<Overlay, null>): void
  closeOverlay(): void
  toggleJourneyPath(): void
  /** 스캔 연출 종료 → 카드 공개. */
  revealEncounter(): void
  closeEncounter(): void
  pushToast(message: string): void
  dismissToast(id: number): void
  /** 힌트를 "표시됨"으로 기록하고 영속화한다. */
  markHintSeen(key: import('@/persistence/types').HintKey): void
}

export interface SettingsSlice {
  readonly qualityTier: QualityTier
  readonly qualityMode: QualityMode
  setQuality(tier: QualityTier, mode: QualityMode): void
}

export interface GameStore extends SceneSlice, PlayerSlice, UiSlice, SettingsSlice {
  /** universe 상수 — 부트 후 불변. */
  readonly seed: Seed
  readonly genVersion: number
}
