import { describe, expect, it } from 'vitest'

import { atan2Approx, cosApprox, PI, TWO_PI } from './trig'

/**
 * 기준값은 하드코딩한다 — engine/ 테스트도 순수성 린트 대상이라
 * Math.cos/Math.atan2를 참조 구현으로 쓸 수 없다.
 */

const COS_TOLERANCE = 0.002
const ATAN2_TOLERANCE = 0.006

describe('cosApprox', () => {
  it.each([
    [0, 1],
    [PI / 6, 0.8660254],
    [PI / 3, 0.5],
    [PI / 2, 0],
    [(2 * PI) / 3, -0.5],
    [PI, -1],
    [(4 * PI) / 3, -0.5],
    [(3 * PI) / 2, 0],
    [(5 * PI) / 3, 0.5],
  ])('cosApprox(%f) ≈ %f', (angle, expected) => {
    expect(Math.abs(cosApprox(angle) - expected)).toBeLessThanOrEqual(COS_TOLERANCE)
  })

  it('주기 2π — 임의 회전수를 더해도 같은 값이다', () => {
    for (const angle of [0.3, 1.7, 4.4, 6.1]) {
      expect(cosApprox(angle + 3 * TWO_PI)).toBeCloseTo(cosApprox(angle), 10)
      expect(cosApprox(angle - 5 * TWO_PI)).toBeCloseTo(cosApprox(angle), 10)
    }
  })

  it('반환 범위는 [-1, 1]이다', () => {
    for (let angle = -20; angle <= 20; angle += 0.1) {
      const value = cosApprox(angle)
      expect(value).toBeGreaterThanOrEqual(-1)
      expect(value).toBeLessThanOrEqual(1)
    }
  })
})

describe('atan2Approx', () => {
  it.each([
    // 8방위 + 옥탄트 내부점 — 기준값은 정확한 atan2(y, x)
    [0, 1, 0],
    [1, 1, PI / 4],
    [1, 0, PI / 2],
    [1, -1, (3 * PI) / 4],
    [0, -1, PI],
    [-1, -1, -(3 * PI) / 4],
    [-1, 0, -PI / 2],
    [-1, 1, -PI / 4],
    [1, 2, 0.4636476],
    [2, 1, 1.1071487],
    [-3, 4, -0.6435011],
    [4, -3, 2.2142974],
  ])('atan2Approx(%f, %f) ≈ %f', (y, x, expected) => {
    expect(Math.abs(atan2Approx(y, x) - expected)).toBeLessThanOrEqual(ATAN2_TOLERANCE)
  })

  it('원점 (0, 0)은 0을 반환한다', () => {
    expect(atan2Approx(0, 0)).toBe(0)
  })

  it('스케일 불변 — 같은 방향 벡터는 같은 각도다', () => {
    expect(atan2Approx(3, 7)).toBeCloseTo(atan2Approx(30, 70), 10)
    expect(atan2Approx(-5, 2)).toBeCloseTo(atan2Approx(-50, 20), 10)
  })
})
