import { Vector3 } from 'three'

import type { StarId } from '@/engine'

/**
 * 현재 항성계 별들의 *월드* 위치·반경 레지스트리 — CurrentSystem이 매 프레임 갱신한다.
 *
 * 화면공간 별 피킹(useStarPicking)과 선택 마커·콜아웃이 클릭한 별(주성·동반성)의
 * 실제 위치를 알아야 하는데, 다중성계는 별이 공전하고 뷰별 스케일(우주선 1·퍼스펙티브 1/8)이
 * 다르다. 위치 계산의 단일 소스인 CurrentSystem이 스케일까지 반영한 월드 좌표를 게시하면,
 * 레이캐스트 없이 모든 뷰에서 정확히 본체를 집고 마커를 붙일 수 있다.
 */
export const currentBodies = {
  starId: null as StarId | null,
  count: 0,
  positions: [new Vector3(), new Vector3(), new Vector3()] as readonly Vector3[],
  radii: [0, 0, 0] as number[],
}

/** 별 본체가 렌더되지 않을 때(워프 등) 비운다 — 피킹/마커가 stale 좌표를 쓰지 않게. */
export function clearCurrentBodies(): void {
  currentBodies.starId = null
  currentBodies.count = 0
}
