import { useEffect, useState } from 'react'

import {
  WARP_FLASH_HOLD_MS,
  WARP_FLASH_IN_MS,
  WARP_STAGE_A_MS,
} from '@/scenes/warp/warpTimeline'

import { useGameStore } from '@/store'

/**
 * 워프 화이트 플래시 (DOM, z-20) — 플래시가 완전히 차오른 피크에 onWarpComplete를
 * 호출해 씬 교체·셰이더 첫 컴파일 히치를 백색 뒤에 숨긴다 (결정 16).
 * 항상 마운트되어 있어 씬 스왑 후에도 페이드아웃이 끊기지 않는다.
 */
export function WarpFlashOverlay() {
  const isWarping = useGameStore((state) => state.scene.kind === 'warping')
  const onWarpComplete = useGameStore((state) => state.onWarpComplete)
  const [isFlashOn, setIsFlashOn] = useState(false)

  useEffect(() => {
    if (!isWarping) {
      setIsFlashOn(false) // 도착 — CSS transition으로 페이드아웃
      return
    }

    const flashTimer = setTimeout(() => setIsFlashOn(true), WARP_STAGE_A_MS)
    const arriveTimer = setTimeout(
      onWarpComplete,
      WARP_STAGE_A_MS + WARP_FLASH_IN_MS + WARP_FLASH_HOLD_MS,
    )
    return () => {
      clearTimeout(flashTimer)
      clearTimeout(arriveTimer)
    }
  }, [isWarping, onWarpComplete])

  return <div className={isFlashOn ? 'warp-flash warp-flash-on' : 'warp-flash'} aria-hidden="true" />
}
