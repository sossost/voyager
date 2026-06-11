import type { Seed } from '@/engine'
import { parseSeed } from '@/engine'

const SEED_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // 혼동 문자(I/L/O/0/1) 제외
const GENERATED_SEED_LENGTH = 12

/** 무작위 시드 생성 — UI 엔트로피는 crypto (Math.random은 lint로 금지). */
export function generateRandomSeed(): Seed {
  const bytes = new Uint8Array(GENERATED_SEED_LENGTH)
  crypto.getRandomValues(bytes)
  const value = [...bytes].map((byte) => SEED_ALPHABET[byte % SEED_ALPHABET.length]).join('')

  const seed = parseSeed(value)
  /* v8 ignore next -- 알파벳이 시드 규칙의 부분집합이므로 도달 불가 */
  if (seed == null) throw new Error('unreachable: 생성된 시드가 규칙을 벗어남')
  return seed
}
