import { Vector3 } from 'three'

import type { SpectralClass, Star, StarKind } from '@/engine'
import { kindRadiusFactor } from '@/scenes/system/exotic'

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

/** 주성 시각 반경 — CurrentSystem·SelectedStarMarker 공용 단일 소스. */
export const STAR_VISUAL_RADIUS = 3

/** 추상 separation(AU-유사) → 렌더 유닛 변환. (CurrentSystem ORBIT_SCALE=6과 균형) */
const COMPANION_ORBIT_SCALE = 3.2
/** 공전 각속도 기준(rad/s) — separation^1.5에 반비례(케플러 근사). */
const ORBIT_ANGULAR_BASE = 0.5
const FULL_TURN = Math.PI * 2

/**
 * 충돌 방지 튜닝 (사용자 피드백 2026-06-15 — 별/행성 관통).
 * 별 시각 반경(3)이 궤도 스케일 대비 커서, 가까운 쌍은 서로 관통하고 멀리 도는 별은
 * 행성 궤도를 가른다. 렌더에서 세 가지로 막는다:
 *  - 근점거리(periapsis)가 두 별 표면 사이 간격을 확보하도록 반장축에 하한.
 *  - 편심을 렌더에서 축소 — 근점 충돌 완화 (생성 편심은 보존, 시각만).
 *  - 별 군집 전체를 감싸는 반경을 구해 행성 궤도를 그만큼 바깥으로 민다.
 */
const ECC_RENDER_FACTOR = 0.4
const PAIR_SURFACE_GAP = 2.4
const MAX_PAIR_SEMIMAJOR = 11
/** 행성 최내곽 궤도 기준(orbitRadiusOf 최소 ≈ 8.6)보다 보수적으로 낮게 — 여유분. */
const FIRST_PLANET_REFERENCE = 8
const PLANET_CLEARANCE_MARGIN = 2.5

/** 동반성 시각 반경 — 주성 반경에 질량 세제곱근비를 곱하고 시각 균형을 위해 클램프. */
export function bodyVisualRadius(spectral: SpectralClass, baseRadius: number): number {
  const ratio = Math.cbrt(massOf(spectral) / massOf('G'))
  const clamped = Math.min(Math.max(ratio, 0.5), 1.8)
  return baseRadius * clamped
}

/**
 * 렌더 반경 — 주성은 STAR_VISUAL_RADIUS, 동반성은 질량비. 이색 천체(kind)는 종류별
 * 배수를 곱한다 (결정 12) — 적색거성 크게/백색왜성 작게. main_sequence는 ×1(기존 불변).
 * kind는 주성에만 존재하므로 동반성 호출은 기본값 main_sequence를 쓴다.
 * CurrentSystem의 시각 메시 반경과 **반드시 같은 식**을 써야 별/행성 관통이 없다.
 */
function renderedRadius(
  spectral: SpectralClass,
  isPrimary: boolean,
  kind: StarKind = 'main_sequence',
): number {
  const base = isPrimary ? STAR_VISUAL_RADIUS : bodyVisualRadius(spectral, STAR_VISUAL_RADIUS)
  return base * kindRadiusFactor(kind)
}

/** 블랙홀 강착원반 외곽 배수 — BlackHoleRayMarchEffect/CurrentSystem의 diskOuter(rs×18)와 일치. */
const BLACK_HOLE_DISK_FACTOR = 18

/**
 * 충돌·궤도 회피용 유효 반경. 블랙홀 주성은 *사건지평선*이 아니라 *강착원반 외곽*(rs×18)까지
 * 비워야 한다 — 안 그러면 동반성·행성이 디스크 안에서 도는 것처럼 보인다 (사용자 피드백 2026-06-16).
 * 시각 메시 반경(renderedRadius)과 별개의 "보이는 영향권" 개념. 렌더 전용 — GEN_VERSION 무관.
 */
function clearanceRadius(
  spectral: SpectralClass,
  isPrimary: boolean,
  kind: StarKind = 'main_sequence',
): number {
  const visual = renderedRadius(spectral, isPrimary, kind)
  if (isPrimary && kind === 'black_hole') return visual * BLACK_HOLE_DISK_FACTOR
  return visual
}

