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

/** 항성계 다중도 (결정 3, 사실성 v2 M-4에서 분광형 종속화). */
export type Multiplicity = 'single' | 'binary' | 'triple'

/**
 * 분광형별 다중성 가중치 (사실성 v2 M-4 — GEN_VERSION 11).
 * 다중성 비율은 질량에 강하게 의존한다 — O ~80%+ / A ~55% / G ~46% / M ~26%
 * (Duchêne & Kraus 2013 Table 1, Raghavan et al. 2010, Sana et al. 2012).
 * 다중 내 삼중 비중도 고질량일수록 높다 (O ~44% → M ~15%).
 * weighted()는 테이블과 무관하게 next() 1회만 소비 — draw 순서·개수 불변 (append-only).
 */
const MULTIPLICITY_WEIGHTS_BY_SPECTRAL: Readonly<
  Record<SpectralClass, readonly WeightedEntry<Multiplicity>[]>
> = {
  O: [
    { value: 'single', weight: 20 },
    { value: 'binary', weight: 45 },
    { value: 'triple', weight: 35 },
  ],
  B: [
    { value: 'single', weight: 30 },
    { value: 'binary', weight: 45 },
    { value: 'triple', weight: 25 },
  ],
  A: [
    { value: 'single', weight: 45 },
    { value: 'binary', weight: 40 },
    { value: 'triple', weight: 15 },
  ],
  F: [
    { value: 'single', weight: 50 },
    { value: 'binary', weight: 38 },
    { value: 'triple', weight: 12 },
  ],
  G: [
    { value: 'single', weight: 54 },
    { value: 'binary', weight: 34 },
    { value: 'triple', weight: 12 },
  ],
  K: [
    { value: 'single', weight: 60 },
    { value: 'binary', weight: 31 },
    { value: 'triple', weight: 9 },
  ],
  M: [
    { value: 'single', weight: 74 },
    { value: 'binary', weight: 22 },
    { value: 'triple', weight: 4 },
  ],
}

/**
 * 별 종류 (결정 2) — 주계열성 + 블랙홀.
 * 블랙홀·펄서는 대질량성(O/B)의 종착. 적색거성·백색왜성는 후속 PR로 분리.
 */
export type StarKind = 'main_sequence' | 'black_hole' | 'pulsar' | 'white_dwarf' | 'red_giant'

/**
 * 분광형별 kind 가중치 (결정 4, 사실성 v2 O-7 정합) — 천문학적 사실성. 진화 종착이 질량에 갈린다:
 *  - O(>20M☉ 지배) → 블랙홀 우세, B(8~20M☉) → 중성자성(펄서) 우세 — 초신성 잔해의
 *    질량 경계와 정렬 (Heger et al. 2003. 구 O형 펄서>블랙홀 역전을 v2에서 수정).
 *  - 저~중질량 A/F/G/K → 부푼 적색거성(red_giant) 단계를 거쳐 잔해 백색왜성(white_dwarf).
 *    A형에도 red_giant를 준다 (F/G와 일관 — 구 버전 누락을 v2에서 수정).
 *  - K/M은 수명(K 17~70Gyr, M 그 이상)이 우주 나이 13.8Gyr보다 길어 아직 진화 산물이 없다
 *    → 항상 주계열성 (구 K형 WD/RG를 v2에서 제거 — M형과 동일 논리).
 * 어디서나 주계열성이 압도적 다수(long-tail, 결정 3).
 * weighted()는 테이블과 무관하게 next() 1회만 소비하므로 append-only·결정론에 영향 없다.
 * 단일 항목 테이블(K/M)의 weight 값은 출력에 무관(target < total 항상 성립) — 항상 main_sequence.
 */
