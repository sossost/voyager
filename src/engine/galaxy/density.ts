import type { SectorCoords } from '../coords'
import { valueNoise3 } from '../noise/valueNoise'

/** 섹터 한 변의 월드 단위 길이 — 렌더 좌표는 항상 '정수 섹터 + 로컬 float'. */
export const SECTOR_SIZE = 100

/** 은하 원반 반경 (섹터 단위) — 이 밖은 별이 없다. */
export const GALAXY_RADIUS_SECTORS = 48
/** 은하 원반 절반 두께 (섹터 단위). */
export const GALAXY_HALF_THICKNESS_SECTORS = 5

const CLUMP_FREQUENCY = 0.18
const CLUMP_SALT = 7
/** 덩어리 변조의 바닥값 — 팔 사이 공간에도 최소한의 별은 있다. */
const CLUMP_FLOOR = 0.3

function clamp01(value: number): number {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

/**
 * 섹터의 별 밀도 [0, 1] — 원반 감쇠 × 수직 감쇠 × 덩어리(나선팔 근사) 변조.
 *
 * +, -, *, /, Math.sqrt, Math.abs만 사용한다 (크로스 엔진 결정론 — 결정 14).
 * 나선팔은 로그 나선(atan2/log 필요) 대신 value noise 덩어리로 근사한다.
 */
export function sectorDensity(sector: SectorCoords): number {
  const radialDistance = Math.sqrt(sector.sx * sector.sx + sector.sz * sector.sz)
  const radialFalloff = clamp01(1 - radialDistance / GALAXY_RADIUS_SECTORS)
  const verticalFalloff = clamp01(1 - Math.abs(sector.sy) / GALAXY_HALF_THICKNESS_SECTORS)
  if (radialFalloff === 0 || verticalFalloff === 0) return 0

  const clump = valueNoise3(
    sector.sx * CLUMP_FREQUENCY,
    sector.sy * CLUMP_FREQUENCY,
    sector.sz * CLUMP_FREQUENCY,
    CLUMP_SALT,
  )

  return radialFalloff * radialFalloff * verticalFalloff * (CLUMP_FLOOR + (1 - CLUMP_FLOOR) * clump)
}
