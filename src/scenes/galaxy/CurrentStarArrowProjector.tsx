import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Vector3 } from 'three'

import { starWorldPosition } from '@/engine/galaxy/position'
import { useGameStore } from '@/store'

/**
 * 현재 별이 화면 밖으로 나가면 가장자리에 방향 화살표를 띄운다 (백로그 F-2 ④).
 * DOM 레이어([data-current-star-arrow])의 style을 useFrame에서 직접 갱신 — React 상태 없음 (철칙 6).
 * 갤럭시 뷰(우주선·퍼스펙티브) 전용, 워프 중엔 숨긴다.
 */

/** 화면 가장자리에서 화살표 중심까지 인셋 (px). */
const EDGE_MARGIN_PX = 36

/** 콘솔 데크 높이 — global.css `--deck-height: clamp(56px, 9vh, 76px)` 미러 (결정 42-c). */
function deckHeightPx(viewportHeight: number): number {
  return Math.min(76, Math.max(56, viewportHeight * 0.09))
}

export function CurrentStarArrowProjector() {
  const seed = useGameStore((state) => state.seed)
  const currentStarId = useGameStore((state) => state.currentStarId)

  const worldPos = useMemo(
    () => starWorldPosition(seed, currentStarId),
    [seed, currentStarId],
  )

  const starVec = useMemo(() => new Vector3(), [])
  const forwardVec = useMemo(() => new Vector3(), [])
  const elementRef = useRef<HTMLElement | null>(null)

  useFrame((state) => {
    const { scene } = useGameStore.getState()

    const el =
      elementRef.current ??
      (elementRef.current = document.querySelector<HTMLElement>('[data-current-star-arrow]'))
    if (el == null) return

    if (scene.kind !== 'galaxy' || worldPos == null) {
      el.style.display = 'none'
      return
    }

    const { camera, size } = state
    const vpW = size.width
    const vpH = size.height

    // 카메라 뒤 판정 (dot product — 결정 37 패턴)
    camera.getWorldDirection(forwardVec)
    const dot =
      (worldPos[0] - camera.position.x) * forwardVec.x +
      (worldPos[1] - camera.position.y) * forwardVec.y +
      (worldPos[2] - camera.position.z) * forwardVec.z
    const isBehind = dot <= 0

    starVec.set(worldPos[0], worldPos[1], worldPos[2])
    starVec.project(camera)

    // 카메라 뒤면 NDC 방향 반전 (투영 좌표가 뒤집히므로)
    const ndcX = isBehind ? -starVec.x : starVec.x
    const ndcY = isBehind ? -starVec.y : starVec.y

    const starPxX = (ndcX * 0.5 + 0.5) * vpW
    const starPxY = (-ndcY * 0.5 + 0.5) * vpH

    const cx = vpW / 2
    const cy = vpH / 2
    const dx = starPxX - cx
    const dy = starPxY - cy

    const isOnScreen =
      !isBehind && starPxX >= 0 && starPxX <= vpW && starPxY >= 0 && starPxY <= vpH

    if (isOnScreen || (dx === 0 && dy === 0)) {
      el.style.display = 'none'
      return
    }

    // 인셋 경계와의 교점 — 가장자리 안쪽 EDGE_MARGIN_PX 지점.
    // 하단만 콘솔 데크(결정 42-c) 위로 — 화살표가 조작면에 그려지지 않게.
    const halfW = cx - EDGE_MARGIN_PX
    const halfH = cy - EDGE_MARGIN_PX
    const halfHBottom = halfH - deckHeightPx(vpH)
    let tMin = Infinity
    if (dx > 0) tMin = Math.min(tMin, halfW / dx)
    else if (dx < 0) tMin = Math.min(tMin, -halfW / dx)
    if (dy > 0) tMin = Math.min(tMin, halfHBottom / dy)
    else if (dy < 0) tMin = Math.min(tMin, -halfH / dy)

    if (tMin === Infinity || tMin <= 0) {
      el.style.display = 'none'
      return
    }

    const edgeX = cx + tMin * dx
    const edgeY = cy + tMin * dy
    const angleDeg = Math.atan2(dy, dx) * (180 / Math.PI)

    el.style.display = 'block'
    el.style.left = `${Math.round(edgeX)}px`
    el.style.top = `${Math.round(edgeY)}px`
    el.style.transform = `translate(-50%, -50%) rotate(${angleDeg}deg)`
  })

  return null
}
