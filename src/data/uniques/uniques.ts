import type { UniqueSystemId } from '@/engine'

/**
 * 특이계 도감 카탈로그 (exotic-codex) — 유니크 항성계의 정적 메타데이터.
 *
 * 저장 대상이 아니다(철칙 4) — 발견 기록은 uniqueId만 저장하고, 이름·로어·힌트는 여기서
 * 재생성한다. 키는 UniqueSystemId enum이라 배열 순서가 저장 포맷이 아니다 (phenomena 선례).
 * 좌표·구성의 진실 원천은 engine/system/uniques.ts — 여기는 서사(발견 전 힌트·발견 후 로어)만.
 */

export interface UniqueArchetype {
  readonly id: UniqueSystemId
  readonly label: string
  /** 발견 후 표시되는 로어. */
  readonly lore: string
  /** 미발견 시 표시되는 서사형 힌트 — 방향·거리감·특징. 좌표는 공개하지 않는다 (성배 찾기). */
  readonly hint: string
}

export const UNIQUES_CATALOG: readonly UniqueArchetype[] = [
  {
    id: 'disk_bh',
    label: '아케론',
    lore: '푸른 거성 하나가 어둠 곁을 멀리서 돈다. 거성이 흘리는 항성풍이 블랙홀의 중력 우물로 흘러들어, 사건지평선 둘레에 금빛으로 달궈진 강착원반을 두른다. 은하의 블랙홀 대부분은 먹일 것이 없어 어둡다 — 이곳은 바람을 먹고 빛나는 드문 심연이다.',
    hint: '출발점에서 은하 중심 쪽으로 나선팔을 거슬러 열댓 섹터 — 푸른 거성이 홀로 도는 듯한 계에서 금빛 고리가 관측되었다는 항해 기록이 있다. 항법 스캔에 잡힌다.',
  },
  {
    id: 'feeding_bh',
    label: '카리브디스',
    lore: '주황빛 왜성이 어둠에 바짝 붙어 돈다. 너무 가까이 다가간 대가로 별의 바깥층이 로슈엽을 넘어 빨려 나가고, 물질의 나선 강물이 강착원반으로 흘러든다. 별은 수백만 년에 걸쳐 천천히 잡아먹히는 중이다 — 행성은 이 폭력적인 환경에서 살아남지 못했다.',
    hint: '은하 반대편 변방, 출발점에서 서른 섹터가 넘는 먼 길 — 별 하나가 통째로 뜯겨 나가는 계가 있다는 소문만 전해진다. 가까이 가기 전에는 스캔에도 잡히지 않는 거리다.',
  },
]

export const UNIQUES_BY_ID: ReadonlyMap<UniqueSystemId, UniqueArchetype> = new Map(
  UNIQUES_CATALOG.map((archetype) => [archetype.id, archetype]),
)
