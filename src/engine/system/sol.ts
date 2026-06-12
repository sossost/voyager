import { makeStarId, makePlanetId } from '../coords'
import type { StarId } from '../coords'
import type { Planet } from './planets'

/** 태양계 기준 StarId — 은하 중심 섹터(0,0,0)의 인덱스 0. 모든 시드에서 동일. */
export const SOL_STAR_ID: StarId = makeStarId({ sx: 0, sy: 0, sz: 0 }, 0)

/** 섹터 (0,0,0) 내 고정 좌표 [0, SECTOR_SIZE=100). */
export const SOL_LOCAL_POS = [50, 0, 50] as const

/**
 * 태양계 8행성 — RNG 미사용 상수. planetsOf의 Sol 분기에서 반환된다.
 * 이름·분광형·행성 수는 실제 반영, 궤도 반경은 게임 스케일(0.4~6.0 AU).
 * append-only 규칙 적용: 새 필드는 항상 마지막에 추가.
 */
export const SOLAR_SYSTEM_PLANETS: readonly Planet[] = [
  {
    id: makePlanetId(SOL_STAR_ID, 0),
    starId: SOL_STAR_ID,
    index: 0,
    kind: 'rocky',
    radius: 0.38,
    orbitAu: 0.4,
    hasLife: false,
    name: '수성',
    paletteSeed: 0x1a2b3c,
  },
  {
    id: makePlanetId(SOL_STAR_ID, 1),
    starId: SOL_STAR_ID,
    index: 1,
    kind: 'rocky',
    radius: 0.95,
    orbitAu: 0.7,
    hasLife: false,
    name: '금성',
    paletteSeed: 0x4d5e6f,
  },
  {
    id: makePlanetId(SOL_STAR_ID, 2),
    starId: SOL_STAR_ID,
    index: 2,
    kind: 'rocky',
    radius: 1.0,
    orbitAu: 1.0,
    hasLife: true,
    isHomeWorld: true,
    name: '지구',
    paletteSeed: 0x2a7fb2,
  },
  {
    id: makePlanetId(SOL_STAR_ID, 3),
    starId: SOL_STAR_ID,
    index: 3,
    kind: 'rocky',
    radius: 0.53,
    orbitAu: 1.5,
    hasLife: false,
    name: '화성',
    paletteSeed: 0xad1a2b,
  },
  {
    id: makePlanetId(SOL_STAR_ID, 4),
    starId: SOL_STAR_ID,
    index: 4,
    kind: 'gas',
    radius: 4.5,
    orbitAu: 3.0,
    hasLife: false,
    name: '목성',
    paletteSeed: 0xde9b3c,
  },
  {
    id: makePlanetId(SOL_STAR_ID, 5),
    starId: SOL_STAR_ID,
    index: 5,
    kind: 'gas',
    radius: 3.8,
    orbitAu: 4.0,
    hasLife: false,
    name: '토성',
    paletteSeed: 0xf5d898,
  },
  {
    id: makePlanetId(SOL_STAR_ID, 6),
    starId: SOL_STAR_ID,
    index: 6,
    kind: 'gas',
    radius: 2.5,
    orbitAu: 5.0,
    hasLife: false,
    name: '천왕성',
    paletteSeed: 0x8ecadc,
  },
  {
    id: makePlanetId(SOL_STAR_ID, 7),
    starId: SOL_STAR_ID,
    index: 7,
    kind: 'gas',
    radius: 2.4,
    orbitAu: 6.0,
    hasLife: false,
    name: '해왕성',
    paletteSeed: 0x3a6bca,
  },
] satisfies readonly Planet[]
