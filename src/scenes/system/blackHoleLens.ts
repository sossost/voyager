import { Vector2 } from 'three'

/**
 * 블랙홀 중력렌즈 — 화면공간 굴절 포스트 패스(high 티어)와 렌더 레이어 사이의 공유 상태.
 *
 * CurrentSystem이 매 프레임 현재 별이 블랙홀일 때 사건지평선의 *화면 좌표·반경*을 여기 게시하고,
 * BlackHoleLensingEffect가 update()에서 읽어 유니폼에 넣는다. 연속 값은 ref/모듈 상태 + useFrame만
 * (철칙 6 — store 금지). high 티어 전용 + LOD 게이팅이라 평소 비활성(uActive=0)이면 거의 무비용.
 */
export const blackHoleLens = {
  /** 렌즈 활성 — 현재 별이 블랙홀이고 근접(LOD 안)일 때만 true. */
  active: false,
  /** 사건지평선 화면 중심 (UV, [0,1]). */
  center: new Vector2(0.5, 0.5),
  /** 사건지평선 화면 반경 (세로 UV 기준). 가로는 셰이더가 aspect로 보정. */
  radius: 0,
  /** 굴절 세기 — 광자구 근처 휘어짐 양. */
  strength: 0,
}

export function clearBlackHoleLens(): void {
  blackHoleLens.active = false
}
