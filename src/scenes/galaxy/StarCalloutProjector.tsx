import { useCallback, useMemo } from 'react'
import type { Vector3 } from 'three'

import { starWorldPosition } from '@/engine/galaxy/position'
import { CalloutProjector } from '@/scenes/shared/CalloutProjector'
import { useGameStore } from '@/store'

/** 선택한 항성에 별 정보 콜아웃([data-star-callout])을 붙인다 (결정 37). */
export function StarCalloutProjector() {
  const seed = useGameStore((state) => state.seed)
  const selectedStarId = useGameStore((state) => state.selectedStarId)

  const position = useMemo(
    () => (selectedStarId == null ? null : starWorldPosition(seed, selectedStarId)),
    [seed, selectedStarId],
  )

  const computeWorldPosition = useCallback(
    (out: Vector3) => {
      if (position == null) return false
      out.set(position[0], position[1], position[2])
      return true
    },
    [position],
  )

  return (
    <CalloutProjector
      selector="[data-star-callout]"
      targetKey={selectedStarId}
      computeWorldPosition={computeWorldPosition}
    />
  )
}
