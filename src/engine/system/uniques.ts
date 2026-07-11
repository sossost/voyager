import { makeStarId } from '../coords'
import type { StarId } from '../coords'
import type { Star } from '../galaxy/sectors'

/**
 * 유니크 항성계 핀 레지스트리 (exotic-codex) — SOL_STAR 핀 메커니즘의 일반화.
 *
 * 절차 생성 블랙홀은 전부 고립·암흑(v6 단일성 유지 — 먹일 물질이 없어 원반 없음)이고,
 * 강착 상태의 블랙홀은 은하에 여기 정의된 유니크 2계뿐이다. 상태는 랜덤 롤이 아니라
 * 반성 유무·이격에서 파생된다 (N-2 관통 원칙 — 04-backlog):
 *  - 아케론(disk_bh): B형 반성이 멀리 돌며 항성풍을 공급 → 은은한 강착원반 (백조자리 X-1형).
 *  - 카리브디스(feeding_bh): K형 반성이 근접 조석 원궤도(e=0)에서 로슈엽 초과 → 물질 스트림
 *    (저질량 X선 쌍성형). 질량 이전 환경이라 행성이 없다 (planetsOf 분기).
 *
 * 모든 시드에서 동일 좌표 — 도감 힌트·수집 목표의 진실 원천. Star 상수는 starsInSector의
 * 핀 분기에서 draw 없이 반환되므로 RNG 스트림·이웃 별에 영향이 없다 (GEN_VERSION 12).
 */

export type UniqueSystemId = 'disk_bh' | 'feeding_bh'

export interface UniqueSystem {
  readonly id: UniqueSystemId
  readonly star: Star
}

/** 아케론 — Sol(26,0,10)에서 ~13.4섹터 중거리. 은하 중심 방향 나선팔 안쪽. */
const DISK_BH_SECTOR = { sx: 14, sy: 0, sz: 16 } as const
export const DISK_BH_STAR_ID: StarId = makeStarId(DISK_BH_SECTOR, 0)

/** 카리브디스 — Sol에서 ~34.4섹터 원거리. 은하 반대편 변방(r≈30). */
const FEEDING_BH_SECTOR = { sx: -2, sy: 0, sz: 30 } as const
export const FEEDING_BH_STAR_ID: StarId = makeStarId(FEEDING_BH_SECTOR, 0)

/**
 * 강착원반 블랙홀 — 원거리 B형 반성의 항성풍을 포획해 원반을 유지한다.
 * separation 9.0은 BINARY 대역(1~12)의 원거리 쪽 — 로슈엽 접촉 없이 바람만 먹는 이격.
 */
export const DISK_BH_STAR: Star = {
  id: DISK_BH_STAR_ID,
  sector: DISK_BH_SECTOR,
  localPos: [50, 0, 50],
  spectral: 'O',
  name: '아케론',
  multiplicity: 'binary',
  companions: [
    { spectral: 'B', separation: 9.0, eccentricity: 0.12, phase: 0.2, hierarchy: 'inner' },
  ],
  kind: 'black_hole',
}

/**
 * 별 흡수 블랙홀 — 근접 K형 반성이 로슈엽을 초과해 물질을 빼앗기는 중.
 * separation 1.2는 BINARY 하한 근방, e=0은 근접 쌍성의 조석 원궤도화(P-1과 같은 논리).
 *
 * ⚠️ 백업 상태 (2026-07-11) — 레지스트리(UNIQUE_SYSTEMS)에서 제외되어 은하에 생성되지
 * 않는다. 비주얼 퀄리티(스트림·티어드롭·연출)를 더 다듬은 뒤 재투입 예정 — 상수·렌더
 * 경로(MatterStream·streamSample·조석 변형)는 전부 보존. 재투입 = 레지스트리에 한 줄 추가.
 */
export const FEEDING_BH_STAR: Star = {
  id: FEEDING_BH_STAR_ID,
  sector: FEEDING_BH_SECTOR,
  localPos: [50, 0, 50],
  spectral: 'O',
  name: '카리브디스',
  multiplicity: 'binary',
  companions: [
    { spectral: 'K', separation: 1.2, eccentricity: 0, phase: 0.6, hierarchy: 'inner' },
  ],
  kind: 'black_hole',
}

export const UNIQUE_SYSTEMS: readonly UniqueSystem[] = [
  { id: 'disk_bh', star: DISK_BH_STAR },
  // { id: 'feeding_bh', star: FEEDING_BH_STAR }, — 백업 (위 FEEDING_BH_STAR 주석 참조)
]

const UNIQUE_BY_STAR_ID: ReadonlyMap<StarId, UniqueSystem> = new Map(
  UNIQUE_SYSTEMS.map((unique) => [unique.star.id, unique]),
)

/** StarId → 유니크계. 유니크가 아니면 null. */
export function uniqueSystemOf(starId: StarId): UniqueSystem | null {
  return UNIQUE_BY_STAR_ID.get(starId) ?? null
}
