import Dexie, { type Table } from 'dexie'

import type {
  CollectionEntry,
  ExplorationRecord,
  Page,
  Profile,
  StorageDriver,
  VisitRecord,
} from '@/persistence/types'
import { SAVE_VERSION } from '@/persistence/types'

/** Dexie 스키마 v1 (02-decisions.md 결정 18) — 버전 축은 SAVE_VERSION. */
class StellarVoyageDb extends Dexie {
  profile!: Table<Profile, number>
  visits!: Table<VisitRecord, string>
  explorations!: Table<ExplorationRecord, string>
  collection!: Table<CollectionEntry, string>

  constructor() {
    super('stellar-voyage')
    this.version(SAVE_VERSION).stores({
      profile: '&id',
      visits: '&starId, visitedAt',
      explorations: '&planetId',
      collection: '&individualId, speciesId, discoveredAt',
    })
  }
}

function isConstraintError(error: unknown): boolean {
  return error instanceof Error && error.name === 'ConstraintError'
}

/**
 * IndexedDB 저장 드라이버 — MemoryDriver와 같은 계약 테스트를 통과한다 (결정 19).
 * liveQuery는 의도적으로 쓰지 않는다 — 폴백 동등성을 깨기 때문 (결정 18).
 */
export class DexieDriver implements StorageDriver {
  readonly mode = 'persistent' as const
  private readonly db = new StellarVoyageDb()

  /** 실제 open을 시도한다 — 기능 감지가 아닌 프로브 (Safari 사생활 모드 대응). */
  async probe(): Promise<void> {
    await this.db.open()
  }

  async loadProfile(): Promise<Profile | null> {
    return (await this.db.profile.get(1)) ?? null
  }

  async saveProfile(profile: Profile): Promise<void> {
    await this.db.profile.put(profile)
  }

  async addVisit(visit: VisitRecord): Promise<void> {
    await this.db.visits.put(visit) // 업서트 — 재방문은 visitedAt 갱신
  }

  async listVisits(page: Page): Promise<VisitRecord[]> {
    return this.db.visits
      .orderBy('visitedAt')
      .reverse()
      .offset(page.offset)
      .limit(page.limit)
      .toArray()
  }

  async addExploration(exploration: ExplorationRecord): Promise<void> {
    try {
      await this.db.explorations.add(exploration) // 최초 기록 우선
    } catch (error) {
      if (!isConstraintError(error)) throw error
    }
  }

  async addCollectionEntry(entry: CollectionEntry): Promise<void> {
    try {
      await this.db.collection.add(entry) // individualId PK — 중복 등록 차단
    } catch (error) {
      if (!isConstraintError(error)) throw error
    }
  }

  async loadAll(): Promise<{
    visits: VisitRecord[]
    explorations: ExplorationRecord[]
    collection: CollectionEntry[]
  }> {
    const [visits, explorations, collection] = await Promise.all([
      this.db.visits.toArray(),
      this.db.explorations.toArray(),
      this.db.collection.toArray(),
    ])
    return { visits, explorations, collection }
  }

  async reset(): Promise<void> {
    await this.db.transaction(
      'rw',
      [this.db.profile, this.db.visits, this.db.explorations, this.db.collection],
      async () => {
        await Promise.all([
          this.db.profile.clear(),
          this.db.visits.clear(),
          this.db.explorations.clear(),
          this.db.collection.clear(),
        ])
      },
    )
  }
}
