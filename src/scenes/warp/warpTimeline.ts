/**
 * 워프 타임라인 (02-decisions.md 결정 16) — WarpCameraRig·WarpReadout·WarpStreaks·
 * WarpFlashOverlay가 이 상수로 동기화된다.
 *
 *   A (0 ~ STAGE_A): 5박자 시퀀스 (아래 BEAT 길이)
 *   B (STAGE_A ~ +FLASH_IN): 청백(#f2f6ff, global.css .warp-flash) 플래시 차오름
 *   피크 (+FLASH_HOLD): 완전히 차오른 플래시 뒤에서 씬 스왑 — 히치 은닉
 *   C: 플래시 페이드아웃 → 태양계 공개
 */

/**
 * 스테이지 A 5박자의 길이 (ms) — 여기만 만지면 된다. 각 단계가 유저에게 또렷이 읽히도록
 * 넉넉하게 둔다(연출은 길고 여유 있게). 합이 WARP_STAGE_A_MS, 진행도 분기점은 누적합에서 파생.
 *  ① 정렬   목표 응시 회전
 *  ② 대기   정렬 고정, 충전 직전 텀
 *  ③ 충전   상단 게이지 0→100% (카메라 정지)
 *  ④ 반동   게이지 만충 → 목표 반대로 후퇴(wind-up)
 *  ⑤ 돌진   큐빅 가속(뿜) + 스트리크·FOV 서지
 */
const AIM_MS = 700
const HOLD_MS = 450
const CHARGE_MS = 1_400
const RECOIL_MS = 550
const RUSH_MS = 1_900

export const WARP_STAGE_A_MS = AIM_MS + HOLD_MS + CHARGE_MS + RECOIL_MS + RUSH_MS
export const WARP_FLASH_IN_MS = 350
export const WARP_FLASH_HOLD_MS = 120
export const WARP_FLASH_OUT_MS = 650

export const WARP_FOV_REST = 60
export const WARP_FOV_PEAK = 85

/**
 * 박자 분기점 (스테이지 A 진행도 0~1) — 위 BEAT 누적합에서 파생. WarpCameraRig(카메라)와
 * WarpReadout(게이지·라벨)이 공유한다. 발동 즉시 우주선 시점으로 컷된다(결정 34).
 * 카메라는 ②③(대기·충전) 동안 정지하고 게이지만 진행 — 반동·돌진 연출은 게이지 만충 후 시작(사용자 피드백).
 */
export const WARP_AIM_PROGRESS = AIM_MS / WARP_STAGE_A_MS
export const WARP_HOLD_PROGRESS = (AIM_MS + HOLD_MS) / WARP_STAGE_A_MS
export const WARP_CHARGE_PROGRESS = (AIM_MS + HOLD_MS + CHARGE_MS) / WARP_STAGE_A_MS
export const WARP_IGNITION_PROGRESS =
  (AIM_MS + HOLD_MS + CHARGE_MS + RECOIL_MS) / WARP_STAGE_A_MS
