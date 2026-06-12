import type { Seed, StarId } from '../coords'
import { SOL_STAR_ID } from '../system/sol'

/**
 * 시드가 정한 시작 별 — 항상 태양계(SOL_STAR_ID).
 * Sol은 모든 시드에서 고정 위치(섹터 26,0,10)이므로 탐색 없이 직접 반환한다.
 * seed 파라미터는 미래 호환성을 위해 유지한다.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function originStar(_seed: Seed): StarId {
  return SOL_STAR_ID
}
