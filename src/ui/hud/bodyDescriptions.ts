import type { Planet, SpectralClass, StarKind } from '@/engine'
import { SOL_STAR_ID } from '@/engine'
import type { GasClass, TemperatureZone } from '@/scenes/system/habitableZone'
import { gasClassOf, temperatureZoneAt } from '@/scenes/system/habitableZone'

/**
 * 천체 짧은 설명 (misc-ux) — 콜아웃 패널의 플레이버 텍스트. 타입 키 정적 사전이라
 * RNG를 소비하지 않는다 (GEN_VERSION 무관, 렌더/UI 전용). 문구는 실제 천문 관측
 * 사실에 근거한다 (문헌 기반 원칙) — 분광형 특성은 Carroll & Ostlie 부록 G,
 * 가스 행성 분류는 Sudarsky et al. 2000의 온도 클래스를 따른다.
 */

export const SPECTRAL_DESCRIPTIONS: Readonly<Record<SpectralClass, string>> = {
  O: '태양 수만 배 광도로 타오르는 극히 희귀한 청색 별. 수백만 년 만에 연료를 소진하고 초신성으로 생을 마친다.',
  B: '뜨겁고 무거운 청백색 별. 젊은 성단과 나선팔을 밝히는 등대지만 수명은 수천만 년에 그친다.',
  A: '시리우스·베가로 대표되는 백색 별. 표면 온도 8,000~10,000K로 수소 흡수선이 가장 뚜렷하다.',
  F: '태양보다 약간 뜨겁고 밝은 황백색 별. 수십억 년의 수명은 생명이 깃들기에 충분한 시간이다.',
  G: '태양과 같은 부류의 황색 왜성. 약 100억 년을 안정적으로 타는, 우리가 아는 유일한 생명의 요람이다.',
  K: '태양보다 서늘한 주황색 왜성. 수백억 년의 긴 수명과 온화한 활동으로 거주가능성 연구의 단골 후보다.',
  M: '은하 별의 약 4분의 3을 차지하는 가장 흔한 별. 그러나 너무 어두워 맨눈에 보이는 M왜성은 하나도 없다.',
}

/** 태양 전용 설명 — 시작 항성계의 주인공이라 제너럴한 G형 문구 대신 직접 서술한다. */
export const SOL_STAR_DESCRIPTION =
  '46억 년째 타오르고 있는 우리 태양. 지구 생명의 유일한 에너지원이자, 이 항해가 시작된 별이다.'

/** 이색 천체 설명 — 주계열성은 분광형 사전이 담당하므로 제외. */
export const STAR_KIND_DESCRIPTIONS: Readonly<
  Record<Exclude<StarKind, 'main_sequence'>, string>
> = {
  black_hole:
    '무거운 별의 중력 붕괴가 남긴 시공간의 구멍. 사건지평선 안에서는 빛조차 빠져나오지 못하며, 주변 빛을 휘어 배경 하늘을 일그러뜨린다.',
  pulsar:
    '초신성이 남긴 도시 크기의 중성자별. 각설탕 한 개 부피의 질량이 수억 톤에 달하고, 등대처럼 빔을 쓸며 초당 수십 회까지 자전한다.',
  white_dwarf:
    '태양급 별이 외피를 벗어던지고 남긴 지구 크기의 심핵. 더 이상 핵융합 없이 남은 열만으로 수십억 년에 걸쳐 서서히 식어간다.',
  red_giant:
    '중심 수소를 소진한 별이 수백 배로 부풀어 오른 말년의 모습. 태양도 약 50억 년 뒤 이렇게 부풀어 수성과 금성을 삼킨다.',
}

/** 암석형 — 온도대(HZ 시각화와 동일 분류)별 표면 묘사. */
const ROCKY_ZONE_DESCRIPTIONS: Readonly<Record<TemperatureZone, string>> = {
  scorching:
    '항성에 바싹 붙어 표면이 녹아내리는 작열 행성. 낮면에는 규산염 암석이 끓는 용암 바다가 펼쳐진다.',
  habitable:
    '액체 물이 존재할 수 있는 거주가능구역의 암석 행성. 대기와 물만 갖춘다면 생명이 깃들 수 있는 온도다.',
  frozen:
    '동결선 너머의 얼음 행성. 물과 휘발성 물질이 단단히 얼어붙어 표면을 하얗게 덮는다.',
}

