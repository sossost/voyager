import { makeStarId, makePlanetId } from '../coords'
import type { PlanetId, StarId } from '../coords'
import type { Moon } from './moons'
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
 * 이름·분광형·행성 수는 실제 반영. 궤도는 게임 스케일(0.4~6.0 AU)로 압축하되
 * 기하급수적 간격을 보존한다 — 화성→목성의 소행성대 간극(가장 큰 빈 구간)과
 * 외행성이 멀리 흩어지는 패턴이 드러나도록. 가스행성 반경도 실제 비(목>토≫천≈해)를
 * 반영해 목성을 최대(5.0)로 둔다. append-only 규칙 적용: 새 필드는 항상 마지막에 추가.
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
    radius: 5.0,
    orbitAu: 2.5,
    hasLife: false,
    name: '목성',
    paletteSeed: 19108,  // hue 28 — 갈색·주황 줄무늬
  },
  {
    id: makePlanetId(SOL_STAR_ID, 5),
    starId: SOL_STAR_ID,
    index: 5,
    kind: 'gas',
    radius: 4.3,
    orbitAu: 3.5,
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
    radius: 2.3,
    orbitAu: 4.7,
    hasLife: false,
    name: '천왕성',
    paletteSeed: 26475,  // hue 195 — 청록 얼음 행성
  },
  {
    id: makePlanetId(SOL_STAR_ID, 7),
    starId: SOL_STAR_ID,
    index: 7,
    kind: 'gas',
    radius: 2.2,
    orbitAu: 6.0,
    hasLife: false,
    name: '해왕성',
    paletteSeed: 32260,  // hue 220 — 짙은 파랑
  },
] satisfies readonly Planet[]

/**
 * 태양계 주요 위성 — RNG 미사용 상수. moonsOf의 Sol 분기에서 반환된다.
 * 실제 행성별 대표 위성을 궤도 거리 오름차순으로 큐레이션 (수성·금성은 위성 없음).
 *
 * 렌더 인코딩(Moon.tsx 기준):
 *   orbitFactor [0,1) → 궤도 반경(행성 반경의 2.2~4.2배), 안쪽 위성일수록 작다.
 *   phaseFactor [0,1) → 공전 초기 위상(×2π), 위성끼리 겹치지 않게 분산.
 *   paletteSeed     → %100=상대 크기(0.10~0.20×행성), %18=밝기. 실제 위성 크기 반영.
 */
interface SolMoonSpec {
  readonly name: string
  readonly orbitFactor: number
  readonly phaseFactor: number
  readonly paletteSeed: number
}

const SOL_MOON_SPECS: Readonly<Record<number, readonly SolMoonSpec[]>> = {
  // 지구 — 달 1개
  2: [{ name: '달', orbitFactor: 0.55, phaseFactor: 0.2, paletteSeed: 1180 }],
  // 화성 — 포보스·데이모스 (작고 어두운 포획 소행성)
  3: [
    { name: '포보스', orbitFactor: 0.12, phaseFactor: 0.6, paletteSeed: 503 },
    { name: '데이모스', orbitFactor: 0.45, phaseFactor: 0.15, paletteSeed: 702 },
  ],
  // 목성 — 갈릴레이 위성 4개
  4: [
    { name: '이오', orbitFactor: 0.1, phaseFactor: 0.0, paletteSeed: 4055 },
    { name: '유로파', orbitFactor: 0.32, phaseFactor: 0.45, paletteSeed: 3050 },
    { name: '가니메데', orbitFactor: 0.58, phaseFactor: 0.7, paletteSeed: 2065 },
    { name: '칼리스토', orbitFactor: 0.85, phaseFactor: 0.25, paletteSeed: 5060 },
  ],
  // 토성 — 대표 위성 3개
  5: [
    { name: '레아', orbitFactor: 0.18, phaseFactor: 0.5, paletteSeed: 1330 },
    { name: '타이탄', orbitFactor: 0.48, phaseFactor: 0.1, paletteSeed: 4070 },
    { name: '이아페투스', orbitFactor: 0.88, phaseFactor: 0.8, paletteSeed: 2028 },
  ],
  // 천왕성 — 주요 위성 5개
  6: [
    { name: '미란다', orbitFactor: 0.1, phaseFactor: 0.3, paletteSeed: 1015 },
    { name: '아리엘', orbitFactor: 0.28, phaseFactor: 0.65, paletteSeed: 2035 },
    { name: '움브리엘', orbitFactor: 0.42, phaseFactor: 0.05, paletteSeed: 3033 },
    { name: '티타니아', orbitFactor: 0.65, phaseFactor: 0.4, paletteSeed: 4045 },
    { name: '오베론', orbitFactor: 0.82, phaseFactor: 0.9, paletteSeed: 5043 },
  ],
  // 해왕성 — 트리톤 1개 (역행 궤도)
  7: [{ name: '트리톤', orbitFactor: 0.5, phaseFactor: 0.35, paletteSeed: 3055 }],
}

/**
 * planetId → 위성 목록. moonsOf가 Sol 행성일 때 이 맵을 조회한다.
 * 맵에 없는 행성(수성·금성)은 위성 0개.
 */
export const SOLAR_SYSTEM_MOONS: ReadonlyMap<PlanetId, readonly Moon[]> = new Map(
  Object.entries(SOL_MOON_SPECS).map(([planetIndex, specs]) => {
    const planetId = makePlanetId(SOL_STAR_ID, Number(planetIndex))
    const moons: readonly Moon[] = specs.map((spec, index) => ({
      planetId,
      index,
      orbitFactor: spec.orbitFactor,
      phaseFactor: spec.phaseFactor,
      paletteSeed: spec.paletteSeed,
      name: spec.name,
    }))
    return [planetId, moons] as const
  }),
)
