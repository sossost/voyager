/**
 * 워프 3단 타임라인 (02-decisions.md 결정 16) — WarpStreaks(3D)와
 * WarpFlashOverlay(DOM)가 이 상수로 동기화된다.
 *
 *   A (0 ~ STAGE_A): 별 스트리크 가속 + FOV 60→85 펄스
 *   B (STAGE_A ~ +FLASH_IN): 청백(#f2f6ff, global.css .warp-flash) 플래시 차오름
 *   피크 (+FLASH_HOLD): 완전히 차오른 플래시 뒤에서 씬 스왑 — 히치 은닉
 *   C: 플래시 페이드아웃 → 태양계 공개
 */
export const WARP_STAGE_A_MS = 900
export const WARP_FLASH_IN_MS = 300
export const WARP_FLASH_HOLD_MS = 120
export const WARP_FLASH_OUT_MS = 450

export const WARP_FOV_REST = 60
export const WARP_FOV_PEAK = 85
