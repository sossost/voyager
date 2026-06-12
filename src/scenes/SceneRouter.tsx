import { GalaxyScene } from '@/scenes/galaxy/GalaxyScene'
import { WarpCameraRig } from '@/scenes/warp/WarpCameraRig'
import { WarpStreaks } from '@/scenes/warp/WarpStreaks'
import { useGameStore } from '@/store'

/**
 * scene.kind → 씬 컴포넌트. 전이 로직은 전부 store 가드 액션에 있다 (결정 15).
 * 항성계 씬이 은하 씬에 통합되어(결정 41) 모든 상태가 GalaxyScene 하나 위에서 동작한다 —
 * 'warping'은 그 위에 워프 카메라 리그 + 스트리크가 얹힌 전이 상태로, 도착(우주선 뷰 전이)
 * 타이밍은 WarpFlashOverlay(DOM)가 플래시 피크에 맞춰 호출한다 (결정 16).
 * GalaxyScene을 항상 같은 트리 위치에 유지해 리마운트를 막는다 — 워프 연출이 플레이어가
 * 보던 "현 위치" 카메라 포즈에서 끊김 없이 시작된다 (결정 26).
 */
export function SceneRouter() {
  const isWarping = useGameStore((state) => state.scene.kind === 'warping')

  return (
    <>
      <GalaxyScene />
      {isWarping ? (
        <>
          <WarpCameraRig />
          <WarpStreaks />
        </>
      ) : null}
    </>
  )
}
