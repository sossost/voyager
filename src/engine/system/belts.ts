import type { Seed, StarId } from '../coords'
import { starById } from '../galaxy/position'
import type { SpectralClass } from '../galaxy/sectors'
import { rngFor } from '../rng/streams'
import { planetsOf } from './planets'
import { SOL_STAR_ID, SOLAR_SYSTEM_BELTS } from './sol'

const INT32_MAX = 2_147_483_647

const NO_BELTS: readonly Belt[] = []

export type BeltKind = 'rocky' | 'kuiper'

/**
 * 소행성대 — 행성 사이(암석대) 또는 최외곽 행성 바깥(카이퍼대)의 파편 원반.
 *
 * 저장하지 않는다 (철칙 4) — (seed, starId)로 항상 재생성되는 순수 파생물. 위성과 동일하게
 * 전용 'belt' 스트림으로 완전 격리되어 기존 별·행성·외계 출력에 영향이 없다(GEN_VERSION 무관).
 * 개별 암석의 위치·크기는 densitySeed로 렌더 계층이 결정론적으로 산란한다 (게임플레이 무관).
 */
export interface Belt {
  readonly starId: StarId
  readonly index: number
  readonly kind: BeltKind
  /** 안쪽 경계 궤도 반경 (AU 근사) — 행성과 동일 스케일. */
  readonly innerAu: number
  /** 바깥쪽 경계 궤도 반경 (AU 근사). innerAu < outerAu. */
  readonly outerAu: number
  /** 렌더 인스턴스 산란 결정용 시드 — 게임플레이에는 영향 없음. */
  readonly densitySeed: number
}

/**
 * 동결선(frost line, AU 근사) — planets.ts kindWeightsAtIndex의 암석/가스 교차점(orbitAu≈2.8,
 * 실제 눈선 ~2.7AU)과 정렬한다. 이 안쪽은 휘발성 물질이 증발한 암석·금속 파편(암석대),
 * 바깥쪽은 얼음이 응결한 얼음 파편(카이퍼대)이 남는다. 여기선 벨트 종류·배치 판정에만 쓰고
 * 행성 생성(kindWeightsAtIndex)은 건드리지 않는다 — 그쪽을 바꾸면 출력 분포가 바뀐다(철칙 2).
 */
const FROST_LINE_AU = 2.7

/**
 * 잔해원반 검출률은 분광형에 강하게 의존한다 — 벨트 생성 확률을 실제 관측 빈도에 맞춘다(고증).
 *
 * 카이퍼대(차가운 잔해원반, cold debris disk): Herschel/DEBRIS 검출률 A26·F24·G19·K9.5·M1.3%
 * (Sibthorpe+ 2018 등). 분광형별로 이 표를 그대로 확률로 쓴다 — 카이퍼대는 궤도 공간이 늘 있어
 * 기하 게이트가 없으므로 생성률 ≈ 이 확률이다. O/B는 표본이 희소해 A형에 준한다.
 *
 * 암석대(따뜻한 잔해원반, warm debris disk ≈ 소행성대): 훨씬 드묾 — 태양형 24µm 초과 ~4%
 * (Spitzer). 아래 표는 "동결선 갭이 존재할 때"의 조건부 확률이라 관측 4%보다 높게 잡되(기하
 * 게이트가 추가로 걸러 최종 생성률이 관측값에 수렴), 실측 보정으로 맞춘 값이다.
 */
const KUIPER_PROBABILITY_BY_SPECTRAL: Record<SpectralClass, number> = {
  O: 0.22,
  B: 0.25,
  A: 0.26,
  F: 0.24,
  G: 0.19,
  K: 0.095,
  M: 0.013,
}
const MAIN_BELT_PROBABILITY_BY_SPECTRAL: Record<SpectralClass, number> = {
  O: 0.1,
  B: 0.1,
  A: 0.1,
  F: 0.1,
  G: 0.08,
  K: 0.04,
  M: 0.008,
}

/** 암석대 — 동결선을 품은 행성 간 갭에 생긴다 (화성–목성 메인벨트 유형). */
const MAIN_BELT_MIN_GAP_RATIO = 1.18
/**
 * 갭의 이 비율만큼 양쪽 행성에서 벨트를 물린다 — 이웃 궤도와 겹침 방지 + 폭을 좁혀
 * 인접 행성에 붙어 보이지 않게(압축 스케일에서 갭이 좁아 벨트가 꽉 차 보이는 것 완화).
 * 0.32 → 벨트는 갭의 가운데 36%만 차지한다.
 */
