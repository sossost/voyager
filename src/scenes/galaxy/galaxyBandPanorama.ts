import {
  GALAXY_HALF_THICKNESS_SECTORS,
  GALAXY_RADIUS_SECTORS,
  SECTOR_SIZE,
  sectorDensity,
} from '@/engine'
import { valueNoise3 } from '@/engine/noise/valueNoise'

import {
  NEBULA_ROSE_RGB,
  NEBULA_TEAL_RGB,
  NEBULA_TINT_MAX_BLEND,
  nebulaTintAt,
  nebulaTintShift,
} from '@/scenes/galaxy/galaxyNebulae'

/**
 * 은하 밴드 파노라마 베이크 (결정 38 고도화) — 정박 위치에서 본 은하 원반의
 * (방위각 × 고도) 광량을 3D 광선 적분으로 굽는다.
 *
 * 원반면 1줄 적분 + 합성 가우시안 프로파일(초기 구현)과 달리, 고도별 광선이
 * 실제 3D 밀도(렌즈형 수직 테이퍼·벌지·클럼프 노이즈)를 통과하므로:
 * - 벌지가 띠 위로 실제 타원 돔으로 부풀어 오르고
 * - 띠 두께가 방향마다 달라지며 (중심 쪽 두껍고 외곽 쪽 얇음)
 * - 클럼프 얼룩이 고도에 따라 자연스럽게 번진다.
 *
 * 파이프라인은 두 단계로 분리된다:
 * 1) 광선 적분 (비싸다, 프레임 분산) — 원시 적분·난색도 그리드만 채운다.
 * 2) 톤매핑 합성 (싸다, 동기) — 자동 노출 정규화 + 색·균열·패치 + 블러/헤일로.
 *
 * 비용(광선 ~3.7만)이 커서 저해상 프리뷰(동기 ~20ms, 즉시 표시) → 프레임당
 * 시간 예산으로 고해상 정련 → 완료 시 스왑한다 (행성 텍스처의 프레임 분산
 * 베이크와 같은 철학, 결정 33). 전부 결정론 — 같은 정박 위치는 항상 같은 하늘.
 */

/** 밴드 실린더 반경 — 정박 별에서 가장 먼 은하 별(≤9,600)보다 바깥, 장식 별밭(12,000) 안. */
export const BAND_RADIUS = 10_500
/**
 * 밴드 절반 높이 (월드) — 반경 대비 약 ±14°. 외곽 정박에서 벌지 돔(수직 5섹터
 * ≈ 거리 29섹터 기준 ±10°)이 페이드 여유를 갖고 들어가는 높이.
 */
export const BAND_HALF_HEIGHT = 2_600

/** 최종 텍스처 크기 — 베이스를 블러 업스케일한 결과 (GalaxyNebula와 같은 합성 패턴).
    별 스플랫(쌀알 입자)은 사용자 기각으로 제거됐다 — 질감은 클럼프 변조(clumpModAt)가 담당. */
const FINAL_WIDTH = 768
const FINAL_HEIGHT = 192

/** 고해상 베이스 격자 — 열(방위각) × 행(고도). */
const BASE_COLUMNS = 384
const BASE_ROWS = 96
/** 저해상 프리뷰 격자 — 마운트 프레임에 동기로 구울 수 있는 크기. */
const PREVIEW_COLUMNS = 128
const PREVIEW_ROWS = 32
const PREVIEW_STEP_SECTORS = 1.5

/** 업스케일 블러(px, 최종 해상도 기준) — 격자를 연속 발광 면으로. 프리뷰는 더 강하게.
    코어 근처 정박은 좁은 방위각이 화면을 가득 채워 격자 블록이 드러난다 — 넉넉하게. */
const SHARP_BLUR_PX = 4
const PREVIEW_SHARP_BLUR_PX = 8
/** 산란 헤일로 — 밝은 영역 주변에 베이크해 넣는 블룸. 과하면 "빛나는 광원"으로 읽혀 감쇠. */
const HALO_BLUR_PX = 14
const HALO_ALPHA = 0.2

