import type { Seed, StarId } from '../coords'
import { parseStarId } from '../coords'
import type { Star } from './sectors'
import { SECTOR_SIZE } from './density'
import { starsInSector } from './sectors'

/** StarId → 별 데이터. 존재하지 않는 인덱스면 null. */
export function starById(seed: Seed, starId: StarId): Star | null {
  const parsed = parseStarId(starId)
  if (parsed == null) return null
  return starsInSector(seed, parsed.sector)[parsed.index] ?? null
}

/** 별의 월드 좌표 = 섹터 원점 + 로컬 좌표. */
export function starWorldPosition(seed: Seed, starId: StarId): readonly [number, number, number] | null {
  const star = starById(seed, starId)
  if (star == null) return null
  return [
    star.sector.sx * SECTOR_SIZE + star.localPos[0],
    star.sector.sy * SECTOR_SIZE + star.localPos[1],
    star.sector.sz * SECTOR_SIZE + star.localPos[2],
  ]
}
