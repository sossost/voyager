import { useFullscreen } from '@/ui/hud/useFullscreen'

/**
 * 전체화면 진입 키 (misc-ux) — 상단 바 상주 아이콘. 전체화면 중엔 HudLayer가 HUD를 통째로
 * 걷어내고 관찰 모드로 전환하므로(FullscreenExitKey만 남음) 이 버튼은 진입만 담당한다.
 */
export function FullscreenButton() {
  const { isSupported, toggle } = useFullscreen()
  if (!isSupported) return null

  return (
    <button
      type="button"
      className="hud-button hud-button-compact"
      aria-label="전체화면"
      title="전체화면 — UI를 숨기고 우주를 관찰합니다"
      onClick={toggle}
    >
      ⛶
    </button>
  )
}

/**
 * 전체화면 해제 키 — 관찰 모드에서 유일하게 남는 컨트롤. 낮은 존재감(반투명)으로
 * 구석에 상주하고, ESC로도 언제든 빠져나갈 수 있다.
 */
export function FullscreenExitKey() {
  const { toggle } = useFullscreen()

  return (
    <button
      type="button"
      className="hud-button hud-button-compact fullscreen-exit-key"
      aria-label="전체화면 해제"
      title="전체화면 해제 (ESC)"
      onClick={toggle}
    >
      ⛶ 해제
    </button>
  )
}
