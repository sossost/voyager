import { useGameStore } from '@/store'

export function NavigationControls() {
  const sceneKind = useGameStore((state) => state.scene.kind)
  const backToGalaxy = useGameStore((state) => state.backToGalaxy)
  const isJourneyPathVisible = useGameStore((state) => state.isJourneyPathVisible)
  const toggleJourneyPath = useGameStore((state) => state.toggleJourneyPath)

  if (sceneKind === 'warping') return null

  return (
    <nav className="navigation-controls" aria-label="화면 컨트롤">
      {sceneKind === 'galaxy' ? (
        <button
          type="button"
          className="hud-button"
          aria-pressed={isJourneyPathVisible}
          onClick={toggleJourneyPath}
        >
          여정 경로
        </button>
      ) : null}
      {sceneKind === 'system' ? (
        <button type="button" className="hud-button" onClick={backToGalaxy}>
          ← 은하 지도
        </button>
      ) : null}
    </nav>
  )
}
