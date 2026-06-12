import { useEffect, useRef, useState } from 'react'

import { useGameStore } from '@/store'

type VtPhase = 'idle' | 'flicker' | 'scanline'

const VT_FLICKER_MS = 32
const VT_SCANLINE_MS = 400

/**
 * 은하뷰 ↔ 우주선뷰 전환 홀로그램 디졸브 (H-5).
 * WarpFlashOverlay 패턴 — 항상 마운트, useEffect로 타이밍 시퀀스 관리.
 * CSS는 view-transition.css의 [data-phase] 선택자가 처리한다.
 */
export function ViewTransitionOverlay() {
  const sceneView = useGameStore((state) =>
    state.scene.kind === 'galaxy' ? state.scene.view : null,
  )
  const setViewTransitioning = useGameStore((state) => state.setViewTransitioning)
  const [phase, setPhase] = useState<VtPhase>('idle')
  const prevViewRef = useRef<typeof sceneView>(null)

  useEffect(() => {
    const prev = prevViewRef.current
    prevViewRef.current = sceneView

    // 첫 마운트(prev = null)와 동일 뷰는 전환 생략
    if (prev == null || prev === sceneView) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setViewTransitioning(false)
      return
    }

    setPhase('flicker')
    const t1 = setTimeout(() => setPhase('scanline'), VT_FLICKER_MS)
    const t2 = setTimeout(() => {
      setPhase('idle')
      setViewTransitioning(false)
    }, VT_FLICKER_MS + VT_SCANLINE_MS)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [sceneView, setViewTransitioning])

  return (
    <>
      <div className="vt-flicker" data-phase={phase} aria-hidden="true" />
      <div className="vt-cover" data-phase={phase} aria-hidden="true" />
      <div className="vt-scanline" data-phase={phase} aria-hidden="true" />
    </>
  )
}