/** 적분 보폭 (섹터) — 클럼프 노이즈 파장(~5.5섹터)보다 충분히 촘촘하다. */
const RAY_STEP_SECTORS = 0.75
/** 적분 사거리 — 은하 지름이면 어느 정박 위치에서든 원반 반대편 끝까지 닿는다. */
const RAY_MAX_SECTORS = GALAXY_RADIUS_SECTORS * 2
/** 수직 탈출 한계 — 이 밖은 밀도 0이라 적분을 조기 종료한다 (고고도 광선 비용 절감). */
const VERTICAL_EXIT_SECTORS = GALAXY_HALF_THICKNESS_SECTORS + 0.1

/**
 * 자동 노출 — 파노라마마다 자기 최대 적분값으로 정규화한다. 적분 스케일은 정박에
 * 따라 변하므로, 고정 기준으로는 어떤 정박에서는 띠가 묻히고 어떤 정박에서는
 * 포화된다. 바닥값은 최대가 작은 하늘에서 노이즈·잔광을 만점까지 끌어올리지 않는
 * 하한 — 소광 적분(O-20) 도입으로 원시 적분값이 전반적으로 낮아져(투과 손실)
 * 구 12는 전 정박에서 띠를 묻어버렸다. 장노출 사진의 문법대로 노출을 올려
 * "밝은 띠 + 검은 대균열" 대비로 재캘리브레이션 (galaxy-realism-pass).
 */
const MIN_EXPOSURE_INTEGRAL = 3
/**
 * 실린더 상·하단 가장자리 페이드 시작점 (|v| 기준) — 벌지 내부 정박(시작 별)에서는
 * 전 고도가 밝아 텍스처 끝이 하드 엣지로 보인다. 외곽 정박의 벌지 돔(|v|≈0.71)은
 * 건드리지 않는 위치에서 시작한다.
 */
const EDGE_FADE_START = 0.75

/**
 * 벌지(난색) ↔ 나선팔(한색) — GalaxyNebula(결정 23)와 같은 색 언어.
 * 팔 색은 청백색 (galaxy-realism-pass) — 구 [110,140,235]는 실사진에 없는 채도 파랑.
 * 실제 은하수 띠는 따뜻한 백색~황금 + 갈색 먼지이고, 파랑 기운은 미미하다.
 */
const BULGE_RGB = [255, 208, 150] as const
const ARM_RGB = [185, 200, 232] as const
const COLOR_BLEND_RADIUS_SECTORS = 10
/** 밀도 가중 평균 난색도 증폭 — 벌지 방향만 난색으로, 띠 전체가 베이지가 되면 과한 것. */
const WARMTH_GAIN = 1.6

/**
 * 성간 먼지 소광 (O-20, galaxy-realism-pass) — 광선 적분에 Beer–Lambert exp(−τ)를 넣어
 * 원거리 광이 앞의 먼지에 흡수된다. 실제 은하수 사진의 대균열·패치형 먼지 구름이
 * 별도 코스메틱 감산 없이 **구조적으로** 발생한다 (구 RIFT_* 상수 대체).
 *
 * 먼지 밀도 = 별 밀도 × 얇은 수직 집중 — 실제 먼지 원반 스케일 하이트는 항성 원반의
 * ~절반 이하 (은하수: 먼지 ~100pc vs 항성 박원반 ~300pc, Li & Draine 2001 계열).
 * 원반면을 따라 보는 광선만 τ가 크게 쌓여 대균열이 되고, 조금만 고도가 올라가면
 * 투과되어 띠의 상하부는 밝게 남는다.
 */
const DUST_HALF_THICKNESS_SECTORS = 0.9
/**
 * 먼지 불투명도 계수 (τ / 밀도·섹터) — 원반면 관통 광선의 τ ~1.5-2 수준.
 * 0.14는 중간 반경 정박에서 벌지 방향 광까지 삼켜 하늘이 통째로 죽었다 (실측 기각)
 * — 대균열은 원반면 ±1섹터 띠에서만 또렷하고 그 위 벌지 돔은 살아야 사진처럼 읽힌다.
 */
const DUST_KAPPA = 0.08

/** 방위각 패치 변조 — 실구조(클럼프 적분)가 있으므로 약하게만 보탠다. */
const PATCH_BASE = 0.92
const PATCH_SPAN = 0.16

/**
 * 2D 불규칙 클럼프 변조 (galaxy-realism-pass) — 매끈한 글로우가 "원형/균일 광원"으로
 * 읽히지 않게 (방위각 × 고도) 양방향 노이즈로 얼룩을 낸다. 방위각은 cos/sin 임베딩으로
 * 랩 이음매가 없다. 저주파(구름 덩어리) + 고주파(잔얼룩) 2옥타브.
 */
