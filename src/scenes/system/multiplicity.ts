import { Vector3 } from 'three'

import type { SpectralClass, Star } from '@/engine'

/**
 * 다중성계 렌더 수학 — 질량 룩업·질량중심 공전·circumbinary 판정 (binary-stars 결정 9).
 *
 * 엔진은 raw 파라미터(separation·eccentricity·phase)만 생성한다. 질량·궤도 스케일·
 * 임계값은 모두 이 렌더 레이어의 관심사다. 공전각은 elapsed 시간 함수라 결정론·
 * GEN_VERSION과 무관하다. 좌표는 systemGroup 원점(= inner barycenter) 상대.
 */

/** 분광형별 상대 질량 — 질량중심 분할·시각 반경·광도 보정에 쓰는 근사값. */
export const SPECTRAL_MASS: Readonly<Record<SpectralClass, number>> = {
  O: 16,
  B: 8,
  A: 2,
  F: 1.3,
  G: 1,
  K: 0.7,
  M: 0.3,
}

export function massOf(spectral: SpectralClass): number {
  return SPECTRAL_MASS[spectral]
}

/** 추상 separation(AU-유사) → 렌더 유닛 변환. (CurrentSystem ORBIT_SCALE=6과 균형) */
const COMPANION_ORBIT_SCALE = 4
/** 이 분리거리(추상 AU) 미만이면 근접 → 행성이 질량중심을 공전(circumbinary). */
const CIRCUMBINARY_THRESHOLD = 5.5
/** 공전 각속도 기준(rad/s) — separation^1.5에 반비례(케플러 근사). */
const ORBIT_ANGULAR_BASE = 0.5
const FULL_TURN = Math.PI * 2

/** 동반성 시각 반경 — 주성 반경에 질량 세제곱근비를 곱하고 시각 균형을 위해 클램프. */
export function bodyVisualRadius(spectral: SpectralClass, baseRadius: number): number {
  const ratio = Math.cbrt(massOf(spectral) / massOf('G'))
  const clamped = Math.min(Math.max(ratio, 0.5), 1.8)
  return baseRadius * clamped
}

/** 동반성 광도 보정 계수 — 질량 제곱근비 클램프 (Phase 5 튜닝 대상). */
export function bodyLightFactor(spectral: SpectralClass): number {
  const ratio = Math.sqrt(massOf(spectral) / massOf('G'))
  return Math.min(Math.max(ratio, 0.35), 1.5)
}

/**
 * 행성 궤도 중심을 질량중심(원점)에 둘지 여부.
 * 근접 쌍성·삼중성 → 질량중심 공전(circumbinary). 원거리 쌍성 → 주성 추종(S-type).
 */
export function isCircumbinary(star: Star): boolean {
  if (star.multiplicity === 'single') return false
  if (star.multiplicity === 'triple') return true
  const separation = star.companions[0]?.separation ?? Number.POSITIVE_INFINITY
  return separation < CIRCUMBINARY_THRESHOLD
}

/** 별 개수 = 주성 1 + 동반성. (out 배열 사전 할당 크기 산정용) */
export function bodyCount(star: Star): number {
  return 1 + star.companions.length
}

/** 타원 극형식 반경 — 초점(질량중심)에서의 거리. r(θ)=a(1-e²)/(1+e·cosθ). */
function ellipseRadius(semiMajor: number, eccentricity: number, theta: number): number {
  return (semiMajor * (1 - eccentricity * eccentricity)) / (1 + eccentricity * Math.cos(theta))
}

/**
 * 시간 t의 각 별 위치(원점 = inner barycenter 상대)를 out에 채운다.
 * out[0]=주성, out[1..]=companions 순서. 반환값 = 채운 개수.
 * 할당을 피하려고 out(길이 ≥ bodyCount)을 재사용한다 (useFrame 규율).
 *
 * 질량중심 보존: 두 별은 같은 진근점이각 θ를 공유하고 반대편에 위치하며
 * 반장축이 질량 반비례(a1·m1 = a2·m2)라 m₁r₁ + m₂r₂ = 0 이 항상 성립한다.
 */
export function bodyPositions(star: Star, elapsed: number, out: readonly Vector3[]): number {
  const primaryMass = massOf(star.spectral)

  if (star.multiplicity === 'single') {
    out[0]?.set(0, 0, 0)
    return 1
  }

  if (star.multiplicity === 'binary') {
    const companion = star.companions[0]
    if (companion == null) {
      out[0]?.set(0, 0, 0)
      return 1
    }
    const companionMass = massOf(companion.spectral)
    const totalMass = primaryMass + companionMass
    const aTotal = companion.separation * COMPANION_ORBIT_SCALE
    const aPrimary = (aTotal * companionMass) / totalMass
    const aCompanion = (aTotal * primaryMass) / totalMass
    const omega = ORBIT_ANGULAR_BASE / Math.pow(companion.separation, 1.5)
    const theta = companion.phase * FULL_TURN + elapsed * omega
    const rBase = ellipseRadius(1, companion.eccentricity, theta)
    const dirX = Math.cos(theta)
    const dirZ = Math.sin(theta)
    out[0]?.set(-dirX * aPrimary * rBase, 0, -dirZ * aPrimary * rBase)
    out[1]?.set(dirX * aCompanion * rBase, 0, dirZ * aCompanion * rBase)
    return 2
  }

  // triple — 계층형: 외부 레벨(inner쌍 ↔ outer)이 원점을, 내부 레벨(주성 ↔ inner)이 Bi를 공전.
  const inner = star.companions[0]
  const outer = star.companions[1]
  if (inner == null || outer == null) {
    out[0]?.set(0, 0, 0)
    return 1
  }
  const innerMass = massOf(inner.spectral)
  const outerMass = massOf(outer.spectral)
  const innerPairMass = primaryMass + innerMass

  // 외부 레벨 — inner 쌍의 질량중심(Bi)과 outer가 원점을 공전.
  const aTotalOuter = outer.separation * COMPANION_ORBIT_SCALE
  const totalOuterMass = innerPairMass + outerMass
  const aBi = (aTotalOuter * outerMass) / totalOuterMass
  const aOuter = (aTotalOuter * innerPairMass) / totalOuterMass
  const omegaOuter = ORBIT_ANGULAR_BASE / Math.pow(outer.separation, 1.5)
  const thetaOuter = outer.phase * FULL_TURN + elapsed * omegaOuter
  const rOuter = ellipseRadius(1, outer.eccentricity, thetaOuter)
  const oX = Math.cos(thetaOuter)
  const oZ = Math.sin(thetaOuter)
  const biX = -oX * aBi * rOuter
  const biZ = -oZ * aBi * rOuter

  // 내부 레벨 — 주성과 inner가 Bi를 공전.
  const aTotalInner = inner.separation * COMPANION_ORBIT_SCALE
  const aPrimary = (aTotalInner * innerMass) / innerPairMass
  const aInner = (aTotalInner * primaryMass) / innerPairMass
  const omegaInner = ORBIT_ANGULAR_BASE / Math.pow(inner.separation, 1.5)
  const thetaInner = inner.phase * FULL_TURN + elapsed * omegaInner
  const rInner = ellipseRadius(1, inner.eccentricity, thetaInner)
  const iX = Math.cos(thetaInner)
  const iZ = Math.sin(thetaInner)

  out[0]?.set(biX - iX * aPrimary * rInner, 0, biZ - iZ * aPrimary * rInner)
  out[1]?.set(biX + iX * aInner * rInner, 0, biZ + iZ * aInner * rInner)
  out[2]?.set(oX * aOuter * rOuter, 0, oZ * aOuter * rOuter)
  return 3
}
