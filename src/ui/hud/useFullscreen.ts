import { useEffect, useState } from 'react'

/**
 * 전체화면 상태 훅 (misc-ux) — 브라우저가 진실 원천(ESC로도 빠져나감)이라 store가 아닌
 * fullscreenchange 이벤트로 동기화한다. 미지원 환경(iOS Safari 등)은 isSupported=false.
 */
export function useFullscreen(): {
  isSupported: boolean
  isFullscreen: boolean
  toggle(): void
} {
  const [isFullscreen, setIsFullscreen] = useState(
    () => typeof document !== 'undefined' && document.fullscreenElement != null,
  )

  useEffect(() => {
    const handleChange = () => setIsFullscreen(document.fullscreenElement != null)
    document.addEventListener('fullscreenchange', handleChange)
    return () => document.removeEventListener('fullscreenchange', handleChange)
  }, [])

  const isSupported =
    typeof document !== 'undefined' && document.documentElement.requestFullscreen != null

  const toggle = () => {
    if (document.fullscreenElement != null) {
      void document.exitFullscreen()
      return
    }
    // 거부(iframe 정책 등)는 조용히 무시 — 게임 진행과 무관한 편의 기능.
    void document.documentElement.requestFullscreen().catch(() => undefined)
  }

  return { isSupported, isFullscreen, toggle }
}
