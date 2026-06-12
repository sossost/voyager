import { useGameStore } from '@/store'

/** 경로선은 구간이 1개는 있어야 의미가 있다 — 그 전에는 토글을 숨긴다. */
const MIN_STARS_FOR_JOURNEY = 2

export function NavigationControls() {
  const scene = useGameStore((state) => state.scene)
  const backToGalaxy = useGameStore((state) => state.backToGalaxy)
  const openGalaxyMap = useGameStore((state) => state.openGalaxyMap)
  const closeGalaxyMap = useGameStore((state) => state.closeGalaxyMap)
  const isJourneyPathVisible = useGameStore((state) => state.isJourneyPathVisible)
  const toggleJourneyPath = useGameStore((state) => state.toggleJourneyPath)
  const hasJourney = useGameStore((state) => state.visitedStars.size >= MIN_STARS_FOR_JOURNEY)

  if (scene.kind === 'warping') return null

  if (scene.kind === 'system') {
    return (
      <nav className="navigation-controls" aria-label="화면 컨트롤">
        <button type="button" className="hud-button" onClick={backToGalaxy}>
          ← 항성계 이탈
        </button>
      </nav>
    )
  }

  if (scene.view === 'map') {
    return (
      <nav className="navigation-controls" aria-label="화면 컨트롤">
        <button type="button" className="hud-button" onClick={closeGalaxyMap}>
          ← 우주선
        </button>
        {hasJourney ? (
          <button
            type="button"
            className="hud-button"
            aria-pressed={isJourneyPathVisible}
            onClick={toggleJourneyPath}
          >
            여정 경로
          </button>
        ) : null}
      </nav>
    )
  }

  return (
    <nav className="navigation-controls" aria-label="화면 컨트롤">
      <button type="button" className="hud-button" onClick={openGalaxyMap}>
        은하 지도
      </button>
    </nav>
  )
}
