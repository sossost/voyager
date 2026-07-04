import { Vector3 } from 'three'

import type { StarId } from '@/engine'

/**
 * 다중성계 행성의 *로컬*(질량중심 원점 상대) 위치 레지스트리 — CurrentSystem이 중력 적분
 * 결과를 매 프레임 게시한다 (multi-star-gravity N-1). 별의 currentBodies와 동형 패턴.
 *
 * 상태화된 적분 위치는 closed-form으로 재계산할 수 없으므로(history 의존), Planet 렌더와
 * PlanetCalloutProjector가 이 단일 소스에서 좌표를 읽는다. `active`는 다중성계 중력 모드에서만
 * true — 단일성계는 inactive라 소비자가 기존 closed-form(planetOrbitPosition)을 그대로 쓴다.
 * 렌더 파생 — GEN_VERSION·저장·골든 무관.
 */

/** 최대 행성 수 (planetsOf 상한) — 슬롯 사전 할당. 적분 상태 슬롯과 반드시 동수 (단일 소스). */
export const MAX_PLANETS = 8

export const currentPlanetOrbits = {
  starId: null as StarId | null,
  active: false,
  count: 0,
  localPositions: Array.from({ length: MAX_PLANETS }, () => new Vector3()) as readonly Vector3[],
}

/** 다중성계 중력 모드가 아닐 때(단일성·워프·언마운트) 비활성화 — 소비자가 closed-form 폴백. */
export function clearCurrentPlanetOrbits(): void {
  currentPlanetOrbits.active = false
  currentPlanetOrbits.count = 0
  currentPlanetOrbits.starId = null
}
