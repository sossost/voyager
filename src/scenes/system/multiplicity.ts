import { Vector3 } from 'three'

import type { Companion, SpectralClass, Star, StarKind } from '@/engine'
import { uniqueSystemOf } from '@/engine'
import { kindRadiusFactor, PULSAR_DISK_OUTER_FACTOR } from '@/scenes/system/exotic'
import { G_RENDER } from '@/scenes/system/orbitIntegrator'

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
/**
 * 조석 원궤도화 (P-1 ④/O-21) — 근접 쌍성은 조석 소산으로 이심률이 0으로 감쇠한다
 * (Meibom & Mathieu 2005: 오래된 성단의 원궤도화 한계 주기 ≈10일). 게임 separation은
 * 추상 단위지만 근접 쌍(계층형 inner 0.8~2.5) 영역이 실제 원궤도화 영역과 대응하므로,
 * TIDAL_CIRC_SEP 이하 완전 원, TIDAL_FREE_SEP 이상 원래 이심률로 선형 램프한다.
 */
const TIDAL_CIRC_SEP = 1.2
const TIDAL_FREE_SEP = 2.5
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
/** 항성풍 포획 원반(아케론) 외곽 배수 — CurrentSystem WIND_DISK_OUTER_FACTOR와 일치. */
const WIND_BH_DISK_FACTOR = 11

/**
 * 주성의 충돌·궤도 회피 유효 반경 — 블랙홀은 강착원반 외곽까지. 아케론(disk_bh)은 원반이
 * 작아(rs×11) 반성이 더 가까이 돌 수 있다 — 원반 크기와 클리어런스의 단일 정합.
 * 펄서는 자기권 소용돌이 외곽(PULSAR_DISK_OUTER_FACTOR)까지 — 본체 반경만 쓰면 근접
 * 동반성이 소용돌이 난류 안에 박혀 보인다 (README 펄서 스샷 피드백 2026-07-11).
 */
function primaryClearance(star: Star): number {
  const visual = renderedRadius(star.spectral, true, star.kind)
  if (star.kind === 'pulsar') return visual * PULSAR_DISK_OUTER_FACTOR
  if (star.kind !== 'black_hole') return visual
  const diskFactor =
    uniqueSystemOf(star.id)?.id === 'disk_bh' ? WIND_BH_DISK_FACTOR : BLACK_HOLE_DISK_FACTOR
  return visual * diskFactor
}

/**
 * 유니크 BH계 공전 감속 — 전시(도감) 목적의 정박 계라 차분한 공전이 읽기 좋다.
 * 행성이 없어(planetsOf 빈 배열) 중력 적분·케플러 정합(P-1)과 결합하지 않는 렌더 전용
 * 스타일화 — 스트림·조석 방향도 같은 bodyPositions를 읽으므로 자동 동기.
 */
const UNIQUE_ORBIT_TIME_SCALE = 0.4

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

/**
 * 렌더 이심률 — 생성 이심률 × 시각 축소(ECC_RENDER_FACTOR) × 조석 원궤도화 램프.
 * bodyPositions·coronaMaxRadii·stellarClearanceRadius가 반드시 이 단일 값을 공유해야
 * 근점 해석(코로나 클램프·충돌 하한)이 실제 궤도와 일치한다.
 */
function renderEccentricity(companion: Companion): number {
  const tidalRamp = Math.min(
    1,
    Math.max(0, (companion.separation - TIDAL_CIRC_SEP) / (TIDAL_FREE_SEP - TIDAL_CIRC_SEP)),
  )
  return companion.eccentricity * ECC_RENDER_FACTOR * tidalRamp
}

/**
 * 평균 운동 n = √(G·M/a³) (케플러 3법칙, P-1 ③) — 행성 적분기와 같은 G_RENDER·질량을 써서
 * 별 궤도와 행성이 받는 중력이 하나의 물리로 정합한다. 이 정합 덕에 seedLocalCircularOrbit의
 * 강제 이심률이 "올바른 별 운동에 대한 올바른 동역학 반응"이 된다 (PR #40 후속).
 */
export function meanMotion(totalMass: number, semiMajor: number): number {
  return Math.sqrt((G_RENDER * totalMass) / (semiMajor * semiMajor * semiMajor))
}

/**
 * 케플러 방정식 E − e·sinE = M 뉴턴 해 (케플러 2법칙, P-1 ②) — 등각속도 대신 이심근점이각을
 * 풀어 근점에서 빨라지는 실제 궤도 속도를 얻는다. 렌더 이심률 상한(0.24)에서 4회면 기계
 * 정밀도 수렴. 렌더 레이어라 초월함수 허용 — engine/ 순수성과 무관.
 */
const KEPLER_NEWTON_ITERATIONS = 4
export function solveEccentricAnomaly(meanAnomaly: number, eccentricity: number): number {
  let anomaly = meanAnomaly + eccentricity * Math.sin(meanAnomaly)
  for (let i = 0; i < KEPLER_NEWTON_ITERATIONS; i++) {
    anomaly -=
      (anomaly - eccentricity * Math.sin(anomaly) - meanAnomaly) /
      (1 - eccentricity * Math.cos(anomaly))
  }
  return anomaly
}