const KIND_WEIGHTS_BY_SPECTRAL: Readonly<Record<SpectralClass, readonly WeightedEntry<StarKind>[]>> = {
  O: [
    { value: 'main_sequence', weight: 78 },
    { value: 'black_hole', weight: 10 },
    { value: 'pulsar', weight: 6 },
  ],
  B: [
    { value: 'main_sequence', weight: 85 },
    { value: 'pulsar', weight: 6 },
    { value: 'black_hole', weight: 3 },
  ],
  A: [
    { value: 'main_sequence', weight: 86 },
    { value: 'white_dwarf', weight: 8 },
    { value: 'red_giant', weight: 6 },
  ],
  F: [
    { value: 'main_sequence', weight: 88 },
    { value: 'white_dwarf', weight: 6 },
    { value: 'red_giant', weight: 6 },
  ],
  G: [
    { value: 'main_sequence', weight: 86 },
    { value: 'white_dwarf', weight: 7 },
    { value: 'red_giant', weight: 7 },
  ],
  K: [{ value: 'main_sequence', weight: 100 }],
  M: [{ value: 'main_sequence', weight: 100 }],
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
 * 계층형 삼중성 역학 안정 임계 (사실성 v2 O-8 — GEN_VERSION 11).
 * outer 근점거리 / inner 원점거리 ≥ 이 값이어야 수 궤도 내 붕괴하지 않는다
 * (Mardling & Aarseth 2001의 전형적 e·질량비 대역 근사 ~4.7).
 * 위반 조합은 결정론적 클램프로 재매핑한다 — 거부-재추첨은 draw 수가 가변이 되어
 * append-only(철칙 3)를 흔들므로 금지 (02-decisions 3). 먼저 inner를 하한(INNER_SEP_MIN)까지
 * 줄이고, 그래도 부족하면 outer를 밀어올린다 (최악 outer ≈ 15 — 기존 상한 18 이내).
 */
const TRIPLE_STABILITY_RATIO = 4.7

interface TripleSeparations {
  readonly innerSeparation: number
  readonly outerSeparation: number
}

function clampTripleStability(
  innerSeparation: number,
  innerEccentricity: number,
  outerSeparation: number,
  outerEccentricity: number,
): TripleSeparations {
  const outerPeriapsis = outerSeparation * (1 - outerEccentricity)
  const requiredApoapsis = outerPeriapsis / TRIPLE_STABILITY_RATIO
  const innerApoapsis = innerSeparation * (1 + innerEccentricity)
  if (innerApoapsis <= requiredApoapsis) return { innerSeparation, outerSeparation }

  // 1단계: inner를 하한까지 줄여 outer 근점 안쪽으로 들인다.
  const clampedInner = Math.max(INNER_SEP_MIN, requiredApoapsis / (1 + innerEccentricity))
  const clampedInnerApoapsis = clampedInner * (1 + innerEccentricity)
  if (clampedInnerApoapsis * TRIPLE_STABILITY_RATIO <= outerPeriapsis) {
    return { innerSeparation: clampedInner, outerSeparation }
  }
  // 2단계: inner가 하한에 걸리면 outer를 임계까지 밀어올린다.
  const requiredOuter = (clampedInnerApoapsis * TRIPLE_STABILITY_RATIO) / (1 - outerEccentricity)
  return { innerSeparation: clampedInner, outerSeparation: requiredOuter }
}

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

  // 삼중성 안정성 클램프 (O-8) — draw는 전부 소비된 뒤 출력만 결정론적으로 재매핑한다
  // (블랙홀 단일성계 보정과 같은 패턴: RNG 스트림·다른 draw 불변).
  const inner = companions[0]
  const outer = companions[1]
  if (multiplicity === 'triple' && inner != null && outer != null) {
    const stable = clampTripleStability(
      inner.separation,
      inner.eccentricity,
      outer.separation,
      outer.eccentricity,
    )
    return [
      { ...inner, separation: stable.innerSeparation },
      { ...outer, separation: stable.outerSeparation },
    ]
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
    // ── append (GEN_VERSION 4): 다중성 — 위 4 draw 값은 보존된다.
    //    v11(M-4): 가중치가 분광형 종속으로 바뀌었지만 weighted()는 next() 1회 고정 소비. ──
    const multiplicity = starRng.weighted(MULTIPLICITY_WEIGHTS_BY_SPECTRAL[spectral])
    const companions = drawCompanions(starRng, multiplicity, spectral)
    // ── append (GEN_VERSION 5): 이색 천체 kind — 위 draw 값은 모두 보존된다.
    //    companions가 가변 draw를 소비해도 kind는 항상 그 뒤 마지막 draw다 (append-only).
    const kind = starRng.weighted(KIND_WEIGHTS_BY_SPECTRAL[spectral])
    // 블랙홀은 단일성계 (GEN_VERSION 6): 동반성이 강착원반·렌즈와 겹쳐 부자연스럽고 앞 통과 시
    // 빛이 맺히는 문제 (사용자 피드백 2026-06-16). draw는 그대로 소비(append-only·RNG 스트림 불변)하고
    // 출력만 단일로 덮어쓴다 → 다른 별·다른 draw 무영향, 블랙홀 별의 multiplicity/companions만 바뀐다.
    const isBlackHole = kind === 'black_hole'
    const finalMultiplicity: Multiplicity = isBlackHole ? 'single' : multiplicity
    const finalCompanions: readonly Companion[] = isBlackHole ? [] : companions
    // name은 별도 'name' 스트림이라 위 append와 순서 무관 (스트림 격리)
    const name = starName(rngFor(seed, 'name', id))

    stars.push({
      id,
      sector,
      localPos,
      spectral,
      name,
      multiplicity: finalMultiplicity,
      companions: finalCompanions,
      kind,
    })
  }
  return stars
}
