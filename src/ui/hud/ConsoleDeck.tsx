import { useMemo } from 'react'

import { planetById } from '@/engine'
import { starById } from '@/engine/galaxy/position'
import { cameraActions } from '@/scenes/shared/cameraActions'
import { WARP_FLASH_IN_MS, WARP_STAGE_A_MS } from '@/scenes/warp/warpTimeline'
import { useGameStore } from '@/store'

/** 경로선은 구간이 1개는 있어야 의미가 있다 — 그 전에는 토글을 숨긴다. */
const MIN_STARS_FOR_JOURNEY = 2

/** 워프 진행 라인 길이 — 발동부터 플래시 피크(씬 스왑)까지. */
const WARP_PROGRESS_MS = WARP_STAGE_A_MS + WARP_FLASH_IN_MS

/**
 * 콘솔 상태 라인 (결정 42) — 데크 중앙에서 모드·선택 상태를 모노 한 줄로 중계한다.
 * 계기판이 "살아있다"는 신호이자 상시 온보딩.
 */
function DeckStatusLine() {
  const seed = useGameStore((state) => state.seed)
  const scene = useGameStore((state) => state.scene)
  const selectedStarId = useGameStore((state) => state.selectedStarId)
  const selectedPlanetId = useGameStore((state) => state.selectedPlanetId)
  const currentStarId = useGameStore((state) => state.currentStarId)

  const text = useMemo(() => {
    if (scene.kind !== 'galaxy') return null

    if (scene.view === 'ship' && selectedPlanetId != null) {
      const planet = planetById(seed, selectedPlanetId)
      if (planet != null) return `${planet.name} 관측 중`
    }
    if (selectedStarId != null && selectedStarId !== currentStarId) {
      const star = starById(seed, selectedStarId)
      if (star != null) return `${star.name} 조준 중 — 항행 대기`
    }
    if (scene.view === 'perspective') return '목적지를 선택하십시오'

    const currentStar = currentStarId == null ? null : starById(seed, currentStarId)
    if (currentStar != null) return `${currentStar.name} 정박 중`
    return null
  }, [seed, scene, selectedStarId, selectedPlanetId, currentStarId])

  if (text == null) return null
  return <span className="deck-status">{text}</span>
}

/**
 * 콘솔 데크 (결정 42-c) — 하단 전폭 조작면. 기존 ShipFrame 장식 밴드를 실제
 * 계기판으로 승격: 모든 상시 조작(뷰 전환·카메라)이 여기에 격납된다.
 * 전 뷰 공통 골격, 내용물만 교체 — 워프 중엔 트레이가 수납되고(조작 잠금)
 * 하단 진행 라인이 워프 타임라인과 동기로 차오른다 (결정 42-e).
 */
export function ConsoleDeck() {
  const scene = useGameStore((state) => state.scene)
  const openPerspective = useGameStore((state) => state.openPerspective)
  const returnToShip = useGameStore((state) => state.returnToShip)
  const isJourneyPathVisible = useGameStore((state) => state.isJourneyPathVisible)
  const toggleJourneyPath = useGameStore((state) => state.toggleJourneyPath)
  const hasJourney = useGameStore((state) => state.visitedStars.size >= MIN_STARS_FOR_JOURNEY)

  const isWarping = scene.kind === 'warping'
  const isShipView = scene.kind === 'galaxy' && scene.view === 'ship'
  const isPerspective = scene.kind === 'galaxy' && scene.view === 'perspective'

  return (
    <div className="console-deck" data-warping={isWarping || undefined}>
      {isWarping ? (
        <span
          className="deck-progress"
          role="progressbar"
          aria-label="워프 진행"
          style={{ animationDuration: `${WARP_PROGRESS_MS}ms` }}
        />
      ) : null}

      <div className="deck-tray" aria-hidden={isWarping || undefined}>
        <div className="deck-cluster">
          <div className="deck-segment" role="group" aria-label="시점 전환">
            <button
              type="button"
              className="hud-button deck-segment-key"
              aria-pressed={isShipView}
              onClick={() => {
                if (isShipView === false) returnToShip()
              }}
            >
              ◉ 함교
            </button>
            <button
              type="button"
              className="hud-button deck-segment-key"
              aria-pressed={isPerspective}
              onClick={() => {
                if (isPerspective === false) openPerspective()
              }}
            >
              ▦ 항법
            </button>
          </div>
          {isPerspective && hasJourney ? (
            <button
              type="button"
              className="hud-button deck-key"
              aria-pressed={isJourneyPathVisible}
              onClick={toggleJourneyPath}
            >
              여정 경로
            </button>
          ) : null}
        </div>

        <DeckStatusLine />

        <div className="deck-cluster">
          <button
            type="button"
            className="hud-button deck-key deck-key-icon"
            aria-label={isPerspective ? '현재 위치로 복귀' : '별 방향으로 시선 복귀'}
            title={isPerspective ? '현재 위치로 복귀' : '별 방향으로 시선 복귀'}
            onClick={() => cameraActions.reset?.()}
          >
            ⟳
          </button>
          {isPerspective ? (
            <>
              <button
                type="button"
                className="hud-button deck-key deck-key-icon deck-zoom-key"
                aria-label="축소"
                onClick={() => cameraActions.zoomOut?.()}
              >
                −
              </button>
              <button
                type="button"
                className="hud-button deck-key deck-key-icon deck-zoom-key"
                aria-label="확대"
                onClick={() => cameraActions.zoomIn?.()}
              >
                ＋
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
