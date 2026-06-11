import { useCallback, useMemo } from 'react'
import type { Vector3 } from 'three'

import { planetById } from '@/engine'
import { CalloutProjector } from '@/scenes/shared/CalloutProjector'
import { planetOrbitPosition } from '@/scenes/system/Planet'
import { useGameStore } from '@/store'

/**
 * 선택한 행성에 행성 정보 콜아웃([data-planet-callout])을 붙인다 (백로그 G-a-5).
 * 행성은 공전으로 매 프레임 움직이므로 렌더와 같은 궤도 수식
 * (planetOrbitPosition — 시간 기반 결정론)으로 위치를 재계산해 따라간다.
 */
export function PlanetCalloutProjector() {
  const seed = useGameStore((state) => state.seed)
  const selectedPlanetId = useGameStore((state) => state.selectedPlanetId)

  const planet = useMemo(
    () => (selectedPlanetId == null ? null : planetById(seed, selectedPlanetId)),
    [seed, selectedPlanetId],
  )

  const computeWorldPosition = useCallback(
    (out: Vector3, elapsedSeconds: number) => {
      if (planet == null) return false
      planetOrbitPosition(planet, elapsedSeconds, out)
      return true
    },
    [planet],
  )

  return (
    <CalloutProjector
      selector="[data-planet-callout]"
      targetKey={selectedPlanetId}
      computeWorldPosition={computeWorldPosition}
    />
  )
}
