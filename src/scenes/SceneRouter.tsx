import { GalaxyScene } from '@/scenes/galaxy/GalaxyScene'
import { SystemScene } from '@/scenes/system/SystemScene'
import { WarpStreaks } from '@/scenes/warp/WarpStreaks'
import { useGameStore } from '@/store'

/**
 * scene.kind → 씬 컴포넌트. 전이 로직은 전부 store 가드 액션에 있다 (결정 15).
 * 'warping'은 은하 씬 위에 스트리크가 얹힌 전이 상태 — 도착(씬 스왑) 타이밍은
 * WarpFlashOverlay(DOM)가 플래시 피크에 맞춰 호출한다 (결정 16).
 */
export function SceneRouter() {
  const sceneKind = useGameStore((state) => state.scene.kind)

  switch (sceneKind) {
    case 'galaxy':
      return <GalaxyScene />
    case 'warping':
      return (
        <>
          <GalaxyScene />
          <WarpStreaks />
        </>
      )
    case 'system':
      return <SystemScene />
    default: {
      const _exhaustive: never = sceneKind
      throw new Error(`처리되지 않은 씬: ${String(_exhaustive)}`)
    }
  }
}
