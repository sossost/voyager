import { useEffect, useState } from 'react'

/** Fullscreen API 미지원 환경(iOS Safari 등) — 버튼 자체를 숨긴다. */
function isFullscreenSupported(): boolean {
  return typeof document !== 'undefined' && document.documentElement.requestFullscreen != null
}

/**
 * 전체화면 토글 (misc-ux) — 브라우저 크롬을 걷어내 몰입감을 높인다. 상태는 브라우저가
 * 진실 원천(ESC로도 빠져나감)이라 store가 아닌 fullscreenchange 이벤트로 라벨을 동기화한다.
 */
export function FullscreenButton() {
  const [isFullscreen, setIsFullscreen] = useState(
    () => typeof document !== 'undefined' && document.fullscreenElement != null,
  )

  useEffect(() => {
    const handleChange = () => setIsFullscreen(document.fullscreenElement != null)
    document.addEventListener('fullscreenchange', handleChange)
    return () => document.removeEventListener('fullscreenchange', handleChange)
  }, [])

  if (!isFullscreenSupported()) return null

  const toggleFullscreen = () => {
    if (document.fullscreenElement != null) {
      void document.exitFullscreen()
      return
    }
    // 거부(iframe 정책 등)는 조용히 무시 — 게임 진행과 무관한 편의 기능.
    void document.documentElement.requestFullscreen().catch(() => undefined)
  }

  return (
    <button
      type="button"
      className="hud-button hud-button-compact"
      aria-pressed={isFullscreen}
      onClick={toggleFullscreen}
    >
      {isFullscreen ? '전체화면 해제' : '전체화면'}
    </button>
  )
}
