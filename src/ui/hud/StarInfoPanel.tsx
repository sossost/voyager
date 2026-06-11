import { useMemo } from 'react'

import { starById } from '@/engine/galaxy/position'
import { SPECTRAL_LABELS } from '@/scenes/galaxy/spectral'
import { useGameStore } from '@/store'

export function StarInfoPanel() {
  const seed = useGameStore((state) => state.seed)
  const sceneKind = useGameStore((state) => state.scene.kind)
  const selectedStarId = useGameStore((state) => state.selectedStarId)
  const currentStarId = useGameStore((state) => state.currentStarId)
  const isVisited = useGameStore(
    (state) => state.selectedStarId != null && state.visitedStars.has(state.selectedStarId),
  )
  const selectStar = useGameStore((state) => state.selectStar)
  const warpTo = useGameStore((state) => state.warpTo)
  const enterCurrentSystem = useGameStore((state) => state.enterCurrentSystem)

  const star = useMemo(
    () => (selectedStarId == null ? null : starById(seed, selectedStarId)),
    [seed, selectedStarId],
  )

  if (sceneKind !== 'galaxy' || selectedStarId == null || star == null) return null

  const isCurrentStar = selectedStarId === currentStarId

  return (
    // 홀로그램 콜아웃 (결정 37) — StarCalloutProjector가 매 프레임 항성의 화면
    // 좌표로 transform을 갱신한다. 투영 전 첫 프레임 깜빡임 방지로 기본 hidden.
    <div className="callout" data-star-callout>
      <span className="callout-dot" aria-hidden="true" />
      <span className="callout-line" aria-hidden="true" />
      <section className="hud-panel star-info-panel" aria-label="별 정보">
        <header className="hud-panel-header">
          <h2 className="hud-panel-title">{star.name}</h2>
          <button
            type="button"
            className="hud-icon-button"
            aria-label="패널 닫기"
            onClick={() => selectStar(null)}
          >
            ×
          </button>
        </header>

        <dl className="hud-panel-facts">
          <div className="hud-fact">
            <dt>분광형</dt>
            <dd>{SPECTRAL_LABELS[star.spectral]}</dd>
          </div>
          <div className="hud-fact">
            <dt>상태</dt>
            <dd>
              {isCurrentStar ? (
                <span className="badge badge-current">현재 위치</span>
              ) : isVisited ? (
                <span className="badge badge-visited">방문함</span>
              ) : (
                <span className="badge badge-unknown">미탐사</span>
              )}
            </dd>
          </div>
        </dl>

        {isCurrentStar ? (
          <button
            type="button"
            className="hud-button hud-button-primary"
            onClick={enterCurrentSystem}
          >
            별계 진입
          </button>
        ) : (
          <button
            type="button"
            className="hud-button hud-button-primary"
            onClick={() => warpTo(selectedStarId)}
          >
            항행
          </button>
        )}
      </section>
    </div>
  )
}
