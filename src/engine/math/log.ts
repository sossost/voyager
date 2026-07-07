/**
 * 결정론 로그·지수 근사 — 크로스 엔진 결정론 보장 (02-decisions.md 결정 14 확장, 사실성 v2 O-10).
 *
 * Math.log/Math.exp는 정밀도가 구현 정의라 engine/에서 금지된다.
 * +, -, *, / 와 유한 루프만으로 구성한 유리 근사를 쓴다 — IEEE-754가 비트 동일을
 * 보장하는 연산뿐이므로 어떤 JS 엔진에서도 같은 값이 나온다.
 *
 * 정확도는 은하 밀도(로그 나선 위상·지수 원반 감쇠) 용도로 충분하다:
 *   lnApprox 상대 오차 < 1e-9 (atanh 급수 4항), expNegApprox 상대 오차 < 0.3% (x ∈ [0, 6]).
 */

const LN2 = 0.6931471805599453

/**
 * 자연로그 유리 근사 — x > 0 전제 (0 이하는 호출자가 배제).
 * 가수·지수 분해(m ∈ [1, 2))는 2배/절반 곱셈 루프 — 밀도 입력 범위(섹터 반경 ≤ 수백)에서
 * 반복 횟수는 고작 수십 회로 유한하다. ln(m)은 z=(m−1)/(m+1)의 atanh 급수.
 */
export function lnApprox(x: number): number {
  let mantissa = x
  let exponent = 0
  while (mantissa >= 2) {
    mantissa /= 2
    exponent += 1
  }
  while (mantissa < 1) {
    mantissa *= 2
    exponent -= 1
  }
  const z = (mantissa - 1) / (mantissa + 1)
  const z2 = z * z
  const series = z * (1 + z2 * (1 / 3 + z2 * (1 / 5 + z2 * (1 / 7))))
  return exponent * LN2 + 2 * series
}

/**
 * e^(−x) 유리 근사 — x ≥ 0 전제. 1/(테일러 4차) 형태라 전 구간 단조 감소·양수이고
 * x ∈ [0, 6]에서 상대 오차 < 0.3% — 지수 원반 감쇠(외곽에서 0에 수렴) 용도로 충분하다.
 */
export function expNegApprox(x: number): number {
  const x2 = x * x
  return 1 / (1 + x + x2 / 2 + (x2 * x) / 6 + (x2 * x2) / 24)
}
