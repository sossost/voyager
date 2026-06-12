import type { Seed } from '../coords'
import { cyrb128 } from './cyrb128'
import { sfc32 } from './sfc32'

export interface WeightedEntry<T> {
  readonly value: T
  readonly weight: number
}

export interface Rng {
  /** [0, 1) — u32/2^32 정수 유도만 사용. */
  next(): number
  /** [0, maxExclusive) 정수. */
  int(maxExclusive: number): number
  pick<T>(items: readonly T[]): T
  weighted<T>(entries: readonly WeightedEntry<T>[]): T
}

export type RngNamespace = 'sector' | 'star' | 'planets' | 'planet' | 'alien' | 'name' | 'moon'

/** 키 조각 경계 충돌("a"+"bc" ≡ "ab"+"c") 방지용 구분자. */
const KEY_SEPARATOR = '\u001f'

/**
 * 엔티티별 독립 스트림 팩토리 — 호환성의 1차 방어선 (02-decisions.md 결정 13).
 *
 * 모든 엔티티는 자기 (namespace, key) 스트림을 소유한다. 따라서 한 엔티티의
 * draw 횟수가 늘어나도(속성 추가) 다른 엔티티의 생성물은 절대 바뀌지 않는다.
 * 같은 엔티티 안에서는 draw 순서가 곧 호환성이다 — 새 속성은 항상 끝에 추가(append-only).
 */
export function rngFor(
  seed: Seed,
  namespace: RngNamespace,
  ...key: readonly (string | number)[]
): Rng {
  const material = [seed, namespace, ...key].join(KEY_SEPARATOR)
  const [a, b, c, d] = cyrb128(material)
  return createRng(sfc32(a, b, c, d))
}

function createRng(next: () => number): Rng {
  return {
    next,

    int(maxExclusive: number): number {
      if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0) {
        throw new Error(`int: maxExclusive는 양의 정수여야 합니다: ${maxExclusive}`)
      }
      return Math.floor(next() * maxExclusive)
    },

    pick<T>(items: readonly T[]): T {
      if (items.length === 0) {
        throw new Error('pick: 빈 배열에서 선택할 수 없습니다')
      }
      return items[Math.floor(next() * items.length)] as T
    },

    weighted<T>(entries: readonly WeightedEntry<T>[]): T {
      let total = 0
      for (const entry of entries) {
        if (entry.weight < 0) {
          throw new Error(`weighted: 음수 가중치는 허용되지 않습니다: ${entry.weight}`)
        }
        total += entry.weight
      }
      if (entries.length === 0 || total <= 0) {
        throw new Error('weighted: 가중치 합이 양수인 항목이 필요합니다')
      }

      const target = next() * total
      let cumulative = 0
      for (const entry of entries) {
        cumulative += entry.weight
        if (target < cumulative) return entry.value
      }
      // 부동소수점 경계 방어 — target이 total과 같아지는 일은 없지만 안전망
      return (entries[entries.length - 1] as WeightedEntry<T>).value
    },
  }
}
