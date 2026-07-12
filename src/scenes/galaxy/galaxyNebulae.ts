import { valueNoise3 } from '@/engine/noise/valueNoise'

/**
 * 성운 틴트 필드 — 배경 은하광의 색조 변주 (결정 40 2차).
 *
 * 1차(가우시안 블롭 광원)는 블롭 근처 항성계에서 하늘을 덮는 "오로라 커튼"이 되어
 * 기각됐다. 성운은 **광원이 아니라 배경의 성질**이어야 한다 — 실제 은하수 사진처럼
 * 띠 안에 H-알파(로즈)·반사성운(청록) 기운이 군데군데 배어 있는 색조 패치.
 *
 * 구현: 적분되는 은하광 자체의 색을 위치 노이즈로 변조한다. 더해지는 빛이 없으므로
 * 어느 정박에서 봐도 항상 띠의 일부로만 읽히고, 가까이 가도 커튼이 생길 수 없다.
 * 노이즈는 시드 무관 결정론 — 모든 플레이어가 같은 색조의 하늘을 본다.
 *
 * 소비처: 은하 전도(GalaxyNebula) — 평면도 텍셀 색에 색조 변조.
 * (구 우주선 뷰 밴드 파노라마도 공유했으나 밴드는 galaxy-realism-pass에서 제거됨)
 */

/** 색조 패치의 공간 주파수 — 파장 ~11섹터, 클럼프 노이즈(0.18)보다 굵은 가스 구름 스케일. */
const TINT_FREQUENCY = 0.09
/** 노이즈 솔트 — 엔진 클럼프(7)·행성 텍스처와 겹치지 않게. */
const ROSE_SALT = 11
const TEAL_SALT = 12

/**
 * 색조 목표색 — 발광 성운(로즈 H-알파)·반사 성운(청색). 반사성운은 실사진에서 청록이
 * 아니라 푸른 산란색이다 (플레이아데스 등, galaxy-realism-pass 톤 정리).
 */
export const NEBULA_ROSE_RGB = [255, 122, 142] as const
export const NEBULA_TEAL_RGB = [150, 190, 255] as const
/** 색조 최대 혼합률 — 띠 고유색(한색 팔·난색 벌지)을 잃지 않는 상한. */
export const NEBULA_TINT_MAX_BLEND = 0.58

export interface NebulaTint {
  /** 로즈(발광 가스) 노이즈 [0, 1]. */
  readonly rose: number
  /** 청록(반사 가스) 노이즈 [0, 1]. */
  readonly teal: number
}

/** 섹터 좌표의 성운 색조 — 순수·결정론. */
export function nebulaTintAt(sx: number, sy: number, sz: number): NebulaTint {
  return {
    rose: valueNoise3(sx * TINT_FREQUENCY, sy * TINT_FREQUENCY, sz * TINT_FREQUENCY, ROSE_SALT),
    teal: valueNoise3(sx * TINT_FREQUENCY, sy * TINT_FREQUENCY, sz * TINT_FREQUENCY, TEAL_SALT),
  }
}

/** 노이즈 평균(0.5) 위 꼬리만 강도로 — 패치가 "군데군데"에만 맺히게 하는 문턱. */
export function nebulaTintShift(noiseValue: number): number {
  const shifted = (noiseValue - 0.55) * 2.2
  if (shifted < 0) return 0
  if (shifted > 1) return 1
  return shifted
}
