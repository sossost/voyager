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
 * 점화 시점 (스테이지 A 진행도 0~1) — 발동 즉시 우주선 시점으로 컷되고(결정 34),
 * 이 진행도까지는 홀드(엔진 예열 — 전진 크리프). 이후 스트리크·FOV 서지·돌진이 함께 켜진다.
 */
export const WARP_IGNITION_PROGRESS = 0.18
