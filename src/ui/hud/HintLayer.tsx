import { useEffect, useRef, useState } from 'react'

import { planetById } from '@/engine'
import type { HintKey } from '@/persistence/types'
import { useGameStore } from '@/store'

/** 힌트를 첫 표시 시점에 markHintSeen으로 즉시 기록하고 durationMs 후 사라진다. */
function useOnceHint(key: HintKey, shouldTrigger: boolean, durationMs: number): boolean {
  const seenHints = useGameStore((state) => state.seenHints)
  const markHintSeen = useGameStore((state) => state.markHintSeen)
  const [active, setActive] = useState(false)
  const firedRef = useRef(false)

  useEffect(() => {
    if (firedRef.current) return
    if (seenHints.has(key)) {
      firedRef.current = true
      return
    }
    if (!shouldTrigger) return

    firedRef.current = true
    markHintSeen(key)
    setActive(true)
    const timer = setTimeout(() => setActive(false), durationMs)
    return () => clearTimeout(timer)
  }, [key, shouldTrigger, seenHints, markHintSeen, durationMs])

  return active
}

/** 힌트 1 — 첫 진입 시 3s: "별을 클릭해 탐색하세요" */
function EnterHint() {
  const active = useOnceHint('first-enter', true, 3_500)
  if (!active) return null
  return (
    <div className="hint-bubble hint-bubble-center" role="status" aria-live="polite">
      별을 클릭해 탐색하세요
    </div>
  )
}

/** 힌트 2 — 첫 별 선택(현재 별이 아닌) 시 5s: "항행으로 이동할 수 있습니다" */
function StarSelectHint() {
  const selectedStarId = useGameStore((state) => state.selectedStarId)
  const currentStarId = useGameStore((state) => state.currentStarId)
  const sceneKind = useGameStore((state) => state.scene.kind)

  const shouldTrigger =
    sceneKind === 'galaxy' && selectedStarId != null && selectedStarId !== currentStarId

  const active = useOnceHint('first-star-select', shouldTrigger, 5_000)
  if (!active) return null
  return (
    <div className="hint-bubble hint-bubble-right" role="status" aria-live="polite">
      항행 버튼으로 이동할 수 있습니다
    </div>
  )
}

/** 힌트 3 — 첫 생명체 행성 선택 시 5s: "탐사 버튼으로 생명체를 찾아보세요" */
function LifePlanetHint() {
  const seed = useGameStore((state) => state.seed)
  const selectedPlanetId = useGameStore((state) => state.selectedPlanetId)
  const isShipView = useGameStore(
    (state) => state.scene.kind === 'galaxy' && state.scene.view === 'ship',
  )

  const planet = selectedPlanetId != null ? planetById(seed, selectedPlanetId) : null
  const shouldTrigger = isShipView && planet != null && planet.hasLife

  const active = useOnceHint('first-life-planet', shouldTrigger, 5_000)
  if (!active) return null
  return (
    <div className="hint-bubble hint-bubble-right" role="status" aria-live="polite">
      탐사 버튼으로 생명체를 찾아보세요
    </div>
  )
}

export function HintLayer() {
  return (
    <>
      <EnterHint />
      <StarSelectHint />
      <LifePlanetHint />
    </>
  )
}
