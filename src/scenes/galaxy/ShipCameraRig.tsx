import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'

/**
 * 우주선 1인칭 시점 리그 (결정 36) — 회전축이 카메라 자신이다.
 *
 * OrbitControls(외부 점을 도는 관찰자 시점)와 달리, 카메라가 현재 별 옆의
 * 고정 위치에 떠서 드래그로 시선만 돌린다(요/피치) — "함교에서 고개를 돌리는"
 * 느낌. 확대/축소는 없다 — 회전 전용("줌도 빼 달라" 피드백, 거리 탐색은 지도의
 * 몫). 모든 연속 값은 ref + useFrame, store 쓰기 없음 (철칙 6).
 */

/**
 * 우주선 정박 위치 — 현재 별 기준 오프셋 (별을 살짝 내려다보며 시작한다).
 * 통합 후(결정 41) 우주선 뷰가 항성계 전체(외곽 궤도 반경 ≤~98)를 담아야 하므로
 * 별을 점으로 보던 근접(≈37)에서 물러나 시스템을 프레이밍하는 거리로 정박한다.
 * 줌은 없다(회전 전용) — 더 멀리 보는 건 퍼스펙티브 뷰의 몫.
 */
const SHIP_OFFSET_X = 0
const SHIP_OFFSET_Y = 42
const SHIP_OFFSET_Z = 132
/** 시작 피치 — 정박 위치에서 현재 별을 바라보는 각도. */
const INITIAL_PITCH = -Math.asin(
  SHIP_OFFSET_Y /
    Math.sqrt(SHIP_OFFSET_X ** 2 + SHIP_OFFSET_Y ** 2 + SHIP_OFFSET_Z ** 2),
)

/** 드래그 감도 (rad/px) — 화면 가로 한 번 드래그 ≈ 반 바퀴. */
const LOOK_SENSITIVITY = 0.0042
/** 수직 시선 한계 — 천정/천저에서 짐벌락 직전까지. */
const PITCH_LIMIT = Math.PI / 2 - 0.08

/** 시선 감쇠 — 클수록 즉각, 작을수록 부드럽게 따라온다. */
const LOOK_DAMPING = 9

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min
  if (value > max) return max
  return value
}

interface ShipCameraRigProps {
  /** 현재 별의 월드 좌표 — 우주선이 이 옆에 정박한다. */
  readonly anchor: readonly [number, number, number]
}

export function ShipCameraRig({ anchor }: ShipCameraRigProps) {
  const camera = useThree((state) => state.camera)
  const gl = useThree((state) => state.gl)

  const targetYaw = useRef(0)
  const targetPitch = useRef(INITIAL_PITCH)
  const currentYaw = useRef(0)
  const currentPitch = useRef(INITIAL_PITCH)
  const dragPointer = useRef<{ id: number; x: number; y: number } | null>(null)

  // 드래그 = 시선 회전 — 캔버스에만 붙여 HUD와 간섭하지 않는다
  useEffect(() => {
    const element = gl.domElement

    const handlePointerDown = (event: PointerEvent) => {
      if (event.isPrimary === false) return
      dragPointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
    }

    const handlePointerMove = (event: PointerEvent) => {
      const drag = dragPointer.current
      if (drag == null || drag.id !== event.pointerId) return
      const deltaX = event.clientX - drag.x
      const deltaY = event.clientY - drag.y
      drag.x = event.clientX
      drag.y = event.clientY

      targetYaw.current += deltaX * LOOK_SENSITIVITY
      targetPitch.current = clamp(
        targetPitch.current + deltaY * LOOK_SENSITIVITY,
        -PITCH_LIMIT,
        PITCH_LIMIT,
      )
    }

    const handlePointerEnd = (event: PointerEvent) => {
      if (dragPointer.current?.id === event.pointerId) dragPointer.current = null
    }

    element.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerEnd)
    window.addEventListener('pointercancel', handlePointerEnd)

    return () => {
      element.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerEnd)
      window.removeEventListener('pointercancel', handlePointerEnd)
    }
  }, [gl])

  useFrame((_, delta) => {
    const blend = 1 - Math.exp(-LOOK_DAMPING * delta)
    currentYaw.current += (targetYaw.current - currentYaw.current) * blend
    currentPitch.current += (targetPitch.current - currentPitch.current) * blend

    camera.position.set(
      anchor[0] + SHIP_OFFSET_X,
      anchor[1] + SHIP_OFFSET_Y,
      anchor[2] + SHIP_OFFSET_Z,
    )
    camera.rotation.order = 'YXZ'
    camera.rotation.set(currentPitch.current, currentYaw.current, 0)
  })

  return null
}
