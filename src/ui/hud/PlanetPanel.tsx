import { useMemo } from 'react'

import { hasHabitableZone, planetById, SOL_STAR_ID, starById } from '@/engine'
import { normalizedOrbit } from '@/scenes/system/habitableZone'
import { useGameStore } from '@/store'
import { planetDescriptionOf } from '@/ui/hud/bodyDescriptions'

const PLANET_KIND_LABELS = {
  rocky: '암석형',
  gas: '가스형',
} as const

/** 궤도 거리 표기 — 먼 외행성은 소수 1자리, 내행성은 2자리로 실제값 정밀도를 살린다. */
function formatAu(au: number): string {
  return au >= 10 ? au.toFixed(1) : au.toFixed(2)
}

export function PlanetPanel() {
  const seed = useGameStore((state) => state.seed)
  // 행성은 우주선 뷰에서만 보인다 — 항성계가 우주선 뷰에 통합됨 (결정 41)
  const isShipView = useGameStore(
    (state) => state.scene.kind === 'galaxy' && state.scene.view === 'ship',
  )
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

  // 짧은 설명 (misc-ux) — 렌더(CurrentSystem hzSpectral)와 같은 게이팅·정규화 궤도로
  // 온도대를 갈라 화면의 표면 모습과 설명이 일치한다. 태양계는 전용 사전(온도 모델 우회).
  const description = useMemo(() => {
    if (planet == null) return null
    const star = starById(seed, planet.starId)
    const hzSpectral =
      star != null && planet.starId !== SOL_STAR_ID && hasHabitableZone(star)
        ? star.spectral
        : null
    const hzOrbit = hzSpectral == null ? null : normalizedOrbit(planet.orbitAu, hzSpectral)
    return planetDescriptionOf(planet, hzOrbit)
  }, [seed, planet])

  if (!isShipView || planet == null) return null

  return (
    // 홀로그램 콜아웃 (백로그 G-a-5, 별 패널과 같은 패턴) — PlanetCalloutProjector가
    // 매 프레임 공전 중인 행성의 화면 좌표로 transform을 갱신한다. 기본 hidden.
    <div className="callout" data-planet-callout>
      <span className="callout-dot" aria-hidden="true" />
      <span className="callout-line" aria-hidden="true" />
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
            {/* Sol은 궤도가 게임 스케일로 압축돼 있어 실제 천문값(realAu)을 보여준다.
                절차 생성 행성은 orbitAu가 곧 실제 AU 근사라 그대로 표시. */}
            <dd>{formatAu(planet.realAu ?? planet.orbitAu)} AU</dd>
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

        {description != null ? <p className="hud-panel-desc">{description}</p> : null}

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
    </div>
  )
}
