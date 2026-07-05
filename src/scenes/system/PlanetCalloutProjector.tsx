import { useCallback, useMemo } from 'react'
import type { Vector3 } from 'three'

import { planetById, planetsOf, starById } from '@/engine'
import { starWorldPosition } from '@/engine/galaxy/position'
import { CalloutProjector } from '@/scenes/shared/CalloutProjector'
import { currentPlanetOrbits } from '@/scenes/system/currentPlanetOrbits'
import { planetClearanceOffset } from '@/scenes/system/multiplicity'
import { planetOrbitPosition } from '@/scenes/system/Planet'
import { simClock } from '@/scenes/system/simClock'
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
 * 다중성계(binary-stars): 행성은 항상 질량중심(원점)을 공전하므로(circumbinary,
 * 결정 8 개정) 별 오프셋만 더하면 단일성과 동일하다 — 추가 보정 없음.
 */
export function PlanetCalloutProjector() {
  const seed = useGameStore((state) => state.seed)
  const currentStarId = useGameStore((state) => state.currentStarId)
  const selectedPlanetId = useGameStore((state) => state.selectedPlanetId)

  const planet = useMemo(
    () => (selectedPlanetId == null ? null : planetById(seed, selectedPlanetId)),
    [seed, selectedPlanetId],
  )

  const starOffset = useMemo(
    () => starWorldPosition(seed, currentStarId) ?? ([0, 0, 0] as const),
    [seed, currentStarId],
  )

  // 행성 궤도 바깥밀기 — CurrentSystem과 동일 소스라야 콜아웃이 행성을 정확히 따라간다.
  const orbitOffset = useMemo(() => {
    const star = starById(seed, currentStarId)
    return star == null ? 0 : planetClearanceOffset(star)
  }, [seed, currentStarId])

  // 다중성계 중력 모드면 CurrentSystem이 게시한 적분 위치를 읽어야 콜아웃이 정확히 따라간다
  // (상태화된 적분은 closed-form 재계산 불가). 선택 행성의 궤도 인덱스를 미리 찾아둔다 (없으면 null).
  const gravityOrbitIndex = useMemo<number | null>(() => {
    if (selectedPlanetId == null) return null
    const index = planetsOf(seed, currentStarId).findIndex((p) => p.id === selectedPlanetId)
    return index >= 0 ? index : null
  }, [seed, currentStarId, selectedPlanetId])

  const computeWorldPosition = useCallback(
    (out: Vector3) => {
      if (planet == null) return false
      const useGravity =
        currentPlanetOrbits.active &&
        currentPlanetOrbits.starId === currentStarId &&
        gravityOrbitIndex != null &&
        gravityOrbitIndex < currentPlanetOrbits.count
      if (useGravity) {
        out.copy(currentPlanetOrbits.localPositions[gravityOrbitIndex] as Vector3)
      } else {
        // 렌더(Planet)와 같은 배속 시계로 궤도 위치를 재계산해야 콜아웃이 행성에서 안 떨어진다.
        planetOrbitPosition(planet, simClock.now, out, orbitOffset)
      }
      out.x += starOffset[0]
      out.y += starOffset[1]
      out.z += starOffset[2]
      return true
    },
    [planet, starOffset, orbitOffset, gravityOrbitIndex, currentStarId],
  )

  return (
    <CalloutProjector
      selector="[data-planet-callout]"
      targetKey={selectedPlanetId}
      computeWorldPosition={computeWorldPosition}
    />
  )
}
