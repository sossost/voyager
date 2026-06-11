/**
 * 워프 3단 타임라인 (02-decisions.md 결정 16) — WarpStreaks(3D)와
 * WarpFlashOverlay(DOM)가 이 상수로 동기화된다.
 *
 *   A (0 ~ STAGE_A): 확대 → 응시 → 돌진 카메라 + 별 스트리크 가속 + FOV 60→85 펄스
 *   B (STAGE_A ~ +FLASH_IN): 청백(#f2f6ff, global.css .warp-flash) 플래시 차오름
 *   피크 (+FLASH_HOLD): 완전히 차오른 플래시 뒤에서 씬 스왑 — 히치 은닉
 *   C: 플래시 페이드아웃 → 태양계 공개
 */
export const WARP_STAGE_A_MS = 4_000
export const WARP_FLASH_IN_MS = 350
export const WARP_FLASH_HOLD_MS = 120
export const WARP_FLASH_OUT_MS = 650

export const WARP_FOV_REST = 60
export const WARP_FOV_PEAK = 85

/**
 * 스테이지 A 내부 서브 페이즈 경계 (진행도 0~1) — 카메라 리그와 스트리크가 동기화된다.
 * 확대(출발 항성으로 다이브, 우주선 시점) → 응시(시선을 목표로) → 돌진.
 * 스트리크·FOV 서지는 다이브가 끝난 뒤부터 점화 — 목표를 바라보며 워프가 켜진다.
 */
export const WARP_DIVE_END_PROGRESS = 0.3
export const WARP_TURN_END_PROGRESS = 0.5
