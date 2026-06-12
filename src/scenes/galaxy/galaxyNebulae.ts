import { sectorDensity } from '@/engine'

/**
 * 장식 성운 필드 — 은하 군데군데 떠 있는 발광 가스 패치 (백로그 G-b-6 후속 피드백).
 *
 * 은하 매크로 형상(sectorDensity)이 시드 무관이므로 성운도 시드 무관 결정론으로
 * 고정한다 — 모든 플레이어가 같은 자리의 같은 성운을 본다. 결정론 거부 샘플링으로
 * 나선팔 위(밀도 있는 곳)에만 앉혀 "아무 데나 뿌린 구름"(결정 28 기각 패턴)이 아니라
 * 은하 구조에 속한 가스로 읽히게 한다.
 *
 * 소비처 둘이 같은 목록을 공유한다 (우주 일관성, 결정 24와 같은 원칙):
 * - 우주선 뷰 파노라마(galaxyBandPanorama) — 광선마다 가우시안 선적분(닫힌형)
 * - 은하 전도(GalaxyNebula) — 평면도 텍스처에 라디얼 그라디언트로 투영
 */

export interface GalaxyNebulaBlob {
  /** 중심 (섹터 좌표) — 원반면 근처. */
  readonly sx: number
  readonly sy: number
  readonly sz: number
  /** 구형 가우시안 σ (섹터). */
  readonly sigmaSectors: number
  /** 발광색 (0..1 선형) — 가산 블렌딩 전제. */
  readonly color: readonly [number, number, number]
}

const NEBULA_COUNT = 11
/** 배치 환대 — 벌지(코어 글로우 영역) 밖, 림 페이드 안. */
const MIN_RADIUS_SECTORS = 9
const MAX_RADIUS_SECTORS = 42
/** 이 미만 밀도엔 놓지 않는다 — 팔 사이 공허에 뜬 성운은 구조 없는 구름으로 읽힌다. */
const MIN_DENSITY = 0.12
/** 원반면 수직 산포 (섹터) — 가스는 별보다 얇게 깔린다. */
const VERTICAL_SPREAD_SECTORS = 0.9
/** σ는 작게 — 크면 띠 전체를 물들이는 워시가 된다 (실측 1.6~4.2는 과했다). */
const SIGMA_MIN_SECTORS = 1.0
const SIGMA_SPAN_SECTORS = 1.4
/** 거부 샘플링 시도 상한 — 결정론 안전판 (밀도 조건이 빡빡해도 무한 루프 없음). */
const MAX_CANDIDATES = 400

/**
 * 성운 팔레트 — 발광(로즈)·반사(청록)·이온화(보라) 가스. 청록은 UI 홀로 색 언어와
 * 잇닿고, 로즈/보라는 밴드의 한색·벌지 난색 어느 쪽과도 겹치지 않아 "성운"으로 읽힌다.
 */
const NEBULA_PALETTE: readonly (readonly [number, number, number])[] = [
  [1.0, 0.42, 0.62],
  [0.38, 0.95, 0.85],
  [0.58, 0.5, 1.0],
]
const FALLBACK_COLOR: readonly [number, number, number] = [1, 1, 1]

/** 결정론 해시 — DecorativeStarfield와 같은 계열 (전역 난수 금지). */
function hash01(n: number): number {
  const value = Math.sin(n) * 43758.5453
  return value - Math.floor(value)
}

function buildNebulae(): readonly GalaxyNebulaBlob[] {
  const blobs: GalaxyNebulaBlob[] = []
  for (
    let candidate = 0;
    blobs.length < NEBULA_COUNT && candidate < MAX_CANDIDATES;
    candidate++
  ) {
    const angle = hash01(candidate * 7 + 1) * Math.PI * 2
    // √균등 — 면적 기준 고른 산포 (안쪽 과밀 방지)
    const radius =
      MIN_RADIUS_SECTORS +
      (MAX_RADIUS_SECTORS - MIN_RADIUS_SECTORS) * Math.sqrt(hash01(candidate * 7 + 2))
    const sx = Math.cos(angle) * radius
    const sz = Math.sin(angle) * radius
    const sy = (hash01(candidate * 7 + 3) - 0.5) * 2 * VERTICAL_SPREAD_SECTORS

    if (sectorDensity({ sx, sy, sz }) < MIN_DENSITY) continue

    blobs.push({
      sx,
      sy,
      sz,
      sigmaSectors: SIGMA_MIN_SECTORS + SIGMA_SPAN_SECTORS * hash01(candidate * 7 + 4),
      color: NEBULA_PALETTE[blobs.length % NEBULA_PALETTE.length] ?? FALLBACK_COLOR,
    })
  }
  return blobs
}

/** 모듈 로드 시 1회 생성 — 순수 수학이라 import 시점 평가가 안전하다. */
export const GALAXY_NEBULAE: readonly GalaxyNebulaBlob[] = buildNebulae()
