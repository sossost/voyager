import { useMemo } from 'react'

import { starById } from '@/engine/galaxy/position'
import { MULTIPLICITY_LABELS, SPECTRAL_LABELS, STAR_KIND_LABELS } from '@/scenes/galaxy/spectral'
import { useGameStore } from '@/store'
import { SPECTRAL_DESCRIPTIONS, STAR_KIND_DESCRIPTIONS } from '@/ui/hud/bodyDescriptions'

export function StarInfoPanel() {
  const seed = useGameStore((state) => state.seed)
  const scene = useGameStore((state) => state.scene)
  const sceneKind = scene.kind
  const selectedStarId = useGameStore((state) => state.selectedStarId)
  const selectedBodyIndex = useGameStore((state) => state.selectedBodyIndex)
  const currentStarId = useGameStore((state) => state.currentStarId)
  const isVisited = useGameStore(
    (state) => state.selectedStarId != null && state.visitedStars.has(state.selectedStarId),
  )
  const selectStar = useGameStore((state) => state.selectStar)
  const warpTo = useGameStore((state) => state.warpTo)
  const returnToShip = useGameStore((state) => state.returnToShip)

  const star = useMemo(
    () => (selectedStarId == null ? null : starById(seed, selectedStarId)),
    [seed, selectedStarId],
  )

  if (sceneKind !== 'galaxy' || selectedStarId == null || star == null) return null

  const isCurrentStar = selectedStarId === currentStarId
  const isMultiple = star.multiplicity !== 'single'
  const composition = [star.spectral, ...star.companions.map((companion) => companion.spectral)].join(
    ' + ',
  )

  // 클릭한 별 (다중성계) — 0=주성, 1+=동반성. 범위를 벗어나면 주성으로 폴백.
  const bodyIndex =
    selectedBodyIndex >= 0 && selectedBodyIndex <= star.companions.length ? selectedBodyIndex : 0
  const selectedCompanion = bodyIndex === 0 ? null : star.companions[bodyIndex - 1] ?? null
  const bodySpectral = selectedCompanion == null ? star.spectral : selectedCompanion.spectral
  const bodyName = isMultiple ? `${star.name} ${String.fromCharCode(65 + bodyIndex)}` : star.name
  // 짧은 설명 (misc-ux) — 이색 천체(주성 선택)는 종류 사전, 그 외(주계열·동반성)는 분광형 사전.
  const bodyDescription =
    selectedCompanion == null && star.kind !== 'main_sequence'
      ? STAR_KIND_DESCRIPTIONS[star.kind]
      : SPECTRAL_DESCRIPTIONS[bodySpectral]
  const roleLabel =
    !isMultiple || selectedCompanion == null
      ? isMultiple
        ? '주성'
        : null
      : selectedCompanion.hierarchy === 'outer'
        ? '동반성 (원거리)'
        : star.multiplicity === 'triple'
          ? '동반성 (근접)'
          : '동반성'

  return (
    // 홀로그램 콜아웃 (결정 37) — StarCalloutProjector가 매 프레임 항성의 화면
    // 좌표로 transform을 갱신한다. 투영 전 첫 프레임 깜빡임 방지로 기본 hidden.
    <div className="callout" data-star-callout>
      <span className="callout-dot" aria-hidden="true" />
      <span className="callout-line" aria-hidden="true" />
      <section className="hud-panel star-info-panel" aria-label="별 정보">
        <header className="hud-panel-header">
          <h2 className="hud-panel-title">{bodyName}</h2>
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
          {/* 이색 천체 종류 — 주성(동반성 미선택)이고 주계열성이 아닐 때만 (kind는 주성에만) */}
          {selectedCompanion == null && star.kind !== 'main_sequence' ? (
            <div className="hud-fact">
              <dt>종류</dt>
              <dd>{STAR_KIND_LABELS[star.kind]}</dd>
            </div>
          ) : null}
          {/* 분광형 — 주계열성/동반성만. 블랙홀의 spectral은 전신성 클래스라 표시하면 혼란(숨김). */}
          {selectedCompanion != null || star.kind === 'main_sequence' ? (
            <div className="hud-fact">
              <dt>분광형</dt>
              <dd>{SPECTRAL_LABELS[bodySpectral]}</dd>
            </div>
          ) : null}
          {roleLabel != null ? (
            <div className="hud-fact">
              <dt>역할</dt>
              <dd>{roleLabel}</dd>
            </div>
          ) : null}
          {isMultiple ? (
            <div className="hud-fact">
              <dt>구성</dt>
              <dd>
                {MULTIPLICITY_LABELS[star.multiplicity]} · {composition}
              </dd>
            </div>
          ) : null}
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

        <p className="hud-panel-desc">{bodyDescription}</p>

        {isCurrentStar ? (
          // 퍼스펙티브 뷰에서만 함교 복귀 버튼 표시 — 이미 우주선 뷰라면 버튼 없음 (백로그 H-1)
          scene.kind === 'galaxy' && scene.view === 'perspective' ? (
            <button
              type="button"
              className="hud-button hud-button-primary"
              onClick={returnToShip}
            >
              함교 복귀
            </button>
          ) : null
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
