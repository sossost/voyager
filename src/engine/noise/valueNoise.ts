/**
 * 정수 격자 value noise — 크로스 엔진 결정론 보장 (02-decisions.md 결정 14).
 *
 * 격자점 해시는 32bit 정수 연산(Math.imul)만, 보간은 산술 연산(+,-,*)만 사용한다.
 * IEEE-754가 비트 동일을 보장하는 연산만 쓰므로 어떤 JS 엔진에서도 같은 값이 나온다.
 * (simplex-noise 등 외부 라이브러리·초월함수 기반 노이즈는 금지 — lint로 강제)
 */

/** 정수 격자점 → [0, 1). murmur3 finalizer 기반 믹싱. */
function hash01(ix: number, iy: number, iz: number, salt = 0): number {
  let h =
    Math.imul(ix, 0x9e3779b1) ^
    Math.imul(iy, 0x85ebca77) ^
    Math.imul(iz, 0xc2b2ae3d) ^
    Math.imul(salt + 1, 0x27d4eb2f)
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

/** 산술 연산만 사용하는 에르미트 보간 계수. */
function smoothstep(t: number): number {
  return t * t * (3 - 2 * t)
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t
}

/** 3D value noise — 반환 범위 [0, 1). */
export function valueNoise3(x: number, y: number, z: number, salt = 0): number {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const iz = Math.floor(z)
  const tx = smoothstep(x - ix)
  const ty = smoothstep(y - iy)
  const tz = smoothstep(z - iz)

  const c000 = hash01(ix, iy, iz, salt)
  const c100 = hash01(ix + 1, iy, iz, salt)
  const c010 = hash01(ix, iy + 1, iz, salt)
  const c110 = hash01(ix + 1, iy + 1, iz, salt)
  const c001 = hash01(ix, iy, iz + 1, salt)
  const c101 = hash01(ix + 1, iy, iz + 1, salt)
  const c011 = hash01(ix, iy + 1, iz + 1, salt)
  const c111 = hash01(ix + 1, iy + 1, iz + 1, salt)

  const bottom = lerp(lerp(c000, c100, tx), lerp(c010, c110, tx), ty)
  const top = lerp(lerp(c001, c101, tx), lerp(c011, c111, tx), ty)
  return lerp(bottom, top, tz)
}
