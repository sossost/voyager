import type { Seed, SectorCoords, StarId } from '../coords'
import { makeStarId } from '../coords'
import { starName } from '../naming/names'
import type { Rng, WeightedEntry } from '../rng/streams'
import { rngFor } from '../rng/streams'
import { SECTOR_SIZE, sectorDensity } from './density'
import { SOL_STAR_ID, SOL_LOCAL_POS, SOL_SECTOR } from '../system/sol'

export const MAX_STARS_PER_SECTOR = 5

export type SpectralClass = 'O' | 'B' | 'A' | 'F' | 'G' | 'K' | 'M'

/** 실제 항성 분포를 단순화한 가중치 — M형이 가장 흔하고 O형이 가장 희귀. */
const SPECTRAL_WEIGHTS: readonly WeightedEntry<SpectralClass>[] = [
  { value: 'M', weight: 40 },
  { value: 'K', weight: 24 },
  { value: 'G', weight: 16 },
  { value: 'F', weight: 10 },
  { value: 'A', weight: 6 },
  { value: 'B', weight: 3 },
  { value: 'O', weight: 1 },
]

/** 질량 내림차순 분광형 — 동반성을 "주성 이하 질량"으로 제약할 때 인덱스 기준. */
const SPECTRAL_BY_MASS: readonly SpectralClass[] = ['O', 'B', 'A', 'F', 'G', 'K', 'M']

/** 항성계 다중도 — 태양형 별의 실제 다중성 비율(~45%)에 근접 (결정 3). */
export type Multiplicity = 'single' | 'binary' | 'triple'

const MULTIPLICITY_WEIGHTS: readonly WeightedEntry<Multiplicity>[] = [
  { value: 'single', weight: 55 },
  { value: 'binary', weight: 33 },
  { value: 'triple', weight: 12 },
]

/**
 * 별 종류 (결정 2) — 주계열성 + 이색 천체 4종.
 * 적색거성·백색왜성은 진화 후기 상태, 펄서·블랙홀은 대질량성의 종착.
 */
export type StarKind = 'main_sequence' | 'red_giant' | 'white_dwarf' | 'pulsar' | 'black_hole'

/**
 * 분광형별 kind 가중치 (결정 4) — 천문학적 사실성:
 * 블랙홀·펄서는 대질량 O/B에서만(=전체의 ~0.4%로 자연 희귀), 적색거성·백색왜성은
 * 중저질량의 흔한 진화 상태. 어디서나 주계열성이 압도적 다수(long-tail, 결정 3).
 * weighted()는 테이블과 무관하게 next() 1회만 소비하므로 append-only·결정론에 영향 없다.
 */
const KIND_WEIGHTS_BY_SPECTRAL: Readonly<Record<SpectralClass, readonly WeightedEntry<StarKind>[]>> = {
  O: [
    { value: 'main_sequence', weight: 78 },
    { value: 'red_giant', weight: 6 },
    { value: 'pulsar', weight: 10 },
    { value: 'black_hole', weight: 6 },
  ],
  B: [
    { value: 'main_sequence', weight: 85 },
    { value: 'red_giant', weight: 6 },
    { value: 'pulsar', weight: 6 },
    { value: 'black_hole', weight: 3 },
  ],
  A: [
    { value: 'main_sequence', weight: 90 },
    { value: 'red_giant', weight: 6 },
    { value: 'white_dwarf', weight: 4 },
  ],
  F: [
    { value: 'main_sequence', weight: 92 },
    { value: 'red_giant', weight: 5 },
    { value: 'white_dwarf', weight: 3 },
  ],
  G: [
    { value: 'main_sequence', weight: 92 },
    { value: 'red_giant', weight: 5 },
    { value: 'white_dwarf', weight: 3 },
  ],
  K: [
    { value: 'main_sequence', weight: 90 },
    { value: 'red_giant', weight: 8 },
    { value: 'white_dwarf', weight: 2 },
  ],
  M: [
    { value: 'main_sequence', weight: 93 },
    { value: 'red_giant', weight: 6 },
    { value: 'white_dwarf', weight: 1 },
  ],
}