/** 가스형 — Sudarsky 온도 클래스(habitableZone gasClassOf와 동일 분류)별 대기 묘사. */
const GAS_CLASS_DESCRIPTIONS: Readonly<Record<GasClass, string>> = {
  silicate:
    '규산염과 철 구름이 끓는 초고온 가스 거성. 항성에 너무 가까워 암석 성분마저 증기가 된다.',
  alkali:
    '알칼리 금속 증기가 대기를 물들인 뜨거운 가스 거성. 나트륨과 칼륨이 빛을 흡수해 어둡게 보인다.',
  cloudless:
    '구름이 응결되지 못하는 온도대의 무운 가스 거성. 대기 산란만 남아 깊은 감청색을 띤다.',
  water: '수증기 구름이 하얗게 감싼 온화한 가스 거성. 목성보다 따뜻하고 반사율이 높다.',
  ammonia:
    '목성과 같은 암모니아 구름의 저온 가스 거성. 줄무늬 구름 띠와 소용돌이 폭풍이 대기를 수놓는다.',
}

/** 온도대를 정할 수 없는 계(이색 천체 등 HZ 없음) — 종류만으로 중립 서술. */
const ROCKY_FALLBACK_DESCRIPTION = '암석과 금속 핵으로 이루어진 지구형 행성.'
const GAS_FALLBACK_DESCRIPTION = '수소와 헬륨이 대부분을 차지하는 목성형 가스 거성.'

const HOME_WORLD_DESCRIPTION = '푸른 물의 행성이자 인류의 고향. 이 항해가 시작된 곳이다.'

/**
 * 태양계 8행성 전용 설명 (index 키) — Sol은 온도 모델을 우회하므로(궤도 압축·authored 팔레트,
 * CurrentSystem isSolarSystem 참고) 실제 행성의 관측 사실을 직접 서술한다. 지구(2)는
 * isHomeWorld 분기가 먼저 잡아 여기 없다.
 */
const SOL_PLANET_DESCRIPTIONS: Readonly<Record<number, string>> = {
  0: '태양에 가장 가까운 잿빛 암석 행성. 대기가 없어 낮 430℃, 밤 −180℃를 오간다.',
  1: '두꺼운 이산화탄소 대기의 온실 행성. 표면은 납이 녹는 460℃로 태양계에서 가장 뜨겁다.',
  3: '녹슨 철 먼지가 붉게 덮은 사막 행성. 말라붙은 강바닥이 물이 흘렀던 과거를 증언한다.',
  4: '태양계 행성을 모두 합친 것보다 무거운 가스 거성. 대적점 폭풍 하나가 지구보다 크다.',
  5: '얼음 조각 고리를 두른 가스 거성. 밀도가 물보다 낮아 물에 뜰 수 있는 유일한 행성이다.',
  6: '자전축이 98도 기운 채 옆으로 구르는 얼음 거성. 메탄 대기가 청록빛을 낸다.',
  7: '태양계 가장 바깥의 얼음 거성. 시속 2,000km의 폭풍이 부는 짙푸른 대기를 가진다.',
}

/**
 * 행성 설명 — 렌더(planetTexture)와 같은 정규화 궤도 x로 온도대/가스 클래스를 갈라
 * 화면에 보이는 표면 모습과 설명이 일치한다. x가 null이면(HZ 없는 계) 종류 폴백.
 */
export function planetDescriptionOf(planet: Planet, hzOrbit: number | null): string {
  if (planet.isHomeWorld === true) return HOME_WORLD_DESCRIPTION
  if (planet.starId === SOL_STAR_ID) {
    const solDescription = SOL_PLANET_DESCRIPTIONS[planet.index]
    if (solDescription != null) return solDescription
  }
  if (planet.kind === 'rocky') {
    if (hzOrbit == null) return ROCKY_FALLBACK_DESCRIPTION
    return ROCKY_ZONE_DESCRIPTIONS[temperatureZoneAt(hzOrbit)]
  }
  if (hzOrbit == null) return GAS_FALLBACK_DESCRIPTION
  return GAS_CLASS_DESCRIPTIONS[gasClassOf(hzOrbit)]
}
