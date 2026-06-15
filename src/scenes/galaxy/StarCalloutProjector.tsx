import { useCallback, useMemo } from 'react'
import { Vector3 } from 'three'

import { starById } from '@/engine'
import { starWorldPosition } from '@/engine/galaxy/position'
import { CalloutProjector } from '@/scenes/shared/CalloutProjector'
import { bodyPositions } from '@/scenes/system/multiplicity'
import { useGameStore } from '@/store'

/**
 * 선택한 항성에 별 정보 콜아웃([data-star-callout])을 붙인다 (결정 37).
 *
 * 다중성계(binary-stars): 별마다 개별 선택되므로 콜아웃이 클릭한 별의 *현재 공전 위치*를
 * 따라간다. 우주선 뷰(스케일 1)에선 별 본체에 정확히 붙고, 그 외(퍼스펙티브 1/8 스케일)에선
 * 오프셋 스케일을 투영기가 알 수 없어 질량중심(카탈로그 좌표)에 붙인다 — PlanetCalloutProjector와
 * 같은 근사. 단일성계는 오프셋 0이라 기존과 동일.
 */
export function StarCalloutProjector() {
  const seed = useGameStore((state) => state.seed)
  const selectedStarId = useGameStore((state) => state.selectedStarId)
  const selectedBodyIndex = useGameStore((state) => state.selectedBodyIndex)
  const isShipView = useGameStore(
    (state) => state.scene.kind === 'galaxy' && state.scene.view === 'ship',
  )

  const position = useMemo(
    () => (selectedStarId == null ? null : starWorldPosition(seed, selectedStarId)),
    [seed, selectedStarId],
  )

  const star = useMemo(
    () => (selectedStarId == null ? null : starById(seed, selectedStarId)),
    [seed, selectedStarId],
  )

  const followsBody = isShipView && star != null && star.multiplicity !== 'single'
  const bodyScratch = useMemo(() => [new Vector3(), new Vector3(), new Vector3()], [])

  const computeWorldPosition = useCallback(
    (out: Vector3, elapsedSeconds: number) => {
      if (position == null) return false
      out.set(position[0], position[1], position[2])
      if (followsBody && star != null) {
        const count = bodyPositions(star, elapsedSeconds, bodyScratch)
        const index = selectedBodyIndex >= 0 && selectedBodyIndex < count ? selectedBodyIndex : 0
        out.add(bodyScratch[index] as Vector3)
      }
      return true
    },
    [position, followsBody, star, selectedBodyIndex, bodyScratch],
  )

  return (
    <CalloutProjector
      selector="[data-star-callout]"
      targetKey={selectedStarId}
      computeWorldPosition={computeWorldPosition}
    />
  )
}
