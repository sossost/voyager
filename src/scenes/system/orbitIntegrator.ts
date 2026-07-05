import { Vector3 } from 'three'

/**
 * 다중성계 행성 궤도 적분기 — test-particle 제한 3체 (multi-star-gravity N-1).
 *
 * 별들은 해석적 궤도(bodyPositions)를 유지하고, 행성만 그 움직이는 별들의 실제 중력
 * 합력을 받아 velocity-Verlet(심플렉틱)로 적분한다. 단일 중심은 닫힌 해가 정답이라
 * 이 경로를 타지 않는다 — 여긴 다중성계 전용 ("하나의 물리법칙, 두 개의 solver").
 *
 * 순수 모듈 — 브라우저 API·R3F 의존 없음. 렌더 파생이라 GEN_VERSION·저장·골든 무관.
 * 좌표는 질량중심(원점) 상대. 호출자(CurrentSystem)가 고정 타임스텝으로 구동한다.
 */

/** 중력 상수 (렌더 유닛) — 시각 튜닝값. G질량(1)이 최내곽 궤도(≈13)에서 기존 각속도와 대략 일치. */
export const G_RENDER = 100
/** 고정 적분 타임스텝(초) — fps와 무관한 결정론적 궤적을 위한 substep 간격. */
export const SIM_DT = 1 / 120
/** 프레임당 최대 substep — 장시간 히치 후 death spiral 방지 (초과분은 호출자가 스냅). */
export const MAX_SUBSTEPS_PER_FRAME = 8

/** Plummer softening 길이(렌더 유닛) — 근접 시 1/r² 발산 방지. */
const SOFTENING = 2
const SOFTENING_SQ = SOFTENING * SOFTENING
/** 유계 클램프 — 홈 반경 대비 상/하한. 정상 circumbinary는 미발동, 병리적 config 안전망. */
const BOUND_MAX = 1.6
const BOUND_MIN = 0.5

/**
 * 중력원(별) — 현재 위치와 상대 질량. `position`은 호출자의 스크래치 슬롯을 가리키는 *라이브
 * 별칭*일 수 있다(CurrentSystem이 매 substep 갱신). 적분 중 좌표를 복사·캐시하지 말 것.
 */
export interface Attractor {
  readonly position: Vector3
  readonly mass: number
}

/** 행성 궤도 상태 — 원점(질량중심) 상대. home = 시드 반경, floor = 하드 최소 반경(성단 밖). */
export interface PlanetOrbitState {
  readonly pos: Vector3
  readonly vel: Vector3
  home: number
  floor: number
}

/** 새 궤도 상태 슬롯 생성 (재사용용 — useFrame에서 매 프레임 할당 금지). */
export function createOrbitState(): PlanetOrbitState {
  return { pos: new Vector3(), vel: new Vector3(), home: 0, floor: 0 }
}

/**
 * 원궤도 초기조건 시드 — pos = R·(cosθ,0,sinθ), vel = √(gm/R)·(−sinθ,0,cosθ).
 * 방향은 closed-form planetOrbitPosition과 같은 CCW라 단일성계와 회전 방향이 일치한다.
 * gm = G_RENDER × Σ(항성 질량). 이후 실제 중력이 세차·섭동을 더한다.
 * floor = 절대 하한 반경(성단 밖) — 병리적 섭동에도 별 관통을 막는 하드 안전망 (기본 0).
 */
export function seedCircularOrbit(
  state: PlanetOrbitState,
  radius: number,
  phaseAngle: number,
  gm: number,
  floor = 0,
): void {
  const cos = Math.cos(phaseAngle)
  const sin = Math.sin(phaseAngle)
  const speed = radius > 0 ? Math.sqrt(gm / radius) : 0
  state.pos.set(cos * radius, 0, sin * radius)
  state.vel.set(-sin * speed, 0, cos * speed)
  state.home = radius
  state.floor = floor
}

// useFrame 재사용 스크래치 — 모듈 단일 인스턴스(중첩 호출 없음: 스텝은 순차 실행).
const accel0 = new Vector3()
const accel1 = new Vector3()
const diff = new Vector3()
const radialHat = new Vector3()

/** 위치 pos에서 받는 중력 가속도를 out에 채운다 (Plummer softening 포함). */
function accelerationInto(out: Vector3, pos: Vector3, attractors: readonly Attractor[]): void {
  out.set(0, 0, 0)
  for (const attractor of attractors) {
    diff.copy(attractor.position).sub(pos)
    const distSq = diff.lengthSq() + SOFTENING_SQ
    const invDist = 1 / Math.sqrt(distSq)
    const invDistCubed = invDist * invDist * invDist
    out.addScaledVector(diff, G_RENDER * attractor.mass * invDistCubed)
  }
}

/**
 * 유계 클램프 — 홈 반경의 [BOUND_MIN, BOUND_MAX] 밖으로 나가면 그 반경으로 당기고,
 * 이탈을 악화시키는 반경 속도 성분을 제거한다. 정상 궤도는 범위 안이라 무영향.
 */
function applyBound(state: PlanetOrbitState): void {
  const r = state.pos.length()
  if (r === 0) return
  const maxR = state.home * BOUND_MAX
  // 하한은 홈 비율과 하드 플로어(성단 밖) 중 큰 값 — 병리적 다이브도 별 관통 전에 막는다.
  const minR = Math.max(state.home * BOUND_MIN, state.floor)
  const outOfMax = r > maxR
  const targetR = outOfMax ? maxR : r < minR ? minR : null
  if (targetR == null) return

  state.pos.multiplyScalar(targetR / r)
  radialHat.copy(state.pos).normalize()
  const radialSpeed = state.vel.dot(radialHat)
  const worsening = outOfMax ? radialSpeed > 0 : radialSpeed < 0
  if (worsening) state.vel.addScaledVector(radialHat, -radialSpeed)
}

/**
 * velocity-Verlet 1스텝 — attractors는 이 substep 동안 고정으로 취급한다(dt가 작아
 * 무시 가능한 근사, 심플렉틱 안정성 유지). 스텝 후 유계 클램프.
 */
export function stepOrbit(
  state: PlanetOrbitState,
  attractors: readonly Attractor[],
  dt: number,
): void {
  accelerationInto(accel0, state.pos, attractors)
  // pos += v·dt + ½·a₀·dt²
  state.pos.addScaledVector(state.vel, dt).addScaledVector(accel0, 0.5 * dt * dt)
  accelerationInto(accel1, state.pos, attractors)
  // v += ½·(a₀ + a₁)·dt
  state.vel.addScaledVector(accel0, 0.5 * dt).addScaledVector(accel1, 0.5 * dt)
  applyBound(state)
}
