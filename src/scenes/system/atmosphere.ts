import type { Planet } from '@/engine'
import { fract } from '@/scenes/shared/fract'
import type { GasClass } from '@/scenes/system/habitableZone'
import { gasClassOf, temperatureZoneAt } from '@/scenes/system/habitableZone'

/**
 * 행성 대기 산란 림 프로파일 — 대기를 가진 행성의 낮면 가장자리 산란 호를 정한다 (atmospheric-limb).
 *
 * 렌더 파생 순수 함수: 이미 생성된 데이터(kind·hasLife·온도대·paletteSeed)만으로 대기를 산출한다.
 * 새 RNG draw를 소비하지 않아 GEN_VERSION·골든·저장 포맷과 무관하다 (온도 표면재질·HZ와 같은 원칙).
 *
 * 색은 상징이 아니라 실제 대기 조성색: 파란 레일리(지구형)·Sudarsky 클래스색(가스)·백황 금성형.
 */
export type AtmosphereKind = 'none' | 'rayleigh' | 'venusian' | 'gas'

/** 셰이더 유니폼으로 넘어가는 대기 서술자. 색은 0..1 RGB. */
export interface AtmosphereProfile {
  readonly kind: AtmosphereKind
  /** 높은 고도 산란색 (림 상단) — 0..1 RGB. */
  readonly baseColor: readonly [number, number, number]
  /** 터미네이터 박명색 (그레이징 경로 적색화) — 0..1 RGB. */
  readonly warmColor: readonly [number, number, number]
  /** 시각 반경 대비 셸 배율 — 얇게 유지해야 '호'로 읽힌다 (오라 회귀 방지). */
  readonly shellScale: number
  /** 림 알파 세기. */
  readonly intensity: number
  /** 프레넬 지수 — 높을수록 가장자리에 집중 (오라 회귀 방지). */
  readonly rimPower: number
  /** 박명 적색화 강도 0..1 — 터미네이터에서 warmColor로 보간되는 정도. */
  readonly warmAmount: number
}

const NO_ATMOSPHERE: AtmosphereProfile = {
  kind: 'none',
  baseColor: [0, 0, 0],
  warmColor: [0, 0, 0],
  shellScale: 1,
  intensity: 0,
  rimPower: 1,
  warmAmount: 0,
}

/**
 * 지구형 파란 레일리 대기 — 높은각 파랑, 터미네이터로 갈수록 주황/적(박명).
 * 얇은 셸 + 높은 프레넬 지수로 실루엣 밖 얇은 호에 집중.
 */
const RAYLEIGH_ATMOSPHERE: AtmosphereProfile = {
  kind: 'rayleigh',
  baseColor: [0.32, 0.56, 1.0],
  warmColor: [1.0, 0.5, 0.22],
  shellScale: 1.025,
  intensity: 0.95,
  rimPower: 3.5,
  warmAmount: 0.85,
}

/**
 * 금성형 두꺼운 대기 — 백황 고알베도 헤이즈. 작열 암석 일부에 부여한다.
 * 대기가 두꺼워 셸이 약간 두껍고 프레넬은 덜 급격(넓은 호), 박명 적색화는 약하다(이미 따뜻).
 */
const VENUSIAN_ATMOSPHERE: AtmosphereProfile = {
  kind: 'venusian',
  baseColor: [0.95, 0.9, 0.68],
  warmColor: [1.0, 0.76, 0.42],
  shellScale: 1.035,
  intensity: 1.3,
  rimPower: 2.6,
  warmAmount: 0.4,
}

/** 작열 암석 중 금성형 대기를 받는 비율 — paletteSeed 해시로 결정론 선택. */
const VENUSIAN_FRACTION = 0.4
/** paletteSeed → [0,1) 해시용 배율 (무리수 근사로 시드별 고른 분포). */
const VENUSIAN_HASH_MULT = 0.026_312_1

