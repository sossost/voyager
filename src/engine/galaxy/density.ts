import type { SectorCoords } from '../coords'
import { expNegApprox, lnApprox } from '../math/log'
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
/**
 * 로그 나선 (사실성 v2 O-10 — GEN_VERSION 11). 실제 나선팔은 피치각이 반경 무관 상수인
 * 로그 나선(위상 ∝ ln r)이다 — 구 아르키메데스(위상 ∝ r)는 안쪽이 헐렁하고 바깥이 빡빡했다.
 * 피치각 12.5°(tan ≈ 0.2217)는 은하수급 그랜드 디자인 대역(10~15°).
 * 원반(벌지 가장자리 6 → 48섹터)에서 위상이 ln8 × 9.02 ≈ 18.8 rad 감겨 시각 감김은 기존과 유사.
 */
const ARM_PITCH_TAN = 0.2217
const ARM_LOG_WINDING = ARM_COUNT / ARM_PITCH_TAN
/** 팔 사이 공간의 밀도 바닥 — 팔 밖에도 항행 가능한 별은 남는다. */
const ARM_FLOOR = 0.15

/** 중앙 벌지 반경 (섹터 단위) — 이 안은 나선팔 없이 무정형으로 빽빽하다. */
const BULGE_RADIUS_SECTORS = 6
/** 로그 나선 기준 반경 — 벌지 가장자리에서 팔 위상 0. */
const ARM_R0_SECTORS = BULGE_RADIUS_SECTORS
/**
 * 지수 원반 스케일 길이 (사실성 v2 O-10) — 실제 원반 은하의 표면 밀도는 exp(−r/Rd) 지수
 * 프로파일이다 (구 (1−r/R)² 다항은 중심/외곽 대비가 부족했다). Rd = R/3이면 가장자리에서
 * e⁻³ ≈ 5% — 하드 컷오프(GALAXY_RADIUS)와 선형 페이드로 0에 접합한다.
 */
const DISK_SCALE_LENGTH_SECTORS = GALAXY_RADIUS_SECTORS / 3
/**
 * 지수 프로파일 정규화 — 구 다항 프로파일 대비 중간 반경 밀도가 절반 이하로 떨어져 은하
 * 전체 별 수가 ~40% 감소하는 것을 보정한다 (프로파일 "형태"만 O-10의 목적, 총량은 유지).
 * clamp01이 중심부 초과를 잘라 중심 밀도 1 보장은 그대로다.
 */
const DISK_SURFACE_NORM = 1.7

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
 * +, -, *, /, Math.sqrt, Math.abs와 그것만으로 만든 유리 근사(trig.ts·log.ts)만 사용한다
 * (크로스 엔진 결정론 — 결정 14). 나선팔은 로그 나선 위상(∝ ln r, O-10)의 cos 파동으로 만들고,
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

  // 나선팔: 팔 능선에서 1, 팔 사이에서 ARM_FLOOR — 세제곱으로 능선을 좁힌다.
  // 위상은 로그 나선(∝ ln r, O-10) — 반경 1 미만은 클램프해 ln 발산을 막는다(벌지가 지배하는 구간).
  const angle = atan2Approx(sector.sz, sector.sx)
  const armPhase =
    ARM_COUNT * angle +
    ARM_LOG_WINDING * lnApprox(Math.max(radialDistance, 1) / ARM_R0_SECTORS)
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

  // 방사 감쇠는 지수 프로파일(O-10) × 가장자리 선형 페이드(하드 컷오프 접합).
  // 수직 감쇠는 제곱 — 원반이 얇게 읽히도록 평면 밖 밀도를 빠르게 줄인다.
  const radialProfile =
    DISK_SURFACE_NORM * expNegApprox(radialDistance / DISK_SCALE_LENGTH_SECTORS) * radialFalloff
  const disk = radialProfile * verticalFalloff * verticalFalloff * armFactor * clump
  const bulge = bulgeWeight * bulgeWeight * verticalFalloff

  return clamp01(disk + bulge)
}