/**
 * 쌍의 반장축(질량중심 기준 두 별 중심 거리) — 표면 간격 확보 하한 + 군집 상한 클램프.
 * periapsis = aTotal·(1−eccEff) ≥ rA + rB + 간격 이 되도록 하한을 둔다.
 */
function pairSemiMajor(rawSep: number, rA: number, rB: number, eccEff: number): number {
  const raw = rawSep * COMPANION_ORBIT_SCALE
  const minSemi = (rA + rB + PAIR_SURFACE_GAP) / (1 - eccEff)
  // 비충돌(하한)이 군집 상한보다 우선한다.
  return Math.max(minSemi, Math.min(raw, MAX_PAIR_SEMIMAJOR))
}

/**
 * 행성 궤도 중심을 질량중심(원점)에 둘지 여부.
 * 다중성계는 모두 질량중심을 공전한다(circumbinary) — 행성은 항상 "쌍성 전체의 질량중심"
 * 기준 (사용자 피드백 2026-06-15, 결정 8 개정). 단일성은 주성=질량중심이라 동일.
 */
export function isCircumbinary(star: Star): boolean {
  return star.multiplicity !== 'single'
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
    const eccEff = companion.eccentricity * ECC_RENDER_FACTOR
    // 블랙홀이면 디스크 외곽까지 비우는 유효 반경(clearanceRadius)을 써 동반성이 디스크 밖에서 공전.
    const rPrimary = clearanceRadius(star.spectral, true, star.kind)
    const rCompanion = renderedRadius(companion.spectral, false)
    const aTotal = pairSemiMajor(companion.separation, rPrimary, rCompanion, eccEff)
    const aPrimary = (aTotal * companionMass) / totalMass
    const aCompanion = (aTotal * primaryMass) / totalMass
    const omega = ORBIT_ANGULAR_BASE / Math.pow(companion.separation, 1.5)
    const theta = companion.phase * FULL_TURN + elapsed * omega
    const rBase = ellipseRadius(1, eccEff, theta)
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

  // 내부 레벨 — 주성과 inner가 Bi를 공전 (먼저 풀어 inner 쌍의 외곽 반경을 구한다).
  const eccInnerEff = inner.eccentricity * ECC_RENDER_FACTOR
  const rPrimary = clearanceRadius(star.spectral, true, star.kind)
  const rInnerBody = renderedRadius(inner.spectral, false)
  const aTotalInner = pairSemiMajor(inner.separation, rPrimary, rInnerBody, eccInnerEff)
  const aPrimary = (aTotalInner * innerMass) / innerPairMass
  const aInner = (aTotalInner * primaryMass) / innerPairMass
  // inner 쌍이 Bi 둘레로 차지하는 반경 — 외부 별과의 비충돌 하한 계산에 쓴다.
  const innerPairExtent = Math.max(
    aPrimary * (1 + eccInnerEff) + rPrimary,
    aInner * (1 + eccInnerEff) + rInnerBody,
  )

  // 외부 레벨 — inner 쌍의 질량중심(Bi)과 outer가 원점을 공전. inner 쌍을 반경
  // innerPairExtent의 한 천체로 취급해 outer가 쌍을 가르지 않도록 한다.
  const eccOuterEff = outer.eccentricity * ECC_RENDER_FACTOR
  const rOuterBody = renderedRadius(outer.spectral, false)
  const aTotalOuter = pairSemiMajor(outer.separation, innerPairExtent, rOuterBody, eccOuterEff)
  const totalOuterMass = innerPairMass + outerMass
  const aBi = (aTotalOuter * outerMass) / totalOuterMass
  const aOuter = (aTotalOuter * innerPairMass) / totalOuterMass
  const omegaOuter = ORBIT_ANGULAR_BASE / Math.pow(outer.separation, 1.5)
  const thetaOuter = outer.phase * FULL_TURN + elapsed * omegaOuter
  const rOuter = ellipseRadius(1, eccOuterEff, thetaOuter)
  const oX = Math.cos(thetaOuter)
  const oZ = Math.sin(thetaOuter)
  const biX = -oX * aBi * rOuter
  const biZ = -oZ * aBi * rOuter

  const omegaInner = ORBIT_ANGULAR_BASE / Math.pow(inner.separation, 1.5)
  const thetaInner = inner.phase * FULL_TURN + elapsed * omegaInner
  const rInner = ellipseRadius(1, eccInnerEff, thetaInner)
  const iX = Math.cos(thetaInner)
  const iZ = Math.sin(thetaInner)

  out[0]?.set(biX - iX * aPrimary * rInner, 0, biZ - iZ * aPrimary * rInner)
  out[1]?.set(biX + iX * aInner * rInner, 0, biZ + iZ * aInner * rInner)
  out[2]?.set(oX * aOuter * rOuter, 0, oZ * aOuter * rOuter)
  return 3
}

