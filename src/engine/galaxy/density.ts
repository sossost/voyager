import type { SectorCoords } from '../coords'
import { atan2Approx, cosApprox } from '../math/trig'
import { valueNoise3 } from '../noise/valueNoise'

/** 섹터 한 변의 월드 단위 길이 — 렌더 좌표는 항상 '정수 섹터 + 로컬 float'. */
export const SECTOR_SIZE = 100

/** 은하 원반 반경 (섹터 단위) — 이 밖은 별이 없다. */
export const GALAXY_RADIUS_SECTORS = 48
/** 은하 원반 절반 두께 최대값 (섹터 단위) — 중심 벌지 기준. 섹터 순회 상한으로도 쓰인다. */
export const GALAXY_HALF_THICKNESS_SECTORS = 5
/** 원반 가장자리의 절반 두께 — 날개 끝으로 갈수록 얇아지는 렌즈형 측면 실루엣 (결정 32). */
const RIM_HALF_THICKNESS_SECTORS = 1.2

/** 나선팔 개수 — 그랜드 디자인 2팔 나선. */
const ARM_COUNT = 2
/** 아르키메데스 비틀림 — 반경 1섹터당 팔 위상이 감기는 각도(rad). 원반 전체에서 팔이 약 1.5회전 감긴다. */
const ARM_TWIST_PER_SECTOR = 0.45
/** 팔 사이 공간의 밀도 바닥 — 팔 밖에도 항행 가능한 별은 남는다. */
const ARM_FLOOR = 0.15

/** 중앙 벌지 반경 (섹터 단위) — 이 안은 나선팔 없이 무정형으로 빽빽하다. */
const BULGE_RADIUS_SECTORS = 6

const CLUMP_FREQUENCY = 0.18
const CLUMP_SALT = 7
/** 덩어리 변조의 바닥값 — 팔의 연속성을 지키는 선에서 질감만 준다 (낮으면 팔이 블롭으로 끊긴다). */
const CLUMP_FLOOR = 0.5

function clamp01(value: number): number {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

/**
 * 섹터의 별 밀도 [0, 1] — 원반 감쇠 × 수직 감쇠(렌즈형) × 나선팔 변조 × 덩어리 질감 + 중앙 벌지.
 *
 * +, -, *, /, Math.sqrt, Math.abs와 그것만으로 만든 유리 근사(trig.ts)만 사용한다
 * (크로스 엔진 결정론 — 결정 14). 나선팔은 아르키메데스 나선 위상의 cos 파동으로 만들고,
 * 중심 섹터 (0,0,0)의 밀도는 항상 1이다 (벌지 항이 지배).
 * originStar는 SOL_STAR_ID를 직접 반환하므로 이 밀도 보장에 의존하지 않는다 (G-c-10).
 * 수직 프로파일 변경은 sy=0 평면의 밀도를 절대 바꾸지 않는다 (|0|/두께 = 0).
 */
export function sectorDensity(sector: SectorCoords): number {
  const radialDistance = Math.sqrt(sector.sx * sector.sx + sector.sz * sector.sz)
  const radialFalloff = clamp01(1 - radialDistance / GALAXY_RADIUS_SECTORS)
  if (radialFalloff === 0) return 0

  // 렌즈형 수직 프로파일 (결정 32): 절반 두께가 중심에서 5섹터, 가장자리에서 1.2섹터로
  // t^1.5 테이퍼 — Math.pow 금지라 t·sqrt(t)로 표현 (결정 14 허용 연산만)
  const taper = radialFalloff * Math.sqrt(radialFalloff)
  const halfThickness =
    RIM_HALF_THICKNESS_SECTORS +
    (GALAXY_HALF_THICKNESS_SECTORS - RIM_HALF_THICKNESS_SECTORS) * taper
  const verticalFalloff = clamp01(1 - Math.abs(sector.sy) / halfThickness)
  if (verticalFalloff === 0) return 0

  // 나선팔: 팔 능선에서 1, 팔 사이에서 ARM_FLOOR — 세제곱으로 능선을 좁힌다
  const angle = atan2Approx(sector.sz, sector.sx)
  const armPhase = ARM_COUNT * angle + ARM_TWIST_PER_SECTOR * radialDistance
  const armWave = 0.5 + 0.5 * cosApprox(armPhase)
  const armRidge = armWave * armWave * armWave
  const arm = ARM_FLOOR + (1 - ARM_FLOOR) * armRidge

  // 벌지 안에서는 팔 변조를 무정형으로 풀어준다 (중심부는 팔이 아니라 구형 핵)
  const bulgeWeight = clamp01(1 - radialDistance / BULGE_RADIUS_SECTORS)
  const armFactor = arm + (1 - arm) * bulgeWeight

  const clumpNoise = valueNoise3(
    sector.sx * CLUMP_FREQUENCY,
    sector.sy * CLUMP_FREQUENCY,
    sector.sz * CLUMP_FREQUENCY,
    CLUMP_SALT,
  )
  const clump = CLUMP_FLOOR + (1 - CLUMP_FLOOR) * clumpNoise

  // 수직 감쇠는 제곱 — 원반이 얇게 읽히도록 평면 밖 밀도를 빠르게 줄인다
  const disk =
    radialFalloff * radialFalloff * verticalFalloff * verticalFalloff * armFactor * clump
  const bulge = bulgeWeight * bulgeWeight * verticalFalloff

  return clamp01(disk + bulge)
}
