import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'

import {
  type Attractor,
  createOrbitState,
  G_RENDER,
  seedCircularOrbit,
  seedLocalCircularOrbit,
  SIM_DT,
  stepOrbit,
} from './orbitIntegrator'

/** 원점 고정 단일 중력원 (케플러 문제 축약). */
function fixedAttractor(mass: number): Attractor {
  return { position: new Vector3(0, 0, 0), mass }
}

/** 원점 기준 특정 에너지 = ½v² − gm/r. 심플렉틱 적분은 이 값을 유계로 보존한다. */
function specificEnergy(pos: Vector3, vel: Vector3, gm: number): number {
  return 0.5 * vel.lengthSq() - gm / pos.length()
}

describe('orbitIntegrator', () => {
  describe('seedCircularOrbit', () => {
    it('위상 0에서 pos=(R,0,0), vel은 +z 방향(CCW) — closed-form과 회전 방향 일치', () => {
      const state = createOrbitState()
      const radius = 20
      seedCircularOrbit(state, radius, 0, G_RENDER * 1)

      expect(state.pos.x).toBeCloseTo(radius)
      expect(state.pos.z).toBeCloseTo(0)
      expect(state.vel.z).toBeGreaterThan(0) // +z 진행 = XZ 평면 CCW
      expect(state.vel.x).toBeCloseTo(0)
      expect(state.home).toBe(radius)
    })

    it('반경 0은 속도 0으로 안전 처리 (발산·NaN 없음)', () => {
      const state = createOrbitState()
      seedCircularOrbit(state, 0, 0, G_RENDER)
      expect(state.vel.length()).toBe(0)
      expect(Number.isNaN(state.pos.x)).toBe(false)
    })
  })

  describe('원궤도 안정성 (단일 중력원)', () => {
    it('시드된 원궤도는 여러 바퀴 동안 반경을 ~일정하게 유지한다', () => {
      const state = createOrbitState()
      const radius = 30
      const gm = G_RENDER * 2
      seedCircularOrbit(state, radius, 0, gm)
      const attractors = [fixedAttractor(2)]

      let minR = Infinity
      let maxR = -Infinity
      for (let i = 0; i < 4000; i++) {
        stepOrbit(state, attractors, SIM_DT)
        const r = state.pos.length()
        minR = Math.min(minR, r)
        maxR = Math.max(maxR, r)
        expect(Number.isNaN(r)).toBe(false)
      }

      // softening으로 약한 타원성만 허용 — 반경이 ±8% 안에 머문다.
      expect(minR).toBeGreaterThan(radius * 0.92)
      expect(maxR).toBeLessThan(radius * 1.08)
    })

    it('특정 에너지를 유계로 보존한다 (심플렉틱)', () => {
      const state = createOrbitState()
      const radius = 30
      const gm = G_RENDER * 2
      seedCircularOrbit(state, radius, 0.7, gm)
      const attractors = [fixedAttractor(2)]

      const initialEnergy = specificEnergy(state.pos, state.vel, gm)
      let maxDrift = 0
      for (let i = 0; i < 4000; i++) {
        stepOrbit(state, attractors, SIM_DT)
        const drift = Math.abs(specificEnergy(state.pos, state.vel, gm) - initialEnergy)
        maxDrift = Math.max(maxDrift, drift)
      }
      // 에너지 표류가 초기 결합에너지의 5% 미만 — 발산하지 않음.
      expect(maxDrift).toBeLessThan(Math.abs(initialEnergy) * 0.05)
    })
  })

  describe('seedLocalCircularOrbit (실제 합력 기준 시드)', () => {
    /** 반경 R에서 궤도를 N스텝 적분해 반경 최소·최대를 잰다. */
    function radialBand(
      seed: (state: ReturnType<typeof createOrbitState>) => void,
      attractors: readonly Attractor[],
      steps: number,
    ): { minR: number; maxR: number } {
      const state = createOrbitState()
      seed(state)
      let minR = Infinity
      let maxR = -Infinity
      for (let i = 0; i < steps; i++) {
        stepOrbit(state, attractors, SIM_DT)
        const r = state.pos.length()
        minR = Math.min(minR, r)
        maxR = Math.max(maxR, r)
      }
      return { minR, maxR }
    }

    it('위상 0에서 pos=(R,0,0), vel은 +z 방향(CCW) — 기존 시드와 방향 일치', () => {
      const state = createOrbitState()
      const radius = 20
      seedLocalCircularOrbit(state, radius, 0, [fixedAttractor(1)], G_RENDER * 1)

      expect(state.pos.x).toBeCloseTo(radius)
      expect(state.pos.z).toBeCloseTo(0)
      expect(state.vel.z).toBeGreaterThan(0)
      expect(state.vel.x).toBeCloseTo(0)
      expect(state.home).toBe(radius)
    })

    it('단일 중력원: softening을 반영해 점질량 시드보다 원에 가깝다', () => {
      const radius = 20
      const gm = G_RENDER * 1
      const attractors = [fixedAttractor(1)]
      const steps = 4000

      const point = radialBand((s) => seedCircularOrbit(s, radius, 0, gm), attractors, steps)
      const local = radialBand(
        (s) => seedLocalCircularOrbit(s, radius, 0, attractors, gm),
        attractors,
        steps,
      )

      const pointSpread = point.maxR - point.minR
      const localSpread = local.maxR - local.minR
      expect(localSpread).toBeLessThan(pointSpread)
      // 국소 시드는 실제 힘 법칙과 자기일관적이라 반경이 ±1% 안에 머문다.
      expect(local.minR).toBeGreaterThan(radius * 0.99)
      expect(local.maxR).toBeLessThan(radius * 1.01)
    })

    it('고정 쌍성 퍼텐셜: 점질량 시드보다 반경 요동이 작다', () => {
      // 질량중심 원점, x축 위 ±5에 두 별 — circumbinary 행성의 정적 근사.
      const binary: readonly Attractor[] = [
        { position: new Vector3(5, 0, 0), mass: 1 },
        { position: new Vector3(-5, 0, 0), mass: 1 },
      ]
      const radius = 25
      const gm = G_RENDER * 2
      const steps = 6000

      const point = radialBand((s) => seedCircularOrbit(s, radius, 0.7, gm), binary, steps)
      const local = radialBand(
        (s) => seedLocalCircularOrbit(s, radius, 0.7, binary, gm),
        binary,
        steps,
      )

      expect(local.maxR - local.minR).toBeLessThan(point.maxR - point.minR)
    })

    it('내향 합력이 없으면 점질량 폴백으로 안전 처리 (NaN 없음)', () => {
      const state = createOrbitState()
      seedLocalCircularOrbit(state, 20, 0, [], G_RENDER * 1)
      // 중력원이 없어도 폴백 gm으로 유한 속도를 시드한다.
      expect(Number.isFinite(state.vel.length())).toBe(true)
      expect(state.vel.length()).toBeGreaterThan(0)
    })

    it('반경 0은 속도 0으로 안전 처리', () => {
      const state = createOrbitState()
      seedLocalCircularOrbit(state, 0, 0, [fixedAttractor(1)], G_RENDER)
      expect(state.vel.length()).toBe(0)
      expect(Number.isNaN(state.pos.x)).toBe(false)
    })

    it('floor 인자를 상태에 전달한다', () => {
      const state = createOrbitState()
      seedLocalCircularOrbit(state, 30, 0, [fixedAttractor(1)], G_RENDER, 18)
      expect(state.floor).toBe(18)
    })
  })

  describe('결정론 (재현성)', () => {
    it('동일 시드·동일 스텝 수는 비트 단위로 동일한 궤적을 낸다', () => {
      const attractors = [fixedAttractor(2)]
      const runOnce = () => {
        const state = createOrbitState()
        seedCircularOrbit(state, 25, 1.3, G_RENDER * 2)
        for (let i = 0; i < 1500; i++) stepOrbit(state, attractors, SIM_DT)
        return state
      }
      const a = runOnce()
      const b = runOnce()
      expect(a.pos.x).toBe(b.pos.x)
      expect(a.pos.y).toBe(b.pos.y)
      expect(a.pos.z).toBe(b.pos.z)
      expect(a.vel.x).toBe(b.vel.x)
      expect(a.vel.z).toBe(b.vel.z)
    })
  })

  describe('유계 클램프 (이탈 안전망)', () => {
    it('과속 주입에도 홈 반경 상한을 넘어 이탈하지 않는다', () => {
      const state = createOrbitState()
      const radius = 20
      seedCircularOrbit(state, radius, 0, G_RENDER * 1)
      state.vel.multiplyScalar(6) // 탈출 속도 초과로 강제 이탈 시도
      const attractors = [fixedAttractor(1)]

      const BOUND_MAX = 1.6
      const FLOAT_TOLERANCE = 1.0001 // 부동소수점 헤드룸 (하드 클램프 위 미세 오차 허용)
      for (let i = 0; i < 3000; i++) {
        stepOrbit(state, attractors, SIM_DT)
        // 홈 반경의 BOUND_MAX를 미세 오차 이상으로 넘지 않는다.
        expect(state.pos.length()).toBeLessThanOrEqual(radius * BOUND_MAX * FLOAT_TOLERANCE)
      }
    })

    it('하드 플로어 아래로 다이브하지 않는다 (별 관통 안전망)', () => {
      const state = createOrbitState()
      const radius = 30
      const floor = 18 // 성단 밖 하드 하한
      seedCircularOrbit(state, radius, 0, G_RENDER * 3, floor)
      // 강한 안쪽 킥 — 중심으로 다이브 시도.
      state.vel.multiplyScalar(-0.6)
      const attractors = [fixedAttractor(3)]

      const FLOAT_TOLERANCE = 0.9999
      for (let i = 0; i < 4000; i++) {
        stepOrbit(state, attractors, SIM_DT)
        // 플로어 미세 오차 이하로는 내려가지 않는다.
        expect(state.pos.length()).toBeGreaterThanOrEqual(floor * FLOAT_TOLERANCE)
      }
    })
  })
})
