import type { AlienIndividual, IndividualId, PlanetId, Seed, StarId } from '@/engine'
import type { CollectionEntry, PhenomenonDiscovery, UniqueDiscovery } from '@/persistence/types'

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

/**
 * 시뮬레이션 배속 — 궤도 운동의 시간 배율 (simulation-speed). 0=일시정지(궤도 정지, 카메라는 계속).
 * 표면 셰이더·마커 펄스 같은 앰비언트 애니메이션은 배속과 무관하게 실시간을 유지한다.
 */
export type TimeScale = 0 | 1 | 2 | 4 | 8 | 16

export interface SceneSlice {
  readonly scene: SceneState
  readonly selectedStarId: StarId | null
  /**
   * 선택한 항성계 안에서 어느 별인지 (다중성계) — 0=주성, 1+=동반성 index+1.
   * selectedStarId가 null이면 의미 없다. 단일성계는 항상 0.
   */
  readonly selectedBodyIndex: number
  readonly selectedPlanetId: PlanetId | null
  /**
   * 워프 도착 직후 한 번만 true — 우주선 뷰 진입 시 도착 확대 연출을 트리거한다 (결정 41-c 보강).
   * 뷰 토글(perspective↔ship)이 아니라 워프 도착만 표지하도록 onWarpComplete만 set, 카메라가 소비.
   */
  readonly pendingArrival: boolean
  /** bodyIndex: 다중성계에서 클릭한 별 (0=주성). 미지정 시 주성(0). */
  selectStar(starId: StarId | null, bodyIndex?: number): void
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
  /** 발견한 이색 천체 — 현상 도감 캐시 (warpTo가 도착 별이 이색이면 추가). */
  readonly discoveredPhenomena: readonly PhenomenonDiscovery[]
  /** 발견한 유니크 항성계 — 특이계 도감 캐시 (warpTo가 도착 계가 유니크면 추가). */
  readonly discoveredUniques: readonly UniqueDiscovery[]
  /** 스캔으로 드러낸 특이 천체 starId — 항법뷰 마커 소스. 현재 위치 전용 일시 상태(이동 시 비워짐, exotic-scan). */
  readonly scannedStars: ReadonlySet<StarId>
  /** 생명체 행성 탐사 — 조우 판정·캐시 갱신·영속화를 한 곳에서 처리한다. */
  explore(planetId: PlanetId): void
  /** 항법(퍼스펙티브 뷰) 능동 스캔 — 반경 내 블랙홀을 scannedStars에 기록·영속화하고 결과를 토스트한다. */
  scanSurroundings(): void
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
  /** 스캔 소나 연출 트리거 — 탐사 발동마다 증가하는 이산 이벤트 id (연속값 아님, exotic-scan). */
  readonly scanPulseToken: number
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
  /** 궤도 운동 배속 (simulation-speed) — Profile.settings로 영속화된다 (misc-ux). */
  readonly timeScale: TimeScale
  /** 행성 궤도선(링·트레일) 표시 여부 — 취향 타는 오버레이라 기본 off (misc-ux). */
  readonly isOrbitLinesVisible: boolean
  setQuality(tier: QualityTier, mode: QualityMode): void
  setTimeScale(scale: TimeScale): void
  setOrbitLinesVisible(isVisible: boolean): void
}

export interface GameStore extends SceneSlice, PlayerSlice, UiSlice, SettingsSlice {
  /** universe 상수 — 부트 후 불변. */
  readonly seed: Seed
  readonly genVersion: number
  /** 공유 우주 둘러보기 세션 — 진실이면 저장 쓰기가 비활성화된다 (백로그 L-1 게스트 모드). */
  readonly isGuestMode: boolean
}
