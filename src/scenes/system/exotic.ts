import type { StarKind } from '@/engine'

/**
 * 이색 천체 렌더 파라미터 (결정 6) — 형태 상수. 순수 함수·상수만, 컴포넌트 없음.
 * 회전·도플러 같은 시간 함수는 각 컴포넌트의 useFrame에 산다. GEN_VERSION 무관.
 */

/**
 * 종류별 본체 시각/충돌 반경 배수 (결정 12). main_sequence=1이라 기존 단일 항성
 * 렌더가 한 픽셀도 안 바뀐다. multiplicity.ts의 renderedRadius(충돌·궤도)와
 * CurrentSystem(시각 메시)이 **같은 값**을 써야 별/행성 관통이 없다.
 */
/**
 * 펄서 형태 상수 (스텔라리스형 — 펄서 결정 1~5 개정 2026-06-17). 시간 함수(맥동·소용돌이)는
 * Pulsar.tsx의 useFrame에 산다. GEN_VERSION 무관(렌더 전용).
 * 비주얼 = ① 파란 발광 본체 ② 밝은 축 제트(밑동 불룩) ③ 적도 자기권 소용돌이. 콘 셸·서치라이트
 * 빔은 폐기(판때기로 보임 — 사용자 피드백). 제트는 교차 빌보드 쿼드(어느 각도서도 면이 보임).
 */
/** 자전축의 3/4 시점 틸트 [x,y,z] — 제트·자기권 디스크를 비스듬히 보이게(정면 정렬 납작 방지). */
export const PULSAR_BASE_TILT: readonly [number, number, number] = [0.42, 0, 0.16]
/** 상대론적 제트 전체 길이(양극 합) = 본체 반경 × 이 배수. */
export const PULSAR_JET_LEN_FACTOR = 22
/** 상대론적 제트 폭 = 본체 반경 × 이 배수 (가늘게). */
export const PULSAR_JET_WIDTH_FACTOR = 2.6
/**
 * 자기권 소용돌이 외곽 반경 = 본체 반경 × 이 배수. 첫 행성 궤도(orbitRadiusOf 최소 ≈ 8.6)를
 * 침범하지 않게 별에 바짝 붙인다: radius(=3×0.7=2.1) × 3.5 ≈ 7.4 < 8.6 (스텔라리스도 타이트).
 */
export const PULSAR_DISK_OUTER_FACTOR = 3.5
/** 맥동(펄스) 최저 강도 — 완전 소등하지 않는다(대비 상한, 광과민성, 결정 5). */
export const PULSAR_PULSE_MIN = 0.6
/** 맥동 주파수 (Hz) — ≤3Hz(광과민성, 결정 5). 은은한 호흡 같은 맥동. */
export const PULSAR_PULSE_HZ = 0.5

/**
 * 펄서 맥동 강도 — 경과 시간을 [PULSE_MIN, 1] 강도로 매핑(완전 소등 없음·대비 상한, 광과민성
 * 결정 5). 순수 함수라 단위 테스트 가능(Pulsar.tsx useFrame이 호출). 주파수 ≤3Hz.
 */
export function pulsarPulse(elapsed: number): number {
  const wave = 0.5 + 0.5 * Math.sin(elapsed * PULSAR_PULSE_HZ * Math.PI * 2)
  return PULSAR_PULSE_MIN + (1 - PULSAR_PULSE_MIN) * wave
}

export function kindRadiusFactor(kind: StarKind): number {
  switch (kind) {
    case 'black_hole':
      // 사건지평선 시각 반경 배수 — 항성보다 작다(<1). 레이마칭 렌즈가 디스크(rs×18)·렌즈(rs×28)를
      // 그려 전체 화면 크기를 좌우하므로, 디스크 외곽이 일반 항성 코로나와 비슷해지게 0.32로 둔다.
      return 0.32
    case 'pulsar':
      // 중성자성 본체 — 항성보다 작다(<1). 제트·자기권이 시각 크기를 좌우하므로 본체는 작게 두어
      // Bloom이 본체를 백색으로 메우지 않게 한다(블랙홀 교훈 2). 본체는 파란 발광 구체.
      return 0.7
    case 'red_giant':
      // 적색거성 — 항성보다 크게(>1) 부풀린다. planetClearanceOffset(단일성계 분기)이 이 반경에
      // 맞춰 첫 행성 궤도를 바깥으로 밀어 "내행성을 삼킨" 인상을 만든다 (exotic-stars 결정 3).
      // 첫 행성이 본체 안으로 들어가 클릭이 막히지 않도록 2.5에서 멈춘다(반경 7.5 < 첫 궤도 ≈8.6).
      return 2.5
    case 'white_dwarf':
      // 백색왜성 — 항성보다 초소형(≪1). 지구 크기의 초고밀도 잔해라 작고 강렬한 청백 발광점.
      return 0.35
    case 'main_sequence':
      return 1
    default: {
      const exhaustive: never = kind
      throw new Error(`Unhandled StarKind: ${String(exhaustive)}`)
    }
  }
}

/** 본체 표면 발광·코로나 변조 파라미터 (StarSurface emissiveBoost·coronaScale). */
export interface KindSurface {
  readonly emissiveBoost: number
  readonly coronaScale: number
}

/**
 * StarSurface로 렌더하는 별(주계열성·적색거성·백색왜성)의 표면 변조 (결정 4).
 * 블랙홀·펄서는 전용 컴포넌트라 여기로 오지 않지만(CurrentSystem 분기) exhaustive로 둔다.
 * main_sequence는 {1,1} = 기존 단일 항성 렌더 불변.
 */
export function kindSurface(kind: StarKind): KindSurface {
  switch (kind) {
    case 'main_sequence':
      return { emissiveBoost: 1, coronaScale: 1 }
    case 'red_giant':
      // 부푼 저온 표면 — 발광은 낮춰(식은 적색) 코로나는 크게 퍼뜨려 거대 적색 외피를 만든다.
      return { emissiveBoost: 0.85, coronaScale: 1.6 }
    case 'white_dwarf':
      // 초고온 잔해 — 작은 본체를 강한 발광으로 보상하고 코로나는 바짝 붙인다(컴팩트한 청백 점광).
      return { emissiveBoost: 1.7, coronaScale: 0.6 }
    case 'black_hole':
    case 'pulsar':
      // 전용 컴포넌트(BlackHole·Pulsar)가 렌더 — StarSurface 미경유. 안전 기본값.
      return { emissiveBoost: 1, coronaScale: 1 }
    default: {
      const exhaustive: never = kind
      throw new Error(`Unhandled StarKind: ${String(exhaustive)}`)
    }
  }
}
