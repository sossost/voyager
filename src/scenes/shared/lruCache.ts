/**
 * 단순 LRU 캐시 — 섹터 생성물처럼 "재계산은 싸지만 매 프레임은 아까운" 값 전용.
 * 용량은 반드시 최대 가시 작업셋 이상이어야 한다 (스래싱 방지 — 결정 12).
 */
export class LruCache<K, V> {
  private readonly entries = new Map<K, V>()

  constructor(private readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error(`LruCache 용량은 양의 정수여야 합니다: ${capacity}`)
    }
  }

  getOrCompute(key: K, compute: () => V): V {
    const existing = this.entries.get(key)
    if (existing !== undefined) {
      // Map의 삽입 순서를 최근 사용 순서로 활용한다
      this.entries.delete(key)
      this.entries.set(key, existing)
      return existing
    }

    const value = compute()
    this.entries.set(key, value)
    if (this.entries.size > this.capacity) {
      const oldestKey = this.entries.keys().next().value
      if (oldestKey !== undefined) this.entries.delete(oldestKey)
    }
    return value
  }

  get size(): number {
    return this.entries.size
  }
}
