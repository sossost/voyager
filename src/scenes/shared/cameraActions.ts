/**
 * 카메라 액션 콜백 레지스트리 (백로그 I-2).
 * 활성 카메라 리그가 마운트 시 등록하고 언마운트 시 해제한다.
 * DOM 버튼이 이 콜백을 호출해 카메라를 제어한다 — store 오염 없음 (철칙 6).
 */
export const cameraActions: {
  reset: (() => void) | null
  zoomIn: (() => void) | null
  zoomOut: (() => void) | null
} = {
  reset: null,
  zoomIn: null,
  zoomOut: null,
}