/**
 * 단위 반장축(a=1) 타원의 초점(질량중심) 상대 좌표 — 근점이 +x축.
 * x = cosE − e, z = √(1−e²)·sinE. useFrame 무할당을 위해 모듈 스크래치에 쓴다
 * (중첩 호출 없음 — bodyPositions 내 레벨별 순차 사용).
 */
const unitOrbit = { x: 0, z: 0 }
function unitOrbitAt(
  elapsed: number,
  phase: number,
  eccentricity: number,
  totalMass: number,
  semiMajor: number,
): void {
  const mean = phase * FULL_TURN + elapsed * meanMotion(totalMass, semiMajor)
  const eccAnomaly = solveEccentricAnomaly(mean, eccentricity)
  unitOrbit.x = Math.cos(eccAnomaly) - eccentricity
  unitOrbit.z = Math.sqrt(1 - eccentricity * eccentricity) * Math.sin(eccAnomaly)
}

/**
 * 시간 t의 각 별 위치(원점 = inner barycenter 상대)를 out에 채운다.
 * out[0]=주성, out[1..]=companions 순서. 반환값 = 채운 개수.
 * 할당을 피하려고 out(길이 ≥ bodyCount)을 재사용한다 (useFrame 규율).
 *
 * 질량중심 보존: 두 별은 같은 이심근점이각 E를 공유하고 반대편에 위치하며
 * 반장축이 질량 반비례(a1·m1 = a2·m2)라 m₁r₁ + m₂r₂ = 0 이 항상 성립한다.
 * 궤도 운동학은 케플러 정합(P-1): 평균 운동 √(GM/a³) + 케플러 방정식 해(근점 가속).
 */
