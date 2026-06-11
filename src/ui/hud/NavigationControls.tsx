import { useGameStore } from '@/store'

export function NavigationControls() {
  const sceneKind = useGameStore((state) => state.scene.kind)
  const backToGalaxy = useGameStore((state) => state.backToGalaxy)

  if (sceneKind !== 'system') return null

  return (
    <nav className="navigation-controls" aria-label="화면 이동">
      <button type="button" className="hud-button" onClick={backToGalaxy}>
        ← 은하 지도
      </button>
    </nav>
  )
}