const CLUMP_MOD_DEPTH = 0.38
const CLUMP_MOD_SALT = 23

function clumpModAt(theta: number, verticalRatio: number): number {
  const cx = Math.cos(theta)
  const sz = Math.sin(theta)
  const low = valueNoise3(cx * 1.7, verticalRatio * 2.1, sz * 1.7, CLUMP_MOD_SALT)
  const high = valueNoise3(cx * 5.3, verticalRatio * 6.4, sz * 5.3, CLUMP_MOD_SALT + 1)
  const noise = low * 0.65 + high * 0.35
  return 1 - CLUMP_MOD_DEPTH + CLUMP_MOD_DEPTH * 2 * noise
}

/**
 * 근거리 광 분리 — 정박을 둘러싼 두꺼운 원반의 빛은 물리대로면 전 고도에 깔려
 * "사방 워시"가 된다 (원반 두께/반경 비가 실은하의 5배라 하늘이 푸석해진다).
 * 게임 미학 우선 원칙(결정 28): 이 구간(근거리)에서 출발한 광만 원반면 띠
 * 프라이어로 모으고, 원거리 광(벌지 돔·림 밴드 — 실구조)은 그대로 둔다.
 * 벌지 내부·면 밖·중간 반경 정박을 하나의 메커니즘으로 처리한다.
 */
/**
 * 경계 8~16은 중간 반경 정박에서 벌지 절반이 "원거리"로 새서 실린더 세로를
 * 통째로 채웠다(굵은 띠, 실측 기각) — 12~24면 그 벌지광이 띠로 모이고,
 * 림 정박의 벌지 돔(20섹터 밖)은 여전히 원거리 실구조로 남는다.
 */
const LOCAL_LIGHT_NEAR_SECTORS = 12
const LOCAL_LIGHT_FAR_SECTORS = 24
/**
 * 근거리 광을 모으는 원반면 띠 프라이어 (월드 σ / 고고도 잔광 바닥).
 * σ가 좁으면 코어 근처 정박에서 넓은 워시 위에 "형광등 줄"이 뜬다(실측 기각 — σ 650)
 * — 완만한 경사로 모아야 워시와 띠가 한 몸으로 읽힌다.
 */
const BAND_PRIOR_SIGMA_WORLD = 1_000
const BAND_PRIOR_FLOOR = 0.18

/**
 * 하이라이트 숄더 — 어깨 시작점까지는 선형, 그 위만 1-exp로 부드럽게 누른다.
 * 전구간 니(1-exp 전체)는 중간 광량까지 들어 올려 면 밖 워시가 뜨고 띠가
 * 뚱뚱해진다(실측 기각) — 선형 토우가 띠를 얇게, 어깨가 형광등 평탄화를 막는다.
 */
const SHOULDER_START = 0.7

/**
 * 성운 틴트 샘플 보폭 — 색조 노이즈는 파장이 길어(~11섹터) 3샘플에 1회로 충분하다.
 * 노이즈 호출이 적분의 지배 비용이라 보폭이 정련 시간을 직접 줄인다.
 */
const TINT_SAMPLE_STRIDE = 3
/** 발광 가스 패치의 밝기 보정 — 색만 바뀌면 죽은 얼룩, 살짝 밝아야 "빛나는 가스". */
const TINT_BRIGHTNESS_LIFT = 0.35

