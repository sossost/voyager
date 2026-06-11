import type { IndividualId, PlanetId, StarId } from '@/engine'
import type {
  CollectionEntry,
  ExplorationRecord,
  Page,
  Profile,
  StorageDriver,
  VisitRecord,
} from '@/persistence/types'

/**
 * IndexedDB를 쓸 수 없는 환경의 폴백 — DexieDriver와 완전 동등한 계약을 이행한다.
 * 세션이 끝나면 모든 기록이 사라진다 (storageMode='memory' 경고 배너가 안내).
 */
export class MemoryDriver implements StorageDriver {
  readonly mode = 'memory' as const

  private profile: Profile | null = null
  private readonly visits = new Map<StarId, VisitRecord>()
  private readonly explorations = new Map<PlanetId, ExplorationRecord>()
  private readonly collection = new Map<IndividualId, CollectionEntry>()

  loadProfile(): Promise<Profile | null> {
    return Promise.resolve(this.profile)
  }

  saveProfile(profile: Profile): Promise<void> {
    this.profile = profile
    return Promise.resolve()
  }

  addVisit(visit: VisitRecord): Promise<void> {
    this.visits.set(visit.starId, visit)
    return Promise.resolve()
  }

  listVisits(page: Page): Promise<VisitRecord[]> {
    const sorted = [...this.visits.values()].sort((a, b) => b.visitedAt - a.visitedAt)
    return Promise.resolve(sorted.slice(page.offset, page.offset + page.limit))
  }

  addExploration(exploration: ExplorationRecord): Promise<void> {
    if (!this.explorations.has(exploration.planetId)) {
      this.explorations.set(exploration.planetId, exploration)
    }
    return Promise.resolve()
  }

  addCollectionEntry(entry: CollectionEntry): Promise<void> {
    if (!this.collection.has(entry.individualId)) {
      this.collection.set(entry.individualId, entry)
    }
    return Promise.resolve()
  }

  loadAll(): Promise<{
    visits: VisitRecord[]
    explorations: ExplorationRecord[]
    collection: CollectionEntry[]
  }> {
    return Promise.resolve({
      visits: [...this.visits.values()],
      explorations: [...this.explorations.values()],
      collection: [...this.collection.values()],
    })
  }

  reset(): Promise<void> {
    this.profile = null
    this.visits.clear()
    this.explorations.clear()
    this.collection.clear()
    return Promise.resolve()
  }
}