/** 동반성 궤도 편심 상한 — 실제 쌍성의 흔한 편심대. */
const ECC_MAX = 0.6
/**
 * 동반성 궤도 반장축(추상 AU-유사) 범위. 렌더가 스케일·circumbinary 임계를 해석한다 (결정 9).
 * 계층형 삼중성: inner는 근접 쌍, outer는 멀리 도는 제3성 (결정 6).
 */
const BINARY_SEP_MIN = 1.0
const BINARY_SEP_SPAN = 11.0
const INNER_SEP_MIN = 0.8
const INNER_SEP_SPAN = 1.7
const OUTER_SEP_MIN = 8.0
const OUTER_SEP_SPAN = 10.0

/**
 * 계층형 삼중성에서 동반성의 역할.
 * inner = 주성과 근접 쌍을 이룸 / outer = 그 쌍의 질량중심을 멀리서 공전.
 */
export interface Companion {
  /** 동반성 분광형 — 주성 이하 질량으로 제약된다. */
  readonly spectral: SpectralClass
  /** 궤도 반장축 (추상 AU-유사) — 렌더가 스케일·임계를 해석. */
  readonly separation: number
  /** 궤도 편심 [0, ECC_MAX). */
  readonly eccentricity: number
  /** 초기 공전 위상 [0, 1) → ×2π. */
  readonly phase: number
  readonly hierarchy: 'inner' | 'outer'
}

export interface Star {
  readonly id: StarId
  readonly sector: SectorCoords
  /** 섹터 로컬 좌표 [0, SECTOR_SIZE)³ — fp32 정밀도 보호를 위해 월드 좌표는 저장하지 않는다. */
  readonly localPos: readonly [number, number, number]
  readonly spectral: SpectralClass
  readonly name: string
  /** 항성계 다중도 (결정 1·2) — single은 동반성 없음. */
  readonly multiplicity: Multiplicity
  /** 동반성 목록 — single:[] / binary:1 / triple:2([inner, outer]). */
  readonly companions: readonly Companion[]
  /** 별 종류 (이색 천체, GEN_VERSION 5) — 주성에만 존재. 'star' 스트림 마지막 draw. */
  readonly kind: StarKind
}

/**
 * 동반성 분광형 가중치 — 주성 질량 이하(SPECTRAL_BY_MASS 인덱스 ≥ 주성)만 남겨 재정규화 (결정 5).
 * weighted()가 합을 재정규화하므로 부분집합을 그대로 넘기면 된다.
 */
function companionWeightsAtMost(
  primary: SpectralClass,
): readonly WeightedEntry<SpectralClass>[] {
  const minIndex = SPECTRAL_BY_MASS.indexOf(primary)
  return SPECTRAL_WEIGHTS.filter((entry) => SPECTRAL_BY_MASS.indexOf(entry.value) >= minIndex)
}

/** 태양 — 모든 시드에서 섹터(26,0,10) 인덱스 0에 고정 배치된다 (G-c-10). 단일성 고정. */
export const SOL_STAR: Star = {
  id: SOL_STAR_ID,
  sector: SOL_SECTOR,
  localPos: SOL_LOCAL_POS,
  spectral: 'G',
  name: '태양',
  multiplicity: 'single',
  companions: [],
  kind: 'main_sequence',
}

/**
 * 동반성 draw — 주성 스트림에서 다중성 직후 호출된다 (append-only).
 * draw 순서(companion당): spectral → separation → eccentricity → phase.
 * 계층형 삼중성: companion[0]=inner(근접), companion[1]=outer(원거리) (결정 6).
 */