/**
 * 별별 코로나 글로우 반폭 상한 — 가산 코로나 빌보드가 이웃 별 원반을 덮으면 뒤쪽 별에
 * 초승달 위상 착시(별에는 밤면이 없으므로 오류)가 생긴다. 각 별의 글로우 반경을
 * "이웃 별까지 최소 거리 − 이웃 별 반경"으로 클램프해 겹침을 원천 차단한다.
 *
 * 최소 거리는 렌더 궤도(bodyPositions와 동일 파라미터)의 근점에서 해석적으로 구한다:
 * 같은 쌍의 두 별은 근점에서 aTotal(1−eccEff), 삼중성 외부 별↔내부 쌍 멤버는 보수적
 * 하한 periOuter − memberApo. pairSemiMajor의 표면 간격 하한 덕에 결과는 항상 자기
 * 원반 반경 + PAIR_SURFACE_GAP 이상이라 글로우가 원반 아래로 줄지 않는다.
 * 반환 순서는 bodyPositions와 동일 [주성, ...동반성]. 단일성은 [Infinity](기존 불변).
 * 렌더 전용 — GEN_VERSION 무관.
 */
export function coronaMaxRadii(star: Star): number[] {
  const primaryMass = massOf(star.spectral)
  const rPrimary = clearanceRadius(star.spectral, true, star.kind)

  if (star.multiplicity === 'binary') {
    const companion = star.companions[0]
    if (companion == null) return [Infinity]
    const eccEff = companion.eccentricity * ECC_RENDER_FACTOR
    const rCompanion = renderedRadius(companion.spectral, false)
    const aTotal = pairSemiMajor(companion.separation, rPrimary, rCompanion, eccEff)
    const periapsis = aTotal * (1 - eccEff)
    return [periapsis - rCompanion, periapsis - rPrimary]
  }

  if (star.multiplicity === 'triple') {
    const inner = star.companions[0]
    const outer = star.companions[1]
    if (inner == null || outer == null) return [Infinity]
    const innerPairMass = primaryMass + massOf(inner.spectral)
    const eccInnerEff = inner.eccentricity * ECC_RENDER_FACTOR
    const rInnerBody = renderedRadius(inner.spectral, false)
    const aTotalInner = pairSemiMajor(inner.separation, rPrimary, rInnerBody, eccInnerEff)
    const aPrimary = (aTotalInner * massOf(inner.spectral)) / innerPairMass
    const aInner = (aTotalInner * primaryMass) / innerPairMass
    const innerPairExtent = Math.max(
      aPrimary * (1 + eccInnerEff) + rPrimary,
      aInner * (1 + eccInnerEff) + rInnerBody,
    )
    const eccOuterEff = outer.eccentricity * ECC_RENDER_FACTOR
    const rOuterBody = renderedRadius(outer.spectral, false)
    const aTotalOuter = pairSemiMajor(outer.separation, innerPairExtent, rOuterBody, eccOuterEff)
    // 내부 쌍 근점 — 두 멤버는 같은 θ를 공유하므로 정확한 최소 거리.
    const periInner = aTotalInner * (1 - eccInnerEff)
    // 외부 별 ↔ 내부 멤버 — 외부 근점에서 멤버가 Bi 반대편 최대 이각일 때의 보수적 하한.
    const periOuter = aTotalOuter * (1 - eccOuterEff)
    const minOuterToPrimary = periOuter - aPrimary * (1 + eccInnerEff)
    const minOuterToInner = periOuter - aInner * (1 + eccInnerEff)
    return [
      Math.min(periInner - rInnerBody, minOuterToPrimary - rOuterBody),
      Math.min(periInner - rPrimary, minOuterToInner - rOuterBody),
      Math.min(minOuterToPrimary - rPrimary, minOuterToInner - rInnerBody),
    ]
  }

  return [Infinity]
}

