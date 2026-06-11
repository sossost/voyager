import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Vector3 } from 'three'

import { starWorldPosition } from '@/engine/galaxy/position'
import { useGameStore } from '@/store'

/**
 * 별 콜아웃 투영기 (결정 37) — 선택한 항성의 월드 좌표를 매 프레임 화면
 * 좌표로 투영해 DOM 콜아웃([data-star-callout])의 transform에 직접 쓴다.
 * drei Html 금지 규칙(DOM 레이어 분리)을 지키면서 패널이 항성에 "붙는" 방법:
 * React 상태를 거치지 않으므로(철칙 6) 프레임당 리렌더가 없다.
 */

/** 화면 가장자리 여백 — 콜아웃 앵커(점)가 이 안쪽으로 클램프된다. */
const EDGE_MARGIN_PX = 14
/** 앵커가 오른쪽으로 이만큼 가까우면 패널을 왼쪽으로 편다 (패널 폭 + 리더 라인). */
const FLIP_X_THRESHOLD_PX = 420
/** 앵커가 위로 이만큼 가까우면 패널을 아래로 편다 (패널 높이 + 리더 라인). */
const FLIP_Y_THRESHOLD_PX = 330

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min
  if (value > max) return max
  return value
}

export function StarCalloutProjector() {
  const seed = useGameStore((state) => state.seed)
  const selectedStarId = useGameStore((state) => state.selectedStarId)

  const elementRef = useRef<HTMLElement | null>(null)
  const worldScratch = useMemo(() => new Vector3(), [])
  const forwardScratch = useMemo(() => new Vector3(), [])

  const position = useMemo(
    () => (selectedStarId == null ? null : starWorldPosition(seed, selectedStarId)),
    [seed, selectedStarId],
  )

  // 콜아웃 DOM은 선택이 생길 때 마운트된다 — 선택 변화에 맞춰 다시 찾는다
  useEffect(() => {
    elementRef.current = document.querySelector<HTMLElement>('[data-star-callout]')
    return () => {
      elementRef.current = null
    }
  }, [selectedStarId])

  useFrame((state) => {
    if (position == null) return
    const element =
      elementRef.current ??
      (elementRef.current = document.querySelector<HTMLElement>('[data-star-callout]'))
    if (element == null) return

    worldScratch.set(position[0], position[1], position[2])

    // 카메라 뒤의 별은 투영 좌표가 뒤집힌다 — 숨김 처리
    state.camera.getWorldDirection(forwardScratch)
    const toStarDot =
      (worldScratch.x - state.camera.position.x) * forwardScratch.x +
      (worldScratch.y - state.camera.position.y) * forwardScratch.y +
      (worldScratch.z - state.camera.position.z) * forwardScratch.z
    if (toStarDot <= 0) {
      element.style.visibility = 'hidden'
      return
    }

    worldScratch.project(state.camera)
    const x = clamp(
      (worldScratch.x * 0.5 + 0.5) * state.size.width,
      EDGE_MARGIN_PX,
      state.size.width - EDGE_MARGIN_PX,
    )
    const y = clamp(
      (-worldScratch.y * 0.5 + 0.5) * state.size.height,
      EDGE_MARGIN_PX,
      state.size.height - EDGE_MARGIN_PX,
    )

    element.style.visibility = 'visible'
    element.style.transform = `translate(${x}px, ${y}px)`
    element.classList.toggle(
      'star-callout-flip-x',
      x > state.size.width - FLIP_X_THRESHOLD_PX,
    )
    element.classList.toggle('star-callout-flip-y', y < FLIP_Y_THRESHOLD_PX)
  })

  return null
}
