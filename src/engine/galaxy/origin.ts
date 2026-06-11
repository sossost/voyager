import type { Seed, StarId } from '../coords'
import { GALAXY_RADIUS_SECTORS } from './density'
import { starsInSector } from './sectors'

/**
 * 시드가 정한 시작 별 — 은하 중심에서 바깥으로 나선 순회하며 첫 별을 찾는다.
 * 순회 순서가 고정이므로 같은 시드는 항상 같은 시작 별을 얻는다.
 */
export function originStar(seed: Seed): StarId {
  for (let radius = 0; radius <= GALAXY_RADIUS_SECTORS; radius++) {
    for (let sx = -radius; sx <= radius; sx++) {
      for (let sz = -radius; sz <= radius; sz++) {
        const isOnRing = Math.max(Math.abs(sx), Math.abs(sz)) === radius
        if (!isOnRing) continue

        const stars = starsInSector(seed, { sx, sy: 0, sz })
        const first = stars[0]
        if (first != null) return first.id
      }
    }
  }
  /* v8 ignore next 2 -- 밀도 함수가 중심부 별을 보장하므로 도달 불가 */
  throw new Error('우주에 별이 없습니다 — 생성 파라미터 오류')
}
