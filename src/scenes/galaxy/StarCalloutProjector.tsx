import { useCallback, useMemo } from 'react'
import type { Vector3 } from 'three'

import { starWorldPosition } from '@/engine/galaxy/position'
import { CalloutProjector } from '@/scenes/shared/CalloutProjector'
import { currentBodies } from '@/scenes/system/currentBodies'
import { useGameStore } from '@/store'

/**
 * 선택한 항성에 별 정보 콜아웃([data-star-callout])을 붙인다 (결정 37).
 *
 * 다중성계(binary-stars): 우주선 뷰에선 콜아웃이 클릭한 별의 *현재 월드 위치*
 * (currentBodies, 스케일 반영)를 따라가 본체에 붙는다. 퍼스펙티브(은하 항법)에선 별이
 * 작고 빠르게 공전해 콜아웃이 떨려 클릭이 어려우므로 질량중심(카탈로그 좌표 = 카메라
 * 초점 = 화면 중앙)에 고정한다 — 안정적. 본체 *선택*(어느 별인지)은 두 뷰 모두 동작한다.
 */
export function StarCalloutProjector() {
  const seed = useGameStore((state) => state.seed)
  const selectedStarId = useGameStore((state) => state.selectedStarId)
  const selectedBodyIndex = useGameStore((state) => state.selectedBodyIndex)
  const isShipView = useGameStore(
    (state) => state.scene.kind === 'galaxy' && state.scene.view === 'ship',
  )

  const catalogPosition = useMemo(
    () => (selectedStarId == null ? null : starWorldPosition(seed, selectedStarId)),
    [seed, selectedStarId],
  )

  const computeWorldPosition = useCallback(
    (out: Vector3) => {
      const followsBody =
        isShipView &&
        selectedStarId != null &&
        currentBodies.starId === selectedStarId &&
        selectedBodyIndex < currentBodies.count
      if (followsBody) {
        const pos = currentBodies.positions[selectedBodyIndex]
        if (pos != null) {
          out.copy(pos)
          return true
        }
      }
      if (catalogPosition == null) return false
      out.set(catalogPosition[0], catalogPosition[1], catalogPosition[2])
      return true
    },
    [catalogPosition, selectedStarId, selectedBodyIndex, isShipView],
  )

  return (
    <CalloutProjector
      selector="[data-star-callout]"
      targetKey={selectedStarId}
      computeWorldPosition={computeWorldPosition}
    />
  )
}
