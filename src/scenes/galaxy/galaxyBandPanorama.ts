import {
  GALAXY_HALF_THICKNESS_SECTORS,
  GALAXY_RADIUS_SECTORS,
  SECTOR_SIZE,
  sectorDensity,
} from '@/engine'

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
 * 비용(광선 ~3.7만)이 커서 2단계로 굽는다 — 저해상 프리뷰(동기 ~20ms, 즉시 표시)
 * → 프레임당 시간 예산으로 고해상 정련(행성 텍스처의 프레임 분산 베이크와 같은
 * 철학, 결정 33) → 완료 시 스왑. 전부 결정론 — 같은 정박 위치는 항상 같은 하늘.
 */

/** 밴드 실린더 반경 — 정박 별에서 가장 먼 은하 별(≤9,600)보다 바깥, 장식 별밭(12,000) 안. */
export const BAND_RADIUS = 10_500
/**
 * 밴드 절반 높이 (월드) — 반경 대비 약 ±14°. 외곽 정박에서 벌지 돔(수직 5섹터
 * ≈ 거리 29섹터 기준 ±10°)이 페이드 여유를 갖고 들어가는 높이.
 */
export const BAND_HALF_HEIGHT = 2_600

/** 최종 텍스처 크기 — 베이스를 블러 업스케일한 결과 (GalaxyNebula와 같은 합성 패턴). */
const FINAL_WIDTH = 768
const FINAL_HEIGHT = 192

/** 고해상 베이스 격자 — 열(방위각) × 행(고도). */
const BASE_COLUMNS = 384
const BASE_ROWS = 96
/** 저해상 프리뷰 격자 — 마운트 프레임에 동기로 구울 수 있는 크기. */
const PREVIEW_COLUMNS = 128
const PREVIEW_ROWS = 32
const PREVIEW_STEP_SECTORS = 1.5

/** 업스케일 블러(px, 최종 해상도 기준) — 격자를 연속 발광 면으로. 프리뷰는 더 강하게. */
const SHARP_BLUR_PX = 2
const PREVIEW_SHARP_BLUR_PX = 6
/** 산란 헤일로 — 밝은 영역 주변에 베이크해 넣는 블룸 (두꺼운 원반의 산란광 역할). */
const HALO_BLUR_PX = 14
const HALO_ALPHA = 0.42

/** 적분 보폭 (섹터) — 클럼프 노이즈 파장(~5.5섹터)보다 충분히 촘촘하다. */
const RAY_STEP_SECTORS = 0.75
/** 적분 사거리 — 은하 지름이면 어느 정박 위치에서든 원반 반대편 끝까지 닿는다. */
const RAY_MAX_SECTORS = GALAXY_RADIUS_SECTORS * 2
/** 수직 탈출 한계 — 이 밖은 밀도 0이라 적분을 조기 종료한다 (고고도 광선 비용 절감). */
const VERTICAL_EXIT_SECTORS = GALAXY_HALF_THICKNESS_SECTORS + 0.1

/** 적분값이 이 값이면 밝기 1로 포화 — 벌지 정관통 방향만 닿는 상한 (포화 = 구조 소멸). */
const INTEGRAL_SATURATION = 30
/**
 * 실린더 상·하단 가장자리 페이드 시작점 (|v| 기준) — 벌지 내부 정박(시작 별)에서는
 * 전 고도가 밝아 텍스처 끝이 하드 엣지로 보인다. 외곽 정박의 벌지 돔(|v|≈0.71)은
 * 건드리지 않는 위치에서 시작한다.
 */
const EDGE_FADE_START = 0.75
/** 밝기 감마 (<1) — 팔 사이·외곽 방향에도 옅은 빛이 깔리게 어두운 쪽을 들어 올린다. */
const BRIGHTNESS_GAMMA = 0.8

/** 벌지(난색) ↔ 나선팔(한색) — GalaxyNebula(결정 23)와 같은 색 언어. */
const BULGE_RGB = [255, 208, 150] as const
const ARM_RGB = [110, 140, 235] as const
const COLOR_BLEND_RADIUS_SECTORS = 10
/** 밀도 가중 평균 난색도 증폭 — 벌지 방향만 난색으로, 띠 전체가 베이지가 되면 과한 것. */
const WARMTH_GAIN = 1.6

