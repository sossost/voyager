import type { Rng } from '../rng/streams'

const STAR_PREFIXES = [
  'Al', 'Bel', 'Cyg', 'Den', 'El', 'Fo', 'Gal', 'Hy', 'Ish', 'Jun',
  'Kel', 'Lyr', 'Mira', 'Nash', 'Or', 'Pol', 'Qui', 'Rig', 'Sir', 'Tau',
  'Ur', 'Veg', 'Wez', 'Xi', 'Yil', 'Zub',
] as const

const STAR_MIDDLES = ['a', 'e', 'i', 'o', 'u', 'ara', 'eri', 'ion', 'ula', 'ius'] as const
const STAR_SUFFIXES = ['', 'k', 'n', 'r', 's', 'th', 'x'] as const

const PLANET_FIRSTS = [
  'Ar', 'Bren', 'Cal', 'Dor', 'Eri', 'Fen', 'Gor', 'Hal', 'Ily', 'Jor',
  'Kar', 'Lum', 'Mar', 'Nev', 'Oss', 'Pra', 'Quor', 'Rho', 'Sel', 'Tor',
] as const

const PLANET_SECONDS = [
  'antha', 'eon', 'ia', 'ios', 'mir', 'nara', 'oth', 'tis', 'una', 'ys',
] as const

const ALIEN_FIRSTS = [
  'Bo', 'Chi', 'Dak', 'Fizz', 'Glo', 'Khi', 'Lum', 'Mo', 'Nya', 'Pip',
  'Quo', 'Rik', 'Squi', 'Tos', 'Wim', 'Zor',
] as const

const ALIEN_SECONDS = ['ba', 'ki', 'lo', 'mu', 'na', 'pi', 'ri', 'ta', 'zu'] as const

/** 예: "Mirairath-417" */
export function starName(rng: Rng): string {
  const prefix = rng.pick(STAR_PREFIXES)
  const middle = rng.pick(STAR_MIDDLES)
  const suffix = rng.pick(STAR_SUFFIXES)
  const designation = 100 + rng.int(900)
  return `${prefix}${middle}${suffix}-${designation}`
}

/** 예: "Selantha" */
export function planetName(rng: Rng): string {
  return `${rng.pick(PLANET_FIRSTS)}${rng.pick(PLANET_SECONDS)}`
}

/** 예: "Pipnana" — 마지막 음절을 한 번 더 겹쳐 귀여운 어감을 만든다. */
export function alienName(rng: Rng): string {
  const first = rng.pick(ALIEN_FIRSTS)
  const second = rng.pick(ALIEN_SECONDS)
  const reduplicated = rng.next() < 0.35
  return reduplicated ? `${first}${second}${second}` : `${first}${second}`
}
