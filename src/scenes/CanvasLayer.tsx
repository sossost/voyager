import { Canvas } from '@react-three/fiber'
import { lazy, Suspense, useCallback, useRef, useState } from 'react'

import { SceneRouter } from '@/scenes/SceneRouter'
import { ContextLossGuard } from '@/scenes/shared/ContextLossGuard'
import { useGameStore } from '@/store'

const Perf = lazy(() =>
  import('r3f-perf').then((module) => ({ default: module.Perf })),
)

/** webglcontextrestored가 이 시간 안에 오지 않으면 Canvas를 리마운트해 컨텍스트를 재생성한다. */
const CONTEXT_RESTORE_TIMEOUT_MS = 3_000

/**
 * 앱 전체에서 유일한 <Canvas> (02-decisions.md 결정 15).
 * 씬 전환은 Canvas 내부에서 일어나며, 컨텍스트 손실 시에만 key로 리마운트한다.
 */
export function CanvasLayer() {
  const [canvasGeneration, setCanvasGeneration] = useState(0)
  const [isReconnecting, setIsReconnecting] = useState(false)
  const restoreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
        dpr={[1, 2]}
        onPointerMissed={() => useGameStore.getState().selectPlanet(null)}
      >
        <ContextLossGuard
          onContextLost={handleContextLost}
          onContextRestored={handleContextRestored}
        />
        <SceneRouter />
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
