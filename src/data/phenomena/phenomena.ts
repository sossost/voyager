import type { StarKind } from '@/engine'

/**
 * 현상 도감 카탈로그 (exotic-bodies 결정 7) — 이색 천체의 정적 메타데이터.
 * 블랙홀·펄서·적색거성·백색왜성.
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
    kind: 'black_hole',
    label: '블랙홀',
    lore: '빛조차 빠져나오지 못하는 사건지평선. 빨려드는 물질이 강착원반에서 마찰로 달궈져 마지막 비명처럼 타오르고, 한쪽은 도플러 효과로 더 밝게 일렁인다.',
    rarity: 'legendary',
  },
  {
    kind: 'pulsar',
    label: '펄서',
    lore: '초신성이 남긴 도시 크기의 중성자성. 1초에도 수차례 회전하며 자기극에서 좁은 전파 빔을 등대처럼 쏘아낸다. 자전축에서 기울어진 자기축 탓에 빔이 허공을 쓸고, 그 끝이 우리를 스칠 때마다 맥동이 관측된다.',
    rarity: 'rare',
  },
  {
    kind: 'red_giant',
    label: '적색거성',
    lore: '수소를 다 태운 별이 부풀어 오른 노년기. 바깥층이 수백 배로 팽창하며 식어 깊은 주황빛을 띠고, 한때 가까이 돌던 내행성들은 그 외피에 삼켜졌다. 언젠가 우리 태양도 맞이할 미래다.',
    rarity: 'uncommon',
  },
  {
    kind: 'white_dwarf',
    label: '백색왜성',
    lore: '적색거성이 바깥층을 날려보내고 남긴 지구만 한 핵. 더 이상 핵융합을 하지 않지만 잔열로 새하얗게 달아오른 초고밀도 잔해다. 찻숟갈 하나가 수 톤에 달하며, 수십억 년에 걸쳐 천천히 식어간다.',
    rarity: 'uncommon',
  },
]

export const PHENOMENA_BY_KIND: ReadonlyMap<PhenomenonKind, PhenomenonArchetype> = new Map(
  PHENOMENA_CATALOG.map((archetype) => [archetype.kind, archetype]),
)
