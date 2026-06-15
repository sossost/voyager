import { useCallback, useMemo } from 'react'
import { Vector3 } from 'three'

import { planetById, starById } from '@/engine'
import { starWorldPosition } from '@/engine/galaxy/position'
import { CalloutProjector } from '@/scenes/shared/CalloutProjector'
import { bodyPositions, isCircumbinary } from '@/scenes/system/multiplicity'
import { planetOrbitPosition } from '@/scenes/system/Planet'
import { useGameStore } from '@/store'

/**
 * 선택한 행성에 행성 정보 콜아웃([data-planet-callout])을 붙인다 (백로그 G-a-5).
 * 행성은 공전으로 매 프레임 움직이므로 렌더와 같은 궤도 수식
 * (planetOrbitPosition — 시간 기반 결정론)으로 위치를 재계산해 따라간다.
 *
 * 통합 후(결정 41) 항성계가 은하 좌표에 놓이므로, 씬그래프 밖에서 절대 좌표를 계산하는
 * 이 투영기는 궤도 수식(별 원점 상대)에 현재 별의 월드 좌표를 더해 보정한다 —
 * CurrentSystem의 `<group position={별 월드}>` 오프셋과 같은 값.
 *
 * 다중성계(binary-stars): S-type(원거리)에선 행성이 주성을 추종하므로 주성의 현재
 * 공전 위치를 더한다 (CurrentSystem planetCenter와 동일 소스 — bodyPositions).
 * circumbinary면 행성이 질량중심(원점)을 돌아 추가 오프셋 없음.
 */
export function PlanetCalloutProjector() {
  const seed = useGameStore((state) => state.seed)
  const currentStarId = useGameStore((state) => state.currentStarId)
  const selectedPlanetId = useGameStore((state) => state.selectedPlanetId)

  const planet = useMemo(
    () => (selectedPlanetId == null ? null : planetById(seed, selectedPlanetId)),
    [seed, selectedPlanetId],
  )

  const star = useMemo(() => starById(seed, currentStarId), [seed, currentStarId])

  const starOffset = useMemo(
    () => starWorldPosition(seed, currentStarId) ?? ([0, 0, 0] as const),
    [seed, currentStarId],
  )

  const followsPrimary = useMemo(
    () => star != null && star.multiplicity !== 'single' && !isCircumbinary(star),
    [star],
  )

  const bodyScratch = useMemo(() => [new Vector3(), new Vector3(), new Vector3()], [])

  const computeWorldPosition = useCallback(
    (out: Vector3, elapsedSeconds: number) => {
      if (planet == null) return false
      planetOrbitPosition(planet, elapsedSeconds, out)
      if (followsPrimary && star != null) {
        bodyPositions(star, elapsedSeconds, bodyScratch)
        out.add(bodyScratch[0] as Vector3)
      }
      out.x += starOffset[0]
      out.y += starOffset[1]
      out.z += starOffset[2]
      return true
    },
    [planet, star, followsPrimary, bodyScratch, starOffset],
  )

  return (
    <CalloutProjector
      selector="[data-planet-callout]"
      targetKey={selectedPlanetId}
      computeWorldPosition={computeWorldPosition}
    />
  )
}
