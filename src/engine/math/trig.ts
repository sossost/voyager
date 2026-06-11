/**
 * 결정론 삼각함수 근사 — 크로스 엔진 결정론 보장 (02-decisions.md 결정 14).
 *
 * Math.cos/Math.atan2는 정밀도가 구현 정의라 engine/에서 금지된다.
 * 대신 +, -, *, /, Math.abs, Math.floor만으로 구성한 유리 근사를 쓴다 —
 * IEEE-754가 비트 동일을 보장하는 연산뿐이므로 어떤 JS 엔진에서도 같은 값이 나온다.
 *
 * 정확도는 밀도 변조(나선팔) 용도로 충분하다:
 *   cosApprox 최대 오차 ~0.0016 (Bhaskara I), atan2Approx 최대 오차 ~0.005 rad.
 */

export const PI = 3.141592653589793
export const TWO_PI = 6.283185307179586
const HALF_PI = 1.5707963267948966

/** Bhaskara I 근사 — sin(x), x ∈ [0, π] 전제. */
function sinHalfTurn(x: number): number {
  const product = x * (PI - x)
  return (16 * product) / (5 * PI * PI - 4 * product)
}

/** cos 유리 근사 — 전 구간 입력 허용 (내부에서 [0, 2π)로 환원). */
export function cosApprox(angle: number): number {
  const turns = angle / TWO_PI
  const normalized = (turns - Math.floor(turns)) * TWO_PI
  // cos(x) = sin(x + π/2) — [0, 2π) 구간을 sin의 반주기 두 개로 나눠 처리
  const shifted = normalized + HALF_PI
  const wrapped = shifted >= TWO_PI ? shifted - TWO_PI : shifted
  return wrapped < PI ? sinHalfTurn(wrapped) : -sinHalfTurn(wrapped - PI)
}

/** atan 유리 근사 — |t| ≤ 1 전제 (호출자가 옥탄트 환원). */
function atanUnit(t: number): number {
  return t / (1 + 0.28086 * t * t)
}

/** atan2 유리 근사 — 반환 범위 (-π, π]. (0, 0)은 0을 반환한다. */
export function atan2Approx(y: number, x: number): number {
  if (x === 0 && y === 0) return 0

  const absX = Math.abs(x)
  const absY = Math.abs(y)
  // |비율| ≤ 1이 되도록 큰 쪽으로 나눈다 — atanUnit의 정의역 보장
  const base = absY <= absX ? atanUnit(absY / absX) : HALF_PI - atanUnit(absX / absY)

  if (x >= 0) return y >= 0 ? base : -base
  return y >= 0 ? PI - base : base - PI
}
