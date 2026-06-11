import { GalaxyScene } from '@/scenes/galaxy/GalaxyScene'
import { SystemScene } from '@/scenes/system/SystemScene'
import { WarpCameraRig } from '@/scenes/warp/WarpCameraRig'
import { WarpStreaks } from '@/scenes/warp/WarpStreaks'
import { useGameStore } from '@/store'

/**
 * scene.kind → 씬 컴포넌트. 전이 로직은 전부 store 가드 액션에 있다 (결정 15).
 * 'warping'은 은하 씬 위에 워프 카메라 리그 + 스트리크가 얹힌 전이 상태 —
 * 도착(씬 스왑) 타이밍은 WarpFlashOverlay(DOM)가 플래시 피크에 맞춰 호출한다 (결정 16).
 * galaxy ↔ warping 양쪽에서 GalaxyScene을 같은 트리 위치에 유지해 리마운트를 막는다 —
 * 워프 연출이 플레이어가 보던 "현 위치" 카메라 포즈에서 끊김 없이 시작된다 (결정 26).
 */
export function SceneRouter() {
  const sceneKind = useGameStore((state) => state.scene.kind)

  switch (sceneKind) {
    case 'galaxy':
    case 'warping':
      return (
        <>
          <GalaxyScene />
          {sceneKind === 'warping' ? (
            <>
              <WarpCameraRig />
              <WarpStreaks />
            </>
          ) : null}
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
