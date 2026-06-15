import type { StarKind } from '@/engine'

/**
 * 현상 도감 카탈로그 (exotic-bodies 결정 7) — 이색 천체 4종의 정적 메타데이터.
 *
 * 저장 대상이 아니다(철칙 4) — 발견 기록은 식별자(starId)만 저장하고, 이름·로어·희귀도는
 * 여기서 읽어 재생성한다. 키는 `kind` enum이라 배열 순서가 저장 포맷이 아니다(species.json과
 * 달리 GEN_VERSION 무관). 주계열성은 "현상"이 아니므로 제외한다.
 */

export type PhenomenonKind = Exclude<StarKind, 'main_sequence'>
export type PhenomenonRarity = 'uncommon' | 'rare' | 'legendary'

export interface PhenomenonArchetype {
  readonly kind: PhenomenonKind
  readonly label: string
  readonly lore: string
  readonly rarity: PhenomenonRarity
}

export const PHENOMENA_CATALOG: readonly PhenomenonArchetype[] = [
  {
    kind: 'red_giant',
    label: '적색거성',
    lore: '수소를 다 태운 별이 부풀어 오른 만년(晩年)의 모습. 차갑게 식은 표면이 깊은 주홍빛으로 타오르며, 언젠가 외피를 흩뿌리고 백색왜성만 남길 것이다.',
    rarity: 'uncommon',
  },
  {
    kind: 'white_dwarf',
    label: '백색왜성',
    lore: '별의 핵이 남긴 잔해. 지구만 한 부피에 태양만 한 질량을 욱여넣어, 한 숟갈이 수 톤에 이르는 축퇴 물질이 식어 가는 잔불처럼 청백색으로 빛난다.',
    rarity: 'uncommon',
  },
  {
    kind: 'pulsar',
    label: '펄서 · 중성자성',
    lore: '초신성이 남긴 도시만 한 중성자별. 초속 수백 회로 자전하며 자기극에서 좁은 전파 빔을 쏘아, 등대처럼 우주를 규칙적으로 훑는다.',
    rarity: 'rare',
  },
  {
    kind: 'black_hole',
    label: '블랙홀',
    lore: '빛조차 빠져나오지 못하는 사건지평선. 빨려드는 물질이 강착원반에서 마찰로 달궈져 마지막 비명처럼 타오르고, 한쪽은 도플러 효과로 더 밝게 일렁인다.',
    rarity: 'legendary',
  },
]

export const PHENOMENA_BY_KIND: ReadonlyMap<PhenomenonKind, PhenomenonArchetype> = new Map(
  PHENOMENA_CATALOG.map((archetype) => [archetype.kind, archetype]),
)
