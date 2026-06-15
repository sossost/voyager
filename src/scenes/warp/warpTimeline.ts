/**
 * 워프 3단 타임라인 (02-decisions.md 결정 16) — WarpStreaks(3D)와
 * WarpFlashOverlay(DOM)가 이 상수로 동기화된다.
 *
 *   A (0 ~ STAGE_A): 우주선 시점 컷 → 홀드(예열) → 돌진 카메라 + 스트리크 + FOV 60→85 펄스
 *   B (STAGE_A ~ +FLASH_IN): 청백(#f2f6ff, global.css .warp-flash) 플래시 차오름
 *   피크 (+FLASH_HOLD): 완전히 차오른 플래시 뒤에서 씬 스왑 — 히치 은닉
 *   C: 플래시 페이드아웃 → 태양계 공개
 */
export const WARP_STAGE_A_MS = 3_200
export const WARP_FLASH_IN_MS = 350
export const WARP_FLASH_HOLD_MS = 120
export const WARP_FLASH_OUT_MS = 650

export const WARP_FOV_REST = 60
export const WARP_FOV_PEAK = 85

/**
 * 워프 시퀀스 박자 (스테이지 A 진행도 0~1) — WarpCameraRig(카메라)와 WarpReadout(게이지·라벨)이 공유.
 *  ① 정렬 [0, AIM)            — 목표 응시 회전
 *  ② 대기 [AIM, HOLD)         — 정렬 고정, 게이지 충전 직전 텀
 *  ③ 충전 [HOLD, CHARGE)      — 상단 게이지가 0→100% 차오른다 (카메라 정지)
 *  ④ 반동 [CHARGE, IGNITION)  — 게이지 만충 → 목표 반대로 후퇴(wind-up)
 *  ⑤ 돌진 [IGNITION, 1]       — 큐빅 가속(뿜) + 스트리크·FOV 서지 동시 점화
 * 발동 즉시 우주선 시점으로 컷된다(결정 34). 카메라는 ②③ 동안 정지(게이지만 진행) —
 * 반동·돌진 연출은 게이지 만충(CHARGE) 후에 시작한다(사용자 피드백). 점화를 0.38로 둬 충전을 충분히 보인다.
 */
export const WARP_AIM_PROGRESS = 0.07
export const WARP_HOLD_PROGRESS = 0.11
export const WARP_CHARGE_PROGRESS = 0.32
export const WARP_IGNITION_PROGRESS = 0.38