/**
 * 별 군집이 질량중심(원점)에서 닿는 최대 반경 — 가장 바깥 별의 원점거리(apoapsis) + 그 별 반경.
 * 행성 궤도를 이만큼 바깥으로 밀어 별/행성 관통을 막는다 (planetClearanceOffset). 다중성계 중력
 * 모드는 이 값의 배수를 P-type 안정 궤도·하드 플로어 기준으로 쓴다 (multi-star-gravity N-1).
 */
export function stellarClearanceRadius(star: Star): number {
  const primaryMass = massOf(star.spectral)
  const rPrimary = clearanceRadius(star.spectral, true, star.kind)

  if (star.multiplicity === 'binary') {
    const companion = star.companions[0]
    if (companion == null) return rPrimary
    const eccEff = companion.eccentricity * ECC_RENDER_FACTOR
    const rCompanion = renderedRadius(companion.spectral, false)
    const totalMass = primaryMass + massOf(companion.spectral)
    const aTotal = pairSemiMajor(companion.separation, rPrimary, rCompanion, eccEff)
    const primaryReach = (aTotal * massOf(companion.spectral)) / totalMass
    const companionReach = (aTotal * primaryMass) / totalMass
    return Math.max(
      primaryReach * (1 + eccEff) + rPrimary,
      companionReach * (1 + eccEff) + rCompanion,
    )
  }

  if (star.multiplicity === 'triple') {
    const inner = star.companions[0]
    const outer = star.companions[1]
    if (inner == null || outer == null) return rPrimary
    const innerPairMass = primaryMass + massOf(inner.spectral)
    const eccInnerEff = inner.eccentricity * ECC_RENDER_FACTOR
    const rInnerBody = renderedRadius(inner.spectral, false)
    const aTotalInner = pairSemiMajor(inner.separation, rPrimary, rInnerBody, eccInnerEff)
    const aPrimary = (aTotalInner * massOf(inner.spectral)) / innerPairMass
    const aInner = (aTotalInner * primaryMass) / innerPairMass
    const innerPairExtent = Math.max(
      aPrimary * (1 + eccInnerEff) + rPrimary,
      aInner * (1 + eccInnerEff) + rInnerBody,
    )
    const eccOuterEff = outer.eccentricity * ECC_RENDER_FACTOR
    const rOuterBody = renderedRadius(outer.spectral, false)
    const aTotalOuter = pairSemiMajor(outer.separation, innerPairExtent, rOuterBody, eccOuterEff)
    const totalOuterMass = innerPairMass + massOf(outer.spectral)
    const aBi = (aTotalOuter * massOf(outer.spectral)) / totalOuterMass
    const aOuter = (aTotalOuter * innerPairMass) / totalOuterMass
    return Math.max(
      aBi * (1 + eccOuterEff) + innerPairExtent, // inner 쌍이 Bi와 함께 닿는 최대 반경
      aOuter * (1 + eccOuterEff) + rOuterBody,
    )
  }

  return rPrimary
}

/**
 * 행성 궤도를 바깥으로 미는 양 — 최내곽 행성이 별 군집(또는 부푼 본체)을 벗어나도록.
 * CurrentSystem·Planet·PlanetCalloutProjector가 공유한다. stellarClearanceRadius가 kind 반경을
 * 이미 반영하므로 단일성계도 그대로 흐른다: 일반 단일 항성(반경 3)·백색왜성(≈1)·펄서(≈2.1)는
 * clearance ≤ FIRST_PLANET_REFERENCE라 0(기존 불변), **적색거성(반경 ≈7.5)만 양수 오프셋**이
 * 나와 첫 궤도를 본체 밖으로 밀어 "내행성을 삼킨" 배치를 만든다 (exotic-stars 결정 3).
 */
export function planetClearanceOffset(star: Star): number {
  const clearance = stellarClearanceRadius(star) + PLANET_CLEARANCE_MARGIN
  return Math.max(0, clearance - FIRST_PLANET_REFERENCE)
}
