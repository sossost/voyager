import type { SpectralClass } from '@/engine'
import { HZ_CENTER_AU, HZ_X_PLATEAU_INNER, HZ_X_PLATEAU_OUTER } from '@/engine'

/**
 * 궤도 위치의 온도대 — 행성 표면 재질(용암/온대/얼음, 가스 조성)을 정하는 단일 분류.
 * 경계는 거주성 곡선의 평지 경계(HZ_X_PLATEAU_*)를 그대로 쓴다 (물리-시각 일치, hz-visualization).
 */
export type TemperatureZone = 'scorching' | 'habitable' | 'frozen'

/** 정규화 궤도 x = 실제 궤도(AU) / HZ 중심(AU). x=1이 HZ 중심. */
export function normalizedOrbit(orbitAu: number, spectral: SpectralClass): number {
  return orbitAu / HZ_CENTER_AU[spectral]
}

/**
 * 정규화 궤도 x의 온도대 분류 — (암석형) 표면 온도 재질 경계.
 * 작열 x<0.85 / 거주가능 0.85≤x≤1.3 / 동결 x>1.3.
 */
export function temperatureZoneAt(x: number): TemperatureZone {
  if (x < HZ_X_PLATEAU_INNER) return 'scorching'
  if (x <= HZ_X_PLATEAU_OUTER) return 'habitable'
  return 'frozen'
}

/**
 * 가스행성 Sudarsky 온도 클래스 (고온→저온). 실제 외계 가스행성 분류.
 * 이 모델에선 평형온도 T ∝ x^(−1/2) 라 정규화 궤도 x가 곧 온도 → x 임계로 클래스가 갈린다.
 *   silicate(V) 규산/철 구름 최고온 · alkali(IV) 알칼리금속 고온 · cloudless(III) 무운 감청 ·
 *   water(II) 수운 백색 · ammonia(I) 암모니아 목성형 저온.
 */
export type GasClass = 'silicate' | 'alkali' | 'cloudless' | 'water' | 'ammonia'

// x 임계 — Sudarsky 온도 경계를 T ∝ x^(−1/2)로 환산한 근사(시각 튜닝 대상).
const GAS_X_SILICATE = 0.25
const GAS_X_ALKALI = 0.6
const GAS_X_CLOUDLESS = 1.15
const GAS_X_WATER = 2.5

export function gasClassOf(x: number): GasClass {
  if (x < GAS_X_SILICATE) return 'silicate'
  if (x < GAS_X_ALKALI) return 'alkali'
  if (x < GAS_X_CLOUDLESS) return 'cloudless'
  if (x < GAS_X_WATER) return 'water'
  return 'ammonia'
}
