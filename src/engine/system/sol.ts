import { makeStarId, makePlanetId } from '../coords'
import type { StarId } from '../coords'
import type { Planet } from './planets'

/**
 * 태양계 기준 StarId — 은하 중심에서 ~58% 거리(r≈27.9섹터) 나선팔 근방.
 * 실제 태양의 은하 내 위치(은하 반경의 55~60%)를 반영한다. 모든 시드에서 동일.
 */
export const SOL_STAR_ID: StarId = makeStarId({ sx: 26, sy: 0, sz: 10 }, 0)
export const SOL_SECTOR = { sx: 26, sy: 0, sz: 10 } as const

/** 섹터 (26,0,10) 내 고정 좌표 [0, SECTOR_SIZE=100). */
export const SOL_LOCAL_POS = [50, 0, 50] as const

/**
 * 태양계 8행성 — RNG 미사용 상수. planetsOf의 Sol 분기에서 반환된다.
 * 이름·분광형·행성 수는 실제 반영, 궤도 반경은 게임 스케일(0.4~6.0 AU).
 * append-only 규칙 적용: 새 필드는 항상 마지막에 추가.
 *
 * paletteSeed 선택 기준: seed % 360 = 목표 색조(hue).
 *   수성(25: 회갈색), 금성(42: 황토색), 지구(100: 녹지), 화성(12: 붉은빛),
 *   목성(28: 주황갈색), 토성(48: 황금색), 천왕성(195: 청록), 해왕성(220: 짙은 파랑).
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
    paletteSeed: 6145,   // hue 25 — 회갈색 암석 지형
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
    paletteSeed: 8322,   // hue 42 — 황토·주황 (두꺼운 대기)
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
    paletteSeed: 11260,  // hue 100 — 녹지(대륙) + 고정 파란 바다
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
    paletteSeed: 16932,  // hue 12 — 붉은빛 암석
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
    paletteSeed: 19108,  // hue 28 — 갈색·주황 줄무늬
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
    paletteSeed: 22008,  // hue 48 — 황금·크림 줄무늬
    hasRings: true,
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
    paletteSeed: 26475,  // hue 195 — 청록 얼음 행성
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
    paletteSeed: 32260,  // hue 220 — 짙은 파랑
  },
] satisfies readonly Planet[]
