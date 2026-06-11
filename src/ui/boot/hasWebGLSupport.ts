/**
 * WebGL 사용 가능 여부를 부트 시점에 1회 판정한다.
 * 실패 시 게임 진입을 차단하고 WebGLBlocked 안내 화면을 보여준다 (스펙 에러 케이스).
 */
export function hasWebGLSupport(): boolean {
  try {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    return context != null
  } catch {
    return false
  }
}