export function bodyPositions(star: Star, elapsed: number, out: readonly Vector3[]): number {
  // 유니크 BH계는 감속 시계 — 모든 소비자(별 렌더·스트림·조석 방향)가 이 함수를 거치므로
  // 여기 한 곳만 스케일하면 자동 동기된다 (UNIQUE_ORBIT_TIME_SCALE 주석 참조).
  const orbitElapsed =
    uniqueSystemOf(star.id) != null ? elapsed * UNIQUE_ORBIT_TIME_SCALE : elapsed
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
    const eccEff = renderEccentricity(companion)
    // 블랙홀이면 디스크 외곽까지 비우는 유효 반경(primaryClearance)을 써 동반성이 디스크 밖에서 공전.
    const rPrimary = primaryClearance(star)
    const rCompanion = renderedRadius(companion.spectral, false)
    const aTotal = pairSemiMajor(companion.separation, rPrimary, rCompanion, eccEff)
    const aPrimary = (aTotal * companionMass) / totalMass
    const aCompanion = (aTotal * primaryMass) / totalMass
    unitOrbitAt(orbitElapsed, companion.phase, eccEff, totalMass, aTotal)
    out[0]?.set(-unitOrbit.x * aPrimary, 0, -unitOrbit.z * aPrimary)
    out[1]?.set(unitOrbit.x * aCompanion, 0, unitOrbit.z * aCompanion)
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
  const eccInnerEff = renderEccentricity(inner)
  const rPrimary = primaryClearance(star)
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
  // 외부 평균 운동은 세 별 총질량 기준 — 계층형 근사(inner 쌍 = 점질량).
  const eccOuterEff = renderEccentricity(outer)
  const rOuterBody = renderedRadius(outer.spectral, false)
  const aTotalOuter = pairSemiMajor(outer.separation, innerPairExtent, rOuterBody, eccOuterEff)
  const totalOuterMass = innerPairMass + outerMass
  const aBi = (aTotalOuter * outerMass) / totalOuterMass
  const aOuter = (aTotalOuter * innerPairMass) / totalOuterMass
  unitOrbitAt(orbitElapsed, outer.phase, eccOuterEff, totalOuterMass, aTotalOuter)
  const biX = -unitOrbit.x * aBi
  const biZ = -unitOrbit.z * aBi
  const oX = unitOrbit.x * aOuter
  const oZ = unitOrbit.z * aOuter

  unitOrbitAt(orbitElapsed, inner.phase, eccInnerEff, innerPairMass, aTotalInner)
  out[0]?.set(biX - unitOrbit.x * aPrimary, 0, biZ - unitOrbit.z * aPrimary)
  out[1]?.set(biX + unitOrbit.x * aInner, 0, biZ + unitOrbit.z * aInner)
  out[2]?.set(oX, 0, oZ)
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
  const rPrimary = primaryClearance(star)

  if (star.multiplicity === 'binary') {
    const companion = star.companions[0]
    if (companion == null) return [Infinity]
    const eccEff = renderEccentricity(companion)
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
    const eccInnerEff = renderEccentricity(inner)
    const rInnerBody = renderedRadius(inner.spectral, false)
    const aTotalInner = pairSemiMajor(inner.separation, rPrimary, rInnerBody, eccInnerEff)
    const aPrimary = (aTotalInner * massOf(inner.spectral)) / innerPairMass
    const aInner = (aTotalInner * primaryMass) / innerPairMass
    const innerPairExtent = Math.max(
      aPrimary * (1 + eccInnerEff) + rPrimary,
      aInner * (1 + eccInnerEff) + rInnerBody,
    )
    const eccOuterEff = renderEccentricity(outer)
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
  const rPrimary = primaryClearance(star)

  if (star.multiplicity === 'binary') {
    const companion = star.companions[0]
    if (companion == null) return rPrimary
    const eccEff = renderEccentricity(companion)
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
    const eccInnerEff = renderEccentricity(inner)
    const rInnerBody = renderedRadius(inner.spectral, false)
    const aTotalInner = pairSemiMajor(inner.separation, rPrimary, rInnerBody, eccInnerEff)
    const aPrimary = (aTotalInner * massOf(inner.spectral)) / innerPairMass
    const aInner = (aTotalInner * primaryMass) / innerPairMass
    const innerPairExtent = Math.max(
      aPrimary * (1 + eccInnerEff) + rPrimary,
      aInner * (1 + eccInnerEff) + rInnerBody,
    )
    const eccOuterEff = renderEccentricity(outer)
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
 * Holman & Wiegert 1999 P-type(circumbinary) 안정 임계 반경 계수 —
 * a_c/a_bin = 1.60 + 5.10e − 2.22e² + 4.12μ − 4.27eμ − 5.09μ² + 4.61e²μ² (Table 7 피팅).
 * 이 반경 안쪽 행성은 쌍성 공명·카오스 킥으로 수 궤도 내 이탈한다 — P-1 케플러 정합으로
 * 별이 실제 속도로 돌자 이 불안정이 렌더에서 실제로 발현(클램프 충돌 = 궤도 꺾임)됐다.
 */
function holmanWiegertFactor(ecc: number, massRatio: number): number {
  return (
    1.6 +
    5.1 * ecc -
    2.22 * ecc * ecc +
    4.12 * massRatio -
    4.27 * ecc * massRatio -
    5.09 * massRatio * massRatio +
    4.61 * ecc * ecc * massRatio * massRatio
  )
}

/** 피팅 오차(±4~11%)·강제 이심률 여유 마진. */
const STABLE_ORBIT_MARGIN = 1.1

/**
 * P-type 행성 안정 하한 반경 (렌더 유닛) — 최외곽 쌍(binary는 그 쌍, triple은 외부 레벨)의
 * 렌더 반장축·이심률·질량비로 Holman–Wiegert 임계를 구한다. bodyPositions와 동일한
 * pairSemiMajor·renderEccentricity를 쓰므로 화면에 보이는 궤도 기준의 정확한 경계다.
 * 단일성은 0 (케플러 닫힌 해 — 불안정 없음).
 */
export function stableOrbitFloor(star: Star): number {
  const primaryMass = massOf(star.spectral)
  const rPrimary = primaryClearance(star)

  if (star.multiplicity === 'binary') {
    const companion = star.companions[0]
    if (companion == null) return 0
    const companionMass = massOf(companion.spectral)
    const eccEff = renderEccentricity(companion)
    const rCompanion = renderedRadius(companion.spectral, false)
    const aTotal = pairSemiMajor(companion.separation, rPrimary, rCompanion, eccEff)
    const massRatio = companionMass / (primaryMass + companionMass)
    return STABLE_ORBIT_MARGIN * aTotal * holmanWiegertFactor(eccEff, massRatio)
  }

  if (star.multiplicity === 'triple') {
    const inner = star.companions[0]
    const outer = star.companions[1]
    if (inner == null || outer == null) return 0
    const innerPairMass = primaryMass + massOf(inner.spectral)
    const eccInnerEff = renderEccentricity(inner)
    const rInnerBody = renderedRadius(inner.spectral, false)
    const aTotalInner = pairSemiMajor(inner.separation, rPrimary, rInnerBody, eccInnerEff)
    const aPrimary = (aTotalInner * massOf(inner.spectral)) / innerPairMass
    const aInner = (aTotalInner * primaryMass) / innerPairMass
    const innerPairExtent = Math.max(
      aPrimary * (1 + eccInnerEff) + rPrimary,
      aInner * (1 + eccInnerEff) + rInnerBody,
    )
    const eccOuterEff = renderEccentricity(outer)
    const rOuterBody = renderedRadius(outer.spectral, false)
    const aTotalOuter = pairSemiMajor(outer.separation, innerPairExtent, rOuterBody, eccOuterEff)
    const outerMass = massOf(outer.spectral)
    const massRatio = outerMass / (innerPairMass + outerMass)
    return STABLE_ORBIT_MARGIN * aTotalOuter * holmanWiegertFactor(eccOuterEff, massRatio)
  }

  return 0
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
