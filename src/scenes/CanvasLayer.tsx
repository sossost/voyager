import { Canvas } from '@react-three/fiber'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { starById } from '@/engine'
import { QUALITY_PRESETS } from '@/quality/presets'
import { QualityAdapter } from '@/quality/QualityAdapter'
import { SceneRouter } from '@/scenes/SceneRouter'
import { SimClock } from '@/scenes/SimClock'
import { ContextLossGuard } from '@/scenes/shared/ContextLossGuard'
import { useGameStore } from '@/store'

const Perf = lazy(() =>
  import('r3f-perf').then((module) => ({ default: module.Perf })),
)

/** high 티어 전용 — medium/low 기기는 이 번들을 받지 않는다 (동적 로드). */
const PostEffects = lazy(() => import('@/scenes/shared/PostEffects'))

/** webglcontextrestored가 이 시간 안에 오지 않으면 Canvas를 리마운트해 컨텍스트를 재생성한다. */
const CONTEXT_RESTORE_TIMEOUT_MS = 3_000

function useIsDocumentHidden(): boolean {
  const [isHidden, setIsHidden] = useState(false)

  useEffect(() => {
    const handleVisibilityChange = () => setIsHidden(document.hidden)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  return isHidden
}

/**
 * 앱 전체에서 유일한 <Canvas> (02-decisions.md 결정 15).
 * 탭 비활성·풀스크린 오버레이(도감/일지) 동안 렌더 루프를 정지한다 (배터리 AC).
 */
export function CanvasLayer() {
  const [canvasGeneration, setCanvasGeneration] = useState(0)
  const [isReconnecting, setIsReconnecting] = useState(false)
  const restoreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const qualityTier = useGameStore((state) => state.qualityTier)
  const isFullOverlayOpen = useGameStore((state) => state.overlay != null)
  const isDocumentHidden = useIsDocumentHidden()
  const preset = QUALITY_PRESETS[qualityTier]
  const shouldPauseRendering = isDocumentHidden || isFullOverlayOpen

  // 포스트 패스 마운트 — high는 블룸 때문에 상시, medium/low는 블랙홀에 있을 때만(약기기 비용 보호).
  // 블랙홀 레이마칭 렌즈는 모든 티어가 같은 형태를 그리되 스텝/SS를 티어별로 낮춘다(presets).
  const seed = useGameStore((state) => state.seed)
  const currentStarId = useGameStore((state) => state.currentStarId)
  const isAtBlackHole = useMemo(
    () => starById(seed, currentStarId)?.kind === 'black_hole',
    [seed, currentStarId],
  )
  const shouldRenderPostFx = preset.bloom || (isAtBlackHole && preset.blackHoleSteps > 0)

  const handleContextLost = useCallback(() => {
    setIsReconnecting(true)
    restoreTimerRef.current = setTimeout(() => {
      setCanvasGeneration((generation) => generation + 1)
      setIsReconnecting(false)
    }, CONTEXT_RESTORE_TIMEOUT_MS)
  }, [])

  const handleContextRestored = useCallback(() => {
    if (restoreTimerRef.current != null) {
      clearTimeout(restoreTimerRef.current)
      restoreTimerRef.current = null
    }
    setIsReconnecting(false)
  }, [])

  return (
    <div className="layer-canvas" data-layer="canvas">
      <Canvas
        key={canvasGeneration}
        camera={{ position: [0, 180, 320], fov: 60, near: 0.5, far: 30_000 }}
        dpr={[1, preset.dprMax]}
        frameloop={shouldPauseRendering ? 'never' : 'always'}
        onPointerMissed={() => useGameStore.getState().selectPlanet(null)}
      >
        <ContextLossGuard
          onContextLost={handleContextLost}
          onContextRestored={handleContextRestored}
        />
        <SimClock />
        <QualityAdapter />
        <SceneRouter />
        {shouldRenderPostFx ? (
          <Suspense fallback={null}>
            <PostEffects />
          </Suspense>
        ) : null}
        {import.meta.env.DEV ? (
          <Suspense fallback={null}>
            <Perf position="top-left" />
          </Suspense>
        ) : null}
      </Canvas>
      {isReconnecting ? (
        <div className="reconnect-overlay" role="status">
          그래픽 장치와 재연결 중…
        </div>
      ) : null}
    </div>
  )
}
