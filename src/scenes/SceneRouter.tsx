import { useEffect } from 'react'

import { GalaxyScene } from '@/scenes/galaxy/GalaxyScene'
import { SystemScenePlaceholder } from '@/scenes/system/SystemScenePlaceholder'
import { useGameStore } from '@/store'

/** Phase 4의 WarpEffect 3단 타임라인이 들어오기 전까지의 임시 연출 시간. */
const PLACEHOLDER_WARP_DURATION_MS = 400

/** Phase 3 임시 워프 — 짧은 지연 후 도착 처리한다. Phase 4에서 WarpEffect로 대체. */
function WarpPlaceholder() {
  const onWarpComplete = useGameStore((state) => state.onWarpComplete)

  useEffect(() => {
    const timer = setTimeout(onWarpComplete, PLACEHOLDER_WARP_DURATION_MS)
    return () => clearTimeout(timer)
  }, [onWarpComplete])

  return <GalaxyScene />
}

/** scene.kind → 씬 컴포넌트. 전이 로직은 전부 store 가드 액션에 있다 (결정 15). */
export function SceneRouter() {
  const sceneKind = useGameStore((state) => state.scene.kind)

  switch (sceneKind) {
    case 'galaxy':
      return <GalaxyScene />
    case 'warping':
      return <WarpPlaceholder />
    case 'system':
      return <SystemScenePlaceholder />
    default: {
      const _exhaustive: never = sceneKind
      throw new Error(`처리되지 않은 씬: ${String(_exhaustive)}`)
    }
  }
}