/** hue 0~360, saturation/lightness 0~1 → RGB 0~1. gasStyleOf 색과 톤을 맞춘다. */
function hslToRgb01(hue: number, saturation: number, lightness: number): readonly [number, number, number] {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
  const huePrime = (((hue % 360) + 360) % 360) / 60
  const x = chroma * (1 - Math.abs((huePrime % 2) - 1))
  const m = lightness - chroma / 2

  let rgb: readonly [number, number, number]
  if (huePrime < 1) rgb = [chroma, x, 0]
  else if (huePrime < 2) rgb = [x, chroma, 0]
  else if (huePrime < 3) rgb = [0, chroma, x]
  else if (huePrime < 4) rgb = [0, x, chroma]
  else if (huePrime < 5) rgb = [x, 0, chroma]
  else rgb = [chroma, 0, x]

  return [rgb[0] + m, rgb[1] + m, rgb[2] + m]
}

/**
 * Sudarsky 온도 클래스별 가스행성 헤이즈 — 조성색이 그대로 대기색이다 (gasStyleOf와 동계열).
 * null(무HZ 별)은 온도 미상이라 seed 색상 목성형 헤이즈로 다양성을 유지한다.
 */
function gasAtmosphere(planet: Planet, gasClass: GasClass | null): AtmosphereProfile {
  // 셸은 표면에 밀착(≈암석 수준). 크게 띄우면 대기가 떨어져 뜬 '층'으로 보인다(사용자 지적).
  const base = { kind: 'gas' as const, shellScale: 1.028, intensity: 1.0, rimPower: 3.0 }
  switch (gasClass) {
    case 'silicate': // V 최고온 — 규산/철, 용암빛 적색 헤이즈
      return { ...base, baseColor: [1.0, 0.42, 0.2], warmColor: [1.0, 0.34, 0.14], warmAmount: 0.35 }
    case 'alkali': // IV 고온 — 알칼리 금속, 적갈 헤이즈
      return { ...base, baseColor: [0.92, 0.48, 0.3], warmColor: [1.0, 0.5, 0.24], warmAmount: 0.45 }
    case 'cloudless': // III 중고온 — 구름 없는 레일리 산란, 감청
      return { ...base, baseColor: [0.34, 0.55, 0.95], warmColor: [0.95, 0.55, 0.32], warmAmount: 0.7 }
    case 'water': // II 온대 — 수운, 밝은 백청 헤이즈
      return { ...base, baseColor: [0.85, 0.92, 1.0], warmColor: [1.0, 0.82, 0.58], warmAmount: 0.55 }
    case 'ammonia': // I 저온 — 암모니아, 황갈 목성형 헤이즈
      return { ...base, baseColor: [0.86, 0.72, 0.46], warmColor: [1.0, 0.66, 0.36], warmAmount: 0.4 }
    default: {
      // 무HZ — seed 색상 목성형 헤이즈 (gasStyleOf default와 같은 hue 소스)
      const hue = planet.paletteSeed % 360
      return {
        ...base,
        baseColor: hslToRgb01(hue, 0.55, 0.62),
        warmColor: hslToRgb01(hue - 20, 0.6, 0.5),
        warmAmount: 0.4,
      }
    }
  }
}

/**
 * 행성의 대기 산란 림 프로파일을 파생한다.
 *   - 가스: 항상 클래스색 헤이즈 (본질이 대기).
 *   - 생명/습윤 암석: 파란 레일리 호.
 *   - 작열 암석 일부(paletteSeed 해시): 금성형 백황 대기.
 *   - 그 외 암석(얼음·불모·비선택 용암): 대기 없음.
 *
 * @param hzOrbit 정규화 궤도 x (= 실제 궤도 / HZ 중심). null이면 온도 미상 (무HZ 별) —
 *   온도 의존 분류(금성형·가스 클래스)만 일반화하고 나머지는 유지한다.
 */
export function deriveAtmosphere(planet: Planet, hzOrbit: number | null): AtmosphereProfile {
  if (planet.kind === 'gas') {
    return gasAtmosphere(planet, hzOrbit == null ? null : gasClassOf(hzOrbit))
  }

  if (planet.hasLife) return RAYLEIGH_ATMOSPHERE

  const zone = hzOrbit == null ? null : temperatureZoneAt(hzOrbit)
  const isSelectedForVenusian = fract(planet.paletteSeed * VENUSIAN_HASH_MULT) < VENUSIAN_FRACTION
  if (zone === 'scorching' && isSelectedForVenusian) return VENUSIAN_ATMOSPHERE

  return NO_ATMOSPHERE
}
