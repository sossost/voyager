import type { AlienIndividual, IndividualId, PlanetId, Seed, StarId } from '@/engine'
import type { CollectionEntry } from '@/persistence/types'

/** 씬 상태머신 — 전이는 sceneSlice의 가드 액션으로만 가능하다 (02-decisions.md 결정 15). */
export type SceneState =
  | { readonly kind: 'galaxy' }
  | { readonly kind: 'warping'; readonly from: StarId; readonly to: StarId }
  | { readonly kind: 'system'; readonly starId: StarId }

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
  selectStar(starId: StarId | null): void
  selectPlanet(planetId: PlanetId | null): void
  warpTo(target: StarId): void
  onWarpComplete(): void
  enterCurrentSystem(): void
  backToGalaxy(): void
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
  openOverlay(overlay: Exclude<Overlay, null>): void
  closeOverlay(): void
  toggleJourneyPath(): void
  /** 스캔 연출 종료 → 카드 공개. */
  revealEncounter(): void
  closeEncounter(): void
  pushToast(message: string): void
  dismissToast(id: number): void
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