const MAIN_BELT_GAP_MARGIN = 0.32

/** 카이퍼대 — 최외곽 행성 바깥의 얼음 원반 (해왕성 바깥 유형). */
const KUIPER_INNER_FACTOR = 1.3
const KUIPER_WIDTH_FACTOR = 0.35

/**
 * 별 → 소행성대 목록 (0~2개: 암석대·카이퍼대 각 최대 1). 순수 함수 — 같은 (seed, starId)는
 * 항상 같은 벨트를 만든다. 행성 배치(planetsOf)에서 파생하되 draw는 전용 'belt' 스트림에서만.
 *
 * 스트림은 시스템당 고정 4 draw(암석 roll·seed, 카이퍼 roll·seed)를 소비한다 — 존재 여부와
 * 무관하게 항상 소비해, 향후 벨트 속성을 append해도 순서가 흔들리지 않는다(append-only, 철칙 3).
 * Sol은 RNG 스트림 분리된 예외 노드 — 실제 소행성대·카이퍼대 상수 반환.
 */
export function beltsOf(seed: Seed, starId: StarId): readonly Belt[] {
  if (starId === SOL_STAR_ID) return SOLAR_SYSTEM_BELTS

  const star = starById(seed, starId)
  if (star == null) return NO_BELTS
  const planets = planetsOf(seed, starId)
  if (planets.length === 0) return NO_BELTS

  const rng = rngFor(seed, 'belt', starId)
  // 고정 draw 순서 — 존재 판정 전에 전부 소비한다 (append-only 견고성).
  const mainRoll = rng.next()
  const mainDensitySeed = rng.int(INT32_MAX)
  const kuiperRoll = rng.next()
  const kuiperDensitySeed = rng.int(INT32_MAX)

  const belts: Belt[] = []

  const mainBelt = deriveMainBelt(star.spectral, starId, planets, mainRoll, mainDensitySeed, belts.length)
  if (mainBelt != null) belts.push(mainBelt)

  const kuiperBelt = deriveKuiperBelt(
    star.spectral,
    starId,
    planets,
    kuiperRoll,
    kuiperDensitySeed,
    belts.length,
  )
  if (kuiperBelt != null) belts.push(kuiperBelt)

  return belts.length === 0 ? NO_BELTS : belts
}

/**
 * 암석대 — 동결선(FROST_LINE_AU)이 관통하는 인접 행성 갭에 생긴다. 벨트는 물리적으로 눈선의
 * '빈 구간'에 자리하므로, 그런 갭이 있고 충분히 넓을 때(비율 임계)만 확률적으로 만든다.
 */
function deriveMainBelt(
  spectral: SpectralClass,
  starId: StarId,
  planets: readonly { readonly orbitAu: number }[],
  roll: number,
  densitySeed: number,
  index: number,
): Belt | null {
  if (roll >= MAIN_BELT_PROBABILITY_BY_SPECTRAL[spectral]) return null

  for (let i = 0; i < planets.length - 1; i++) {
    const innerAu = planets[i]!.orbitAu
    const outerAu = planets[i + 1]!.orbitAu
    const straddlesFrostLine = innerAu < FROST_LINE_AU && FROST_LINE_AU <= outerAu
    if (!straddlesFrostLine) continue
    if (outerAu / innerAu < MAIN_BELT_MIN_GAP_RATIO) return null

    const gap = outerAu - innerAu
    return {
      starId,
      index,
      kind: 'rocky',
      innerAu: innerAu + gap * MAIN_BELT_GAP_MARGIN,
      outerAu: outerAu - gap * MAIN_BELT_GAP_MARGIN,
      densitySeed,
    }
  }
  return null
}

/** 카이퍼대 — 최외곽 행성 바깥의 얼음 파편 원반. 궤도 공간은 항상 있으므로 확률로만 게이팅. */
function deriveKuiperBelt(
  spectral: SpectralClass,
  starId: StarId,
  planets: readonly { readonly orbitAu: number }[],
  roll: number,
  densitySeed: number,
  index: number,
): Belt | null {
  if (roll >= KUIPER_PROBABILITY_BY_SPECTRAL[spectral]) return null

  const outermostAu = planets.reduce((max, planet) => Math.max(max, planet.orbitAu), 0)
  const innerAu = outermostAu * KUIPER_INNER_FACTOR
  return {
    starId,
    index,
    kind: 'kuiper',
    innerAu,
    outerAu: innerAu + outermostAu * KUIPER_WIDTH_FACTOR,
    densitySeed,
  }
}
