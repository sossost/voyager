import { useGameStore } from '@/store'

/** 경로선은 구간이 1개는 있어야 의미가 있다 — 그 전에는 토글을 숨긴다. */
const MIN_STARS_FOR_JOURNEY = 2

export function NavigationControls() {
  const sceneKind = useGameStore((state) => state.scene.kind)
  const backToGalaxy = useGameStore((state) => state.backToGalaxy)
  const isJourneyPathVisible = useGameStore((state) => state.isJourneyPathVisible)
  const toggleJourneyPath = useGameStore((state) => state.toggleJourneyPath)
  const hasJourney = useGameStore((state) => state.visitedStars.size >= MIN_STARS_FOR_JOURNEY)

  if (sceneKind === 'warping') return null

  return (
    <nav className="navigation-controls" aria-label="화면 컨트롤">
      {sceneKind === 'galaxy' && hasJourney ? (
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