function clamp01(value: number): number {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

/** 숄더 톤 커브 — 접합점에서 기울기 1로 매끄럽게 이어지고 상한 ~0.89로 수렴한다. */
function toneCurve(value: number): number {
  if (value <= SHOULDER_START) return value
  const over = (value - SHOULDER_START) / (1 - SHOULDER_START)
  return SHOULDER_START + (1 - SHOULDER_START) * (1 - Math.exp(-over))
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp01((value - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

/**
 * 방위각 패치 노이즈 [0, 1] — 정수 주파수 sin 합이라 θ 한 바퀴에서 이음매가 없다.
 * phase로 서로 다른 패턴(밝기 패치 vs 암흑대 끊김)을 뽑는다.
 */
function azimuthNoise(theta: number, phase: number): number {
  const wave =
    Math.sin(theta * 3 + 1.7 + phase) +
    0.5 * Math.sin(theta * 7 + 0.4 + phase * 2) +
    0.25 * Math.sin(theta * 13 + 3.1 + phase * 3)
  return 0.5 + wave / 3.5
}

/** 광선 적분 결과의 원시 그리드 — 톤매핑 전 단계 (행 우선, rows × columns). */
interface RayGrid {
  readonly columns: number
  readonly rows: number
  /** 방향별 밀도 선적분값 (섹터 단위 가중). */
  readonly integrals: Float32Array
  /** 적분 중 근거리(LOCAL_LIGHT_*) 구간의 기여분 — 띠 프라이어 적용 대상. */
  readonly localIntegrals: Float32Array
  /** 밀도 가중 벌지 근접도 [0, 1] — 색 보간용. */
  readonly warmths: Float32Array
  /** 밀도 가중 성운 색조 비율 [0, 1] — 광선이 지나온 가스의 평균 색조. */
  readonly tintRose: Float32Array
  readonly tintTeal: Float32Array
}

function createRayGrid(columns: number, rows: number): RayGrid {
  return {
    columns,
    rows,
    integrals: new Float32Array(columns * rows),
    localIntegrals: new Float32Array(columns * rows),
    warmths: new Float32Array(columns * rows),
    tintRose: new Float32Array(columns * rows),
    tintTeal: new Float32Array(columns * rows),
  }
}

/** 격자의 열 구간 [columnStart, columnEnd)에 원시 광선 적분을 채운다. */
function bakeColumns(
  grid: RayGrid,
  anchor: readonly [number, number, number],
  stepSectors: number,
  columnStart: number,
  columnEnd: number,
): void {
  if (grid.rows < 2) throw new Error('밴드 격자는 최소 2행이어야 합니다 (행 보간 분모)')

  const originSx = anchor[0] / SECTOR_SIZE
  const originSy = anchor[1] / SECTOR_SIZE
  const originSz = anchor[2] / SECTOR_SIZE

  for (let column = columnStart; column < columnEnd; column++) {
    // three.js CylinderGeometry UV 규약: u = θ/2π, 측면 정점 = (r·sinθ, y, r·cosθ)
    const theta = (column / grid.columns) * Math.PI * 2
    const wallX = Math.sin(theta) * BAND_RADIUS
    const wallZ = Math.cos(theta) * BAND_RADIUS

    for (let row = 0; row < grid.rows; row++) {
      // 캔버스 첫 행 = 텍스처 v=1 = 실린더 꼭대기 (flipY) — 위가 +y
      const yWorld = (1 - (row / (grid.rows - 1)) * 2) * BAND_HALF_HEIGHT
      const wallY = yWorld - anchor[1]
      const length = Math.sqrt(wallX * wallX + wallY * wallY + wallZ * wallZ)
      const directionX = wallX / length
      const directionY = wallY / length
      const directionZ = wallZ / length

      // 수직 탈출 — 원반 두께 밖은 밀도 0이므로 그 전까지만 적분 (고고도 광선 조기 종료)
      let rayEnd = RAY_MAX_SECTORS
      if (directionY > 1e-6) {
        rayEnd = Math.min(rayEnd, (VERTICAL_EXIT_SECTORS - originSy) / directionY)
      } else if (directionY < -1e-6) {
        rayEnd = Math.min(rayEnd, (-VERTICAL_EXIT_SECTORS - originSy) / directionY)
      }

      // 표면 밝기는 거리와 무관 — 거리 가중 없는 선적분에 먼지 소광 exp(−τ)만 곱한다 (O-20).
      let integral = 0
      let localIntegral = 0
      let warmthIntegral = 0
      let tintRose = 0
      let tintTeal = 0
      let tintWeight = 0
      let sampleIndex = 0
      let opticalDepth = 0
      for (let distance = stepSectors * 0.5; distance <= rayEnd; distance += stepSectors) {
        const sx = originSx + directionX * distance
        const sy = originSy + directionY * distance
        const sz = originSz + directionZ * distance
        const density = sectorDensity({ sx, sy, sz })
        if (density === 0) continue

        // 이 지점에서 출발한 빛이 관측자까지 오며 겪는 소광 — 앞 구간의 누적 τ.
        // 먼지는 원반면에 얇게 집중 — 별 밀도에 가우시안 수직 프로파일을 곱한다.
        const transmission = Math.exp(-opticalDepth)
        const dustVertical = Math.exp(-((sy / DUST_HALF_THICKNESS_SECTORS) ** 2))
        opticalDepth += DUST_KAPPA * density * dustVertical * stepSectors

        const weighted = density * stepSectors * transmission
        integral += weighted
        localIntegral +=
          weighted *
          (1 - smoothstep(LOCAL_LIGHT_NEAR_SECTORS, LOCAL_LIGHT_FAR_SECTORS, distance))
        const radiusFromCore = Math.sqrt(sx * sx + sz * sz)
        warmthIntegral +=
          weighted * clamp01(1 - radiusFromCore / COLOR_BLEND_RADIUS_SECTORS)

        // 성운 색조 — 지나온 가스의 색을 밀도 가중 평균 (광원이 아니라 배경 성질, 결정 40 2차)
        if (sampleIndex % TINT_SAMPLE_STRIDE === 0) {
          const tint = nebulaTintAt(sx, sy, sz)
          tintRose += weighted * tint.rose
          tintTeal += weighted * tint.teal
          tintWeight += weighted
        }
        sampleIndex++
      }

      const offset = row * grid.columns + column
      grid.integrals[offset] = integral
      grid.localIntegrals[offset] = localIntegral
      grid.warmths[offset] = integral > 0 ? warmthIntegral / integral : 0
      grid.tintRose[offset] = tintWeight > 0 ? tintRose / tintWeight : 0.5
      grid.tintTeal[offset] = tintWeight > 0 ? tintTeal / tintWeight : 0.5
    }
  }
}

/** 행 → 띠 프라이어: 원반면(y=0)에서 멀수록 근거리 광을 깎는 가우시안 + 잔광 바닥. */
function bandPrior(yWorld: number, sigmaScale = 1): number {
  return (
    BAND_PRIOR_FLOOR +
    (1 - BAND_PRIOR_FLOOR) *
      Math.exp(-((yWorld / (BAND_PRIOR_SIGMA_WORLD * sigmaScale)) ** 2))
  )
}

/**
 * 벌지 내부 프라이어 완화 (galaxy-realism-pass) — 벌지 안 정박은 하늘 광량 거의 전부가
 * '근거리'로 분류돼 프라이어에 통째로 눌리면 하늘이 실제 구조가 아니라 프라이어 함수의
 * 모양(균일한 일자 띠)이 된다 ("주황 형광등", 사용자 기각). 정박 반경이 벌지 안쪽일수록
 * 프라이어를 1로 풀어 실제 3D 적분(구형 벌지 글로우·수직 테이퍼·먼지 균열)이 하늘을
 * 그리게 한다. 벌지 밖 정박은 0 — 기존 사방 워시 방지 메커니즘 그대로.
 */
const PRIOR_RELAX_INNER_SECTORS = 3
const PRIOR_RELAX_OUTER_SECTORS = 9
/**
 * 완화 상한 — 1.0(완전 해제)은 사방이 균일 베이지 벽, 0.4도 뚱뚱한 안개 벽 (실측 기각 2회).
 * 실제 은하수 사진의 문법은 "띠의 존재"가 아니라 불규칙함 — 띠는 유지하되 폭·밝기를
 * 방위각으로 출렁이게 한다 (아래 WIDTH_BREATH). 완화는 미량만 남긴다.
 */
const PRIOR_RELAX_MAX = 0.15

/**
 * 띠 폭 호흡 (galaxy-realism-pass) — 프라이어 σ를 방위각 노이즈로 ±35% 변조한다.
 * 자로 그은 듯한 수평 경계(형광등)를 깨는 핵심 — 실제 은하수의 울퉁불퉁한 실루엣.
 */
const WIDTH_BREATH_SPAN = 0.35

function priorRelaxOf(anchorRadiusSectors: number): number {
  return (
    PRIOR_RELAX_MAX *
    (1 - smoothstep(PRIOR_RELAX_INNER_SECTORS, PRIOR_RELAX_OUTER_SECTORS, anchorRadiusSectors))
  )
}

/** 원시 그리드 → 톤매핑된 베이스 캔버스: 근거리 띠 셰이핑 + 자동 노출 + 색·균열·패치. */
function toneMapGrid(grid: RayGrid, priorRelax: number): HTMLCanvasElement {
  // 띠 폭 호흡 — 프라이어 σ를 방위각 노이즈로 변조해 자로 그은 수평 경계를 깬다.
  const sigmaScales = new Float32Array(grid.columns)
  for (let column = 0; column < grid.columns; column++) {
    const theta = (column / grid.columns) * Math.PI * 2
    sigmaScales[column] = 1 + WIDTH_BREATH_SPAN * (azimuthNoise(theta, 5.7) * 2 - 1)
  }

  // 1패스 — 근거리 광만 띠 프라이어로 모은 표시용 광량을 만들고 최댓값을 찾는다
  const shaped = new Float32Array(grid.columns * grid.rows)
  let maxShaped = 0
  for (let row = 0; row < grid.rows; row++) {
    const verticalRatio = 1 - (row / (grid.rows - 1)) * 2
    const yWorld = verticalRatio * BAND_HALF_HEIGHT
    for (let column = 0; column < grid.columns; column++) {
      const gaussianPrior = bandPrior(yWorld, sigmaScales[column] ?? 1)
      // 벌지 내부 정박은 프라이어를 부분 완화 — 실제 적분 구조가 하늘을 더 그린다.
      const prior = gaussianPrior + (1 - gaussianPrior) * priorRelax
      const offset = row * grid.columns + column
      const total = grid.integrals[offset] ?? 0
      const local = grid.localIntegrals[offset] ?? 0
      const value = total - local + local * prior
      shaped[offset] = value
      if (value > maxShaped) maxShaped = value
    }
  }
  const exposure = Math.max(maxShaped, MIN_EXPOSURE_INTEGRAL)

  // 2패스 — 노출 정규화 + 색·균열·패치·가장자리 페이드를 픽셀로
  const image = new ImageData(grid.columns, grid.rows)
  // 벌지 내부일수록(priorRelax↑) 패치 변조를 키운다 — 완화로 넓어진 글로우가
  // 균일 벽으로 읽히지 않게 방위각 얼룩을 강화 (실구조 클럼프에 보태는 코스메틱).
  const patchSpan = PATCH_SPAN * (1 + priorRelax * 2)
  for (let column = 0; column < grid.columns; column++) {
    const theta = (column / grid.columns) * Math.PI * 2
    const patch = PATCH_BASE - patchSpan * 0.5 + patchSpan * azimuthNoise(theta, 0)

    for (let row = 0; row < grid.rows; row++) {
      const offset = row * grid.columns + column
      const brightness = toneCurve(clamp01((shaped[offset] ?? 0) / exposure))
      const warmth = clamp01((grid.warmths[offset] ?? 0) * WARMTH_GAIN)

      const verticalRatio = 1 - (row / (grid.rows - 1)) * 2
      // 대균열은 적분 소광(O-20)이 구조적으로 만든다 — 구 코스메틱 rift 감산 제거.
      const edgeFade = 1 - smoothstep(EDGE_FADE_START, 1, Math.abs(verticalRatio))
      const level = brightness * patch * edgeFade * clumpModAt(theta, verticalRatio)

      // 성운 색조 — 띠의 빛 자체가 로즈/청록으로 물든다 (더해지는 광원 없음, 결정 40 2차)
      const roseShift =
        nebulaTintShift(grid.tintRose[offset] ?? 0.5) * NEBULA_TINT_MAX_BLEND
      const tealShift =
        nebulaTintShift(grid.tintTeal[offset] ?? 0.5) * NEBULA_TINT_MAX_BLEND

      let red = ARM_RGB[0] + (BULGE_RGB[0] - ARM_RGB[0]) * warmth
      let green = ARM_RGB[1] + (BULGE_RGB[1] - ARM_RGB[1]) * warmth
      let blue = ARM_RGB[2] + (BULGE_RGB[2] - ARM_RGB[2]) * warmth
      red += (NEBULA_ROSE_RGB[0] - red) * roseShift
      green += (NEBULA_ROSE_RGB[1] - green) * roseShift
      blue += (NEBULA_ROSE_RGB[2] - blue) * roseShift
      red += (NEBULA_TEAL_RGB[0] - red) * tealShift
      green += (NEBULA_TEAL_RGB[1] - green) * tealShift
      blue += (NEBULA_TEAL_RGB[2] - blue) * tealShift

      const tintedLevel = level * (1 + (roseShift + tealShift) * TINT_BRIGHTNESS_LIFT)

      const pixel = offset * 4
      image.data[pixel] = red * tintedLevel
      image.data[pixel + 1] = green * tintedLevel
      image.data[pixel + 2] = blue * tintedLevel
      image.data[pixel + 3] = 255 // 가산 블렌딩 — 검정 = 투명 (GalaxyNebula와 같은 규약)
    }
  }

  const canvas = document.createElement('canvas')
  canvas.width = grid.columns
  canvas.height = grid.rows
  const context = canvas.getContext('2d')
  if (context == null) throw new Error('은하 밴드 베이크용 2D 컨텍스트를 만들 수 없습니다')
  context.putImageData(image, 0, 0)
  return canvas
}

/**
 * 베이스 캔버스 → 최종 캔버스 합성: 블러 업스케일 + 산란 헤일로.
 * 가로는 한 바퀴 랩이므로 좌우로 한 장씩 더 그려 블러가 솔기 너머를 샘플하게 한다.
 */
function composeCanvas(base: HTMLCanvasElement, sharpBlurPx: number): HTMLCanvasElement {
  const final = document.createElement('canvas')
  final.width = FINAL_WIDTH
  final.height = FINAL_HEIGHT
  const context = final.getContext('2d')
  if (context == null) throw new Error('은하 밴드 합성용 2D 컨텍스트를 만들 수 없습니다')
  context.imageSmoothingEnabled = true

  const wrapOffsets = [-FINAL_WIDTH, 0, FINAL_WIDTH]

  context.filter = `blur(${sharpBlurPx}px)`
  for (const offset of wrapOffsets) {
    context.drawImage(base, offset, 0, FINAL_WIDTH, FINAL_HEIGHT)
  }

  context.globalCompositeOperation = 'lighter'
  context.globalAlpha = HALO_ALPHA
  context.filter = `blur(${HALO_BLUR_PX}px)`
  for (const offset of wrapOffsets) {
    context.drawImage(base, offset, 0, FINAL_WIDTH, FINAL_HEIGHT)
  }

  return final
}

export interface BandPanoramaJob {
  /** 저해상 즉시 베이크의 합성 결과 — 마운트 프레임에 표시 가능. 생략 옵션 시 null. */
  readonly preview: HTMLCanvasElement | null
  /** 고해상 열을 시간 예산(ms)만큼 굽는다 — 전체 완료 시 true. */
  refine(budgetMs: number): boolean
  /** refine 완료 후 호출 — 최종 합성 캔버스. */
  composeFinal(): HTMLCanvasElement
}

/** 같은 정박 위치 = 같은 하늘 — 텍스처 캐시 키. */
export function bandPanoramaKey(anchor: readonly [number, number, number]): string {
  return `${anchor[0]}:${anchor[1]}:${anchor[2]}`
}

export function createBandPanoramaJob(
  anchor: readonly [number, number, number],
  options: { readonly withPreview: boolean },
): BandPanoramaJob {
  const anchorRadiusSectors =
    Math.sqrt(anchor[0] * anchor[0] + anchor[2] * anchor[2]) / SECTOR_SIZE
  const priorRelax = priorRelaxOf(anchorRadiusSectors)

  let preview: HTMLCanvasElement | null = null
  if (options.withPreview) {
    const previewGrid = createRayGrid(PREVIEW_COLUMNS, PREVIEW_ROWS)
    bakeColumns(previewGrid, anchor, PREVIEW_STEP_SECTORS, 0, PREVIEW_COLUMNS)
    preview = composeCanvas(toneMapGrid(previewGrid, priorRelax), PREVIEW_SHARP_BLUR_PX)
  }

  const fullGrid = createRayGrid(BASE_COLUMNS, BASE_ROWS)
  let nextColumn = 0

  return {
    preview,
    refine(budgetMs) {
      const deadline = performance.now() + budgetMs
      while (nextColumn < BASE_COLUMNS) {
        bakeColumns(fullGrid, anchor, RAY_STEP_SECTORS, nextColumn, nextColumn + 1)
        nextColumn++
        if (performance.now() >= deadline) break
      }
      return nextColumn >= BASE_COLUMNS
    },
    composeFinal() {
      if (nextColumn < BASE_COLUMNS) {
        throw new Error('정련이 끝나기 전에 composeFinal이 호출됐습니다')
      }
      return composeCanvas(toneMapGrid(fullGrid, priorRelax), SHARP_BLUR_PX)
    },
  }
}
