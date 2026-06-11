import { useMemo } from 'react'

import { planetById } from '@/engine'
import { useGameStore } from '@/store'

const PLANET_KIND_LABELS = {
  rocky: '암석형',
  gas: '가스형',
} as const

export function PlanetPanel() {
  const seed = useGameStore((state) => state.seed)
  const sceneKind = useGameStore((state) => state.scene.kind)
  const selectedPlanetId = useGameStore((state) => state.selectedPlanetId)
  const isExplored = useGameStore(
    (state) => state.selectedPlanetId != null && state.exploredPlanets.has(state.selectedPlanetId),
  )
  const selectPlanet = useGameStore((state) => state.selectPlanet)
  const explore = useGameStore((state) => state.explore)

  const planet = useMemo(
    () => (selectedPlanetId == null ? null : planetById(seed, selectedPlanetId)),
    [seed, selectedPlanetId],
  )

  if (sceneKind !== 'system' || planet == null) return null

  return (
    <section className="hud-panel planet-panel" aria-label="행성 정보">
      <header className="hud-panel-header">
        <h2 className="hud-panel-title">{planet.name}</h2>
        <button
          type="button"
          className="hud-icon-button"
          aria-label="패널 닫기"
          onClick={() => selectPlanet(null)}
        >
          ×
        </button>
      </header>

      <dl className="hud-panel-facts">
        <div className="hud-fact">
          <dt>유형</dt>
          <dd>{PLANET_KIND_LABELS[planet.kind]}</dd>
        </div>
        <div className="hud-fact">
          <dt>궤도</dt>
          <dd>{planet.orbitAu.toFixed(1)} AU</dd>
        </div>
        <div className="hud-fact">
          <dt>생명체 신호</dt>
          <dd>
            {planet.hasLife ? (
              <span className="badge badge-life">생명 반응 감지!</span>
            ) : (
              <span className="badge badge-unknown">감지되지 않음</span>
            )}
          </dd>
        </div>
        {isExplored ? (
          <div className="hud-fact">
            <dt>탐사</dt>
            <dd>
              <span className="badge badge-visited">탐사 완료</span>
            </dd>
          </div>
        ) : null}
      </dl>

      {planet.hasLife ? (
        <button
          type="button"
          className="hud-button hud-button-primary"
          onClick={() => explore(planet.id)}
        >
          {isExplored ? '재탐사' : '탐사'}
        </button>
      ) : null}
    </section>
  )
}