function drawCompanions(
  starRng: Rng,
  multiplicity: Multiplicity,
  primarySpectral: SpectralClass,
): readonly Companion[] {
  if (multiplicity === 'single') return []
  const count = multiplicity === 'binary' ? 1 : 2

  const companions: Companion[] = []
  for (let c = 0; c < count; c++) {
    const hierarchy: Companion['hierarchy'] =
      multiplicity === 'triple' && c === 1 ? 'outer' : 'inner'
    const spectral = starRng.weighted(companionWeightsAtMost(primarySpectral))
    const sepMin =
      hierarchy === 'outer' ? OUTER_SEP_MIN : multiplicity === 'binary' ? BINARY_SEP_MIN : INNER_SEP_MIN
    const sepSpan =
      hierarchy === 'outer'
        ? OUTER_SEP_SPAN
        : multiplicity === 'binary'
          ? BINARY_SEP_SPAN
          : INNER_SEP_SPAN
    const separation = sepMin + starRng.next() * sepSpan
    const eccentricity = starRng.next() * ECC_MAX
    const phase = starRng.next()
    companions.push({ spectral, separation, eccentricity, phase, hierarchy })
  }
  return companions
}

/**
 * 섹터 → 별 목록. 순수 함수 — 같은 (seed, sector)는 항상 같은 별을 만든다.
 *
 * 별 개수는 섹터 스트림에서, 각 별의 속성은 별 자신의 독립 스트림에서 뽑는다
 * (스트림 격리 — 별 속성 추가가 이웃 별을 절대 바꾸지 않는다).
 * Sol 섹터(26,0,10) 인덱스 0은 항상 SOL_STAR — 밀도와 무관하게 count ≥ 1 보장.
 */
export function starsInSector(seed: Seed, sector: SectorCoords): readonly Star[] {
  const isSolSector =
    sector.sx === SOL_SECTOR.sx && sector.sy === SOL_SECTOR.sy && sector.sz === SOL_SECTOR.sz
  const density = sectorDensity(sector)
  if (density === 0 && !isSolSector) return []

  const sectorRng = rngFor(seed, 'sector', sector.sx, sector.sy, sector.sz)
  const expected = density * MAX_STARS_PER_SECTOR
  const base = Math.floor(expected)
  const fraction = expected - base
  const rawCount = base + (sectorRng.next() < fraction ? 1 : 0)
  const count = isSolSector ? Math.max(rawCount, 1) : rawCount

  const stars: Star[] = []
  for (let index = 0; index < count; index++) {
    const id = makeStarId(sector, index)
    if (id === SOL_STAR_ID) {
      stars.push(SOL_STAR)
      continue
    }
    const starRng = rngFor(seed, 'star', id)
    // append-only: 새 속성은 반드시 아래 draw들 뒤에 추가할 것 (자기 스트림 내 호환성)
    const localPos = [
      starRng.next() * SECTOR_SIZE,
      starRng.next() * SECTOR_SIZE,
      starRng.next() * SECTOR_SIZE,
    ] as const
    const spectral = starRng.weighted(SPECTRAL_WEIGHTS)
    // ── append (GEN_VERSION 4): 다중성 — 위 4 draw 값은 보존된다 ──
    const multiplicity = starRng.weighted(MULTIPLICITY_WEIGHTS)
    const companions = drawCompanions(starRng, multiplicity, spectral)
    // ── append (GEN_VERSION 5): 이색 천체 kind — 위 draw 값은 모두 보존된다.
    //    companions가 가변 draw를 소비해도 kind는 항상 그 뒤 마지막 draw다 (append-only).
    const kind = starRng.weighted(KIND_WEIGHTS_BY_SPECTRAL[spectral])
    // name은 별도 'name' 스트림이라 위 append와 순서 무관 (스트림 격리)
    const name = starName(rngFor(seed, 'name', id))

    stars.push({ id, sector, localPos, spectral, name, multiplicity, companions, kind })
  }
  return stars
}