/**
 * 적도 암흑대 — 은하수 대균열처럼 원반면(y=0)을 따라 광량을 깎는 먼지 실루엣.
 * 깊이는 국소 밝기에 비례(어두운 방향에선 안 보임) + 방위각 노이즈로 패치형으로 끊긴다.
 */
const RIFT_HALF_HEIGHT_WORLD = 190
const RIFT_MAX_DEPTH = 0.45
const RIFT_NOISE_FLOOR = 0.35
/** 방위각 패치 변조 — 실구조(클럼프 적분)가 생겼으므로 초기 구현보다 약하게 보탠다. */
const PATCH_BASE = 0.92
const PATCH_SPAN = 0.16

/**
 * 벌지 내부 보정 — 벌지 안 정박(시작 별 포함)에서는 물리적으로 전 고도가 밝아
 * 하늘 전체가 단조로운 워시가 된다. 게임 미학 우선 원칙(결정 28)에 따라 안쪽
 * 정박일수록 광량을 원반면 중심의 띠 형태로 모은다 — 벌지 밖 정박에는 영향이 없다.
 */
const INTERIOR_BLEND_RADIUS_SECTORS = 10
const INTERIOR_BAND_SIGMA = 0.35
/** 보정 후에도 남기는 고고도 잔광 — "빛 속에 있다"는 감각은 유지한다. */
const INTERIOR_AMBIENT_FLOOR = 0.25

