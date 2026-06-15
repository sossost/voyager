import type { IndividualId, PlanetId, Rarity, Seed, StarId, StarKind } from '@/engine'

/** 저장 스키마 버전 — Dexie 마이그레이션 축. 생성 로직 버전(genVersion)과 별개다. */
export const SAVE_VERSION = 1

/** 한 번만 표시되는 온보딩 힌트 키 (백로그 I-1). */
export type HintKey = 'first-enter' | 'first-star-select' | 'first-life-planet'

/**
 * 이색 천체 발견 기록 (현상 도감, exotic-bodies 결정 7·13) — 식별자만 저장,
 * 종류명·로어·희귀도는 읽을 때 phenomena 카탈로그에서 재생성한다 (철칙 4).
 * Profile 내장 배열(옵션 b) — 별도 Dexie 테이블 없이 saveProfile에 따라온다.
 */
export interface PhenomenonDiscovery {
  readonly starId: StarId
  readonly kind: StarKind
  readonly discoveredAt: number
}

export interface Profile {
  readonly id: 1
  readonly seed: Seed
  readonly saveVersion: number
  readonly genVersion: number
  readonly currentStarId: StarId
  readonly createdAt: number
  /** 이미 표시된 힌트 목록 — 없으면 빈 배열로 취급 (기존 프로필 하위 호환). */
  readonly seenHints?: readonly HintKey[]
  /** 발견한 이색 천체 — 없으면 빈 배열로 취급 (기존 프로필 하위 호환, seenHints 선례). */
  readonly discoveredPhenomena?: readonly PhenomenonDiscovery[]
}

export interface VisitRecord {
  readonly starId: StarId
  readonly visitedAt: number
}

export interface ExplorationRecord {
  readonly planetId: PlanetId
  readonly exploredAt: number
}

export interface CollectionEntry {
  readonly individualId: IndividualId
  readonly speciesId: string
  readonly rarity: Rarity
  readonly planetId: PlanetId
  readonly discoveredAt: number
  readonly isFirstOfSpecies: boolean
}

export interface Page {
  readonly offset: number
  readonly limit: number
}

export type StorageMode = 'persistent' | 'memory'

/**
 * 저장 드라이버 계약 — Dexie/Memory 두 구현은 완전히 동등해야 한다 (결정 18·19).
 * 공유 계약 테스트(driverContract.ts)가 두 구현을 같은 케이스로 검증한다.
 *
 * 시맨틱:
 * - addVisit: starId 기준 업서트 (재방문 = visitedAt 갱신, 레코드는 별당 1개)
 * - addExploration / addCollectionEntry: 최초 기록 우선 (이미 있으면 무시 — 멱등)
 * - listVisits: visitedAt 내림차순(최근 먼저) 페이징
 */
export interface StorageDriver {
  readonly mode: StorageMode
  loadProfile(): Promise<Profile | null>
  saveProfile(profile: Profile): Promise<void>
  addVisit(visit: VisitRecord): Promise<void>
  listVisits(page: Page): Promise<VisitRecord[]>
  addExploration(exploration: ExplorationRecord): Promise<void>
  addCollectionEntry(entry: CollectionEntry): Promise<void>
  loadAll(): Promise<{
    visits: VisitRecord[]
    explorations: ExplorationRecord[]
    collection: CollectionEntry[]
  }>
  reset(): Promise<void>
}
