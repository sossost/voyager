import type { Seed, StarId } from '../coords'
import { GALAXY_HALF_THICKNESS_SECTORS, SECTOR_SIZE } from './density'
import { starById } from './position'
import type { StarKind } from './sectors'
import { starsInSector } from './sectors'

/**
 * 함교 능동 스캔 반경 (섹터) — 정박 별을 중심으로 이 반경 구(球) 안의 희귀 천체를 드러낸다.
 * 은하 반경 48섹터 대비 국소값: 이동하며 점진적으로 발견하도록 탐험과 편의를 절충한다
 * (exotic-scan 결정 3). 순수 튜닝 상수 — 저장/생성 분포 무관.
 */
export const SCAN_RADIUS_SECTORS = 8

/**
 * 스캔 대상 = 시각적으로 찾기 어려운 **희귀** 특이 천체 (O/B 한정이라 <0.5%로 드물다).
 * 백색왜성·적색거성은 제외 — A/F/G/K에서 5~8%로 흔하고 이미 맵에서 색·크기로 구분되므로 마커가
 * 불필요하고, 전부 마킹하면 대량으로 잡혀 난잡하다 (exotic-scan 결정 7 재개정).
 */
export const RARE_EXOTIC_KINDS: readonly StarKind[] = ['black_hole', 'pulsar']

function isRareExotic(kind: StarKind): boolean {
  return RARE_EXOTIC_KINDS.includes(kind)
}

/**
 * 정박 별 기준 반경 내 희귀 특이 천체(블랙홀·펄서)들의 starId (exotic-scan 결정 9·10).
 *
 * 순수 결정론 — 같은 (seed, originStarId, radius)는 항상 같은 결과. 생성 스트림·draw 순서를
 * 건드리지 않으므로 GEN_VERSION 무관. 초월함수(sqrt) 없이 **제곱 월드거리**로 구를 판정한다
 * (engine 순수성 규칙: 초월함수 금지). 현재 별이 희귀 천체면 결과에 포함된다 — 마커 렌더 단에서
 * 현재 별을 제외한다(본체로 근접 렌더되므로).
 */
export function rareExoticBodiesNear(
  seed: Seed,
  originStarId: StarId,
  radiusSectors: number,
): readonly StarId[] {
  const origin = starById(seed, originStarId)
  if (origin == null) return []

  const originWorld: readonly [number, number, number] = [
    origin.sector.sx * SECTOR_SIZE + origin.localPos[0],
    origin.sector.sy * SECTOR_SIZE + origin.localPos[1],
    origin.sector.sz * SECTOR_SIZE + origin.localPos[2],
  ]
  const radiusWorld = radiusSectors * SECTOR_SIZE
  const radiusWorldSquared = radiusWorld * radiusWorld

  const found: StarId[] = []
  const { sx: osx, sy: osy, sz: osz } = origin.sector

  // 은하 수직 두께 밖 섹터는 밀도 0이라 순회에서 제외한다.
  const minSy = Math.max(-GALAXY_HALF_THICKNESS_SECTORS, osy - radiusSectors)
  const maxSy = Math.min(GALAXY_HALF_THICKNESS_SECTORS, osy + radiusSectors)

  for (let sx = osx - radiusSectors; sx <= osx + radiusSectors; sx++) {
    for (let sy = minSy; sy <= maxSy; sy++) {
      for (let sz = osz - radiusSectors; sz <= osz + radiusSectors; sz++) {
        for (const star of starsInSector(seed, { sx, sy, sz })) {
          if (!isRareExotic(star.kind)) continue // 블랙홀·펄서만 (흔한 왜성·거성 제외)
          const dx = sx * SECTOR_SIZE + star.localPos[0] - originWorld[0]
          const dy = sy * SECTOR_SIZE + star.localPos[1] - originWorld[1]
          const dz = sz * SECTOR_SIZE + star.localPos[2] - originWorld[2]
          if (dx * dx + dy * dy + dz * dz <= radiusWorldSquared) {
            found.push(star.id)
          }
        }
      }
    }
  }
  return found
}