function clamp01(value: number): number {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
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

interface RayLight {
  /** 정규화 광량 [0, 1]. */
  readonly brightness: number
  /** 밀도 가중 벌지 근접도 [0, 1] — 색 보간용. */
  readonly warmth: number
}

/** 한 광선의 원반 광량 — 3D 밀도를 선적분한다 (표면 밝기라 거리 가중 없음). */
function integrateRay(
  originSx: number,
  originSy: number,
  originSz: number,
  directionX: number,
  directionY: number,
  directionZ: number,
  stepSectors: number,
): RayLight {
  // 수직 탈출 — 원반 두께 밖은 밀도 0이므로 그 전까지만 적분 (고고도 광선 조기 종료)
  let rayEnd = RAY_MAX_SECTORS
  if (directionY > 1e-6) {
    rayEnd = Math.min(rayEnd, (VERTICAL_EXIT_SECTORS - originSy) / directionY)
  } else if (directionY < -1e-6) {
    rayEnd = Math.min(rayEnd, (-VERTICAL_EXIT_SECTORS - originSy) / directionY)
  }

  let integral = 0
  let warmthIntegral = 0
  for (let distance = stepSectors * 0.5; distance <= rayEnd; distance += stepSectors) {
    const sx = originSx + directionX * distance
    const sy = originSy + directionY * distance
    const sz = originSz + directionZ * distance
    const density = sectorDensity({ sx, sy, sz })
    if (density === 0) continue

    const weighted = density * stepSectors
    integral += weighted
    const radiusFromCore = Math.sqrt(sx * sx + sz * sz)
    warmthIntegral += weighted * clamp01(1 - radiusFromCore / COLOR_BLEND_RADIUS_SECTORS)
  }

  const brightness = Math.pow(clamp01(integral / INTEGRAL_SATURATION), BRIGHTNESS_GAMMA)
  const warmth = integral > 0 ? clamp01((warmthIntegral / integral) * WARMTH_GAIN) : 0
  return { brightness, warmth }
}

/** 격자의 열 구간 [columnStart, columnEnd)를 ImageData에 굽는다. */
function bakeColumns(
  image: ImageData,
  rows: number,
  columns: number,
  anchor: readonly [number, number, number],
  stepSectors: number,
  columnStart: number,
  columnEnd: number,
): void {
  const originSx = anchor[0] / SECTOR_SIZE
  const originSy = anchor[1] / SECTOR_SIZE
  const originSz = anchor[2] / SECTOR_SIZE
  const anchorRadiusSectors = Math.sqrt(originSx * originSx + originSz * originSz)
  const interiorWeight = clamp01(1 - anchorRadiusSectors / INTERIOR_BLEND_RADIUS_SECTORS)

  for (let column = columnStart; column < columnEnd; column++) {
    // three.js CylinderGeometry UV 규약: u = θ/2π, 측면 정점 = (r·sinθ, y, r·cosθ)
    const theta = (column / columns) * Math.PI * 2
    const wallX = Math.sin(theta) * BAND_RADIUS
    const wallZ = Math.cos(theta) * BAND_RADIUS

    const patch = PATCH_BASE + PATCH_SPAN * azimuthNoise(theta, 0)
    const riftNoise =
      RIFT_NOISE_FLOOR + (1 - RIFT_NOISE_FLOOR) * azimuthNoise(theta, 2.3)

    for (let row = 0; row < rows; row++) {
      // 캔버스 첫 행 = 텍스처 v=1 = 실린더 꼭대기 (flipY) — 위가 +y
      const verticalRatio = 1 - (row / (rows - 1)) * 2
      const yWorld = verticalRatio * BAND_HALF_HEIGHT
      const wallY = yWorld - anchor[1]
      const length = Math.sqrt(wallX * wallX + wallY * wallY + wallZ * wallZ)
      const { brightness, warmth } = integrateRay(
        originSx,
        originSy,
        originSz,
        wallX / length,
        wallY / length,
        wallZ / length,
        stepSectors,
      )

      const riftDip = (yWorld / RIFT_HALF_HEIGHT_WORLD) ** 2
      const rift = 1 - RIFT_MAX_DEPTH * riftNoise * brightness * Math.exp(-riftDip)
      const edgeFade = 1 - smoothstep(EDGE_FADE_START, 1, Math.abs(verticalRatio))
      const bandShape =
        INTERIOR_AMBIENT_FLOOR +
        (1 - INTERIOR_AMBIENT_FLOOR) *
          Math.exp(-((verticalRatio / INTERIOR_BAND_SIGMA) ** 2))
      const interiorShaping = 1 - interiorWeight * (1 - bandShape)
      const level = brightness * patch * rift * edgeFade * interiorShaping

      const red = ARM_RGB[0] + (BULGE_RGB[0] - ARM_RGB[0]) * warmth
      const green = ARM_RGB[1] + (BULGE_RGB[1] - ARM_RGB[1]) * warmth
      const blue = ARM_RGB[2] + (BULGE_RGB[2] - ARM_RGB[2]) * warmth

      const offset = (row * columns + column) * 4
      image.data[offset] = red * level
      image.data[offset + 1] = green * level
      image.data[offset + 2] = blue * level
      image.data[offset + 3] = 255 // 가산 블렌딩 — 검정 = 투명 (GalaxyNebula와 같은 규약)
    }
  }
}

function toCanvas(image: ImageData): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const context = canvas.getContext('2d')
  if (context == null) throw new Error('은하 밴드 베이크용 2D 컨텍스트를 만들 수 없습니다')
  context.putImageData(image, 0, 0)
  return canvas
}

/**
 * 베이스 격자 → 최종 캔버스 합성: 블러 업스케일 + 산란 헤일로.
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
  let preview: HTMLCanvasElement | null = null
  if (options.withPreview) {
    const previewImage = new ImageData(PREVIEW_COLUMNS, PREVIEW_ROWS)
    bakeColumns(
      previewImage,
      PREVIEW_ROWS,
      PREVIEW_COLUMNS,
      anchor,
      PREVIEW_STEP_SECTORS,
      0,
      PREVIEW_COLUMNS,
    )
    preview = composeCanvas(toCanvas(previewImage), PREVIEW_SHARP_BLUR_PX)
  }

  const fullImage = new ImageData(BASE_COLUMNS, BASE_ROWS)
  let nextColumn = 0

  return {
    preview,
    refine(budgetMs) {
      const deadline = performance.now() + budgetMs
      while (nextColumn < BASE_COLUMNS) {
        bakeColumns(
          fullImage,
          BASE_ROWS,
          BASE_COLUMNS,
          anchor,
          RAY_STEP_SECTORS,
          nextColumn,
          nextColumn + 1,
        )
        nextColumn++
        if (performance.now() >= deadline) break
      }
      return nextColumn >= BASE_COLUMNS
    },
    composeFinal() {
      return composeCanvas(toCanvas(fullImage), SHARP_BLUR_PX)
    },
  }
}
