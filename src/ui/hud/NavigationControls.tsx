import { useGameStore } from '@/store'

/** 경로선은 구간이 1개는 있어야 의미가 있다 — 그 전에는 토글을 숨긴다. */
const MIN_STARS_FOR_JOURNEY = 2

export function NavigationControls() {
  const scene = useGameStore((state) => state.scene)
  const openPerspective = useGameStore((state) => state.openPerspective)
  const returnToShip = useGameStore((state) => state.returnToShip)
  const isJourneyPathVisible = useGameStore((state) => state.isJourneyPathVisible)
  const toggleJourneyPath = useGameStore((state) => state.toggleJourneyPath)
  const hasJourney = useGameStore((state) => state.visitedStars.size >= MIN_STARS_FOR_JOURNEY)

  if (scene.kind === 'warping') return null

  // 퍼스펙티브 뷰 (3인칭 항법) — 우주선 복귀 + 여정 경로 토글 (결정 41)
  if (scene.view === 'perspective') {
    return (
      <nav className="navigation-controls" aria-label="화면 컨트롤">
        <button type="button" className="hud-button" onClick={returnToShip}>
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

  // 우주선 뷰 (1인칭, 현재 항성계 안) — 은하 항법 뷰로 전환
  return (
    <nav className="navigation-controls" aria-label="화면 컨트롤">
      <button type="button" className="hud-button" onClick={openPerspective}>
        은하 항법
      </button>
    </nav>
  )
}
