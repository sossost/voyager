import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { PerspectiveCamera } from 'three'

/**
 * 우주선 1인칭 시점 리그 (결정 36) — 회전축이 카메라 자신이다.
 *
 * OrbitControls(외부 점을 도는 관찰자 시점)와 달리, 카메라가 현재 별 옆의
 * 고정 위치에 떠서 드래그로 시선만 돌린다(요/피치) — "함교에서 고개를 돌리는"
 * 느낌. 휠은 FOV 줌(망원경처럼 먼 별을 당겨 본다). 모든 연속 값은 ref +
 * useFrame, store 쓰기 없음 (철칙 6).
 */

/** 우주선 정박 위치 — 현재 별 기준 오프셋 (별을 살짝 내려다보며 시작한다). */
const SHIP_OFFSET_X = 0
const SHIP_OFFSET_Y = 10
const SHIP_OFFSET_Z = 36
/** 시작 피치 — 정박 위치에서 현재 별을 바라보는 각도. */
const INITIAL_PITCH = -Math.asin(
  SHIP_OFFSET_Y /
    Math.sqrt(SHIP_OFFSET_X ** 2 + SHIP_OFFSET_Y ** 2 + SHIP_OFFSET_Z ** 2),
)

/** 드래그 감도 (rad/px) — 화면 가로 한 번 드래그 ≈ 반 바퀴. */
const LOOK_SENSITIVITY = 0.0042
/** 수직 시선 한계 — 천정/천저에서 짐벌락 직전까지. */
const PITCH_LIMIT = Math.PI / 2 - 0.08

/** FOV 줌 범위 — 좁히면 망원, 기본 60은 Canvas 카메라와 동일. */
const FOV_MIN = 35
const FOV_MAX = 70
const FOV_REST = 60
const FOV_WHEEL_STEP = 0.02

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
  const targetFov = useRef(FOV_REST)
  const dragPointer = useRef<{ id: number; x: number; y: number } | null>(null)

  // 드래그 = 시선 회전, 휠 = FOV 줌 — 캔버스에만 붙여 HUD와 간섭하지 않는다
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

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()
      targetFov.current = clamp(
        targetFov.current + event.deltaY * FOV_WHEEL_STEP,
        FOV_MIN,
        FOV_MAX,
      )
    }

    element.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerEnd)
    window.addEventListener('pointercancel', handlePointerEnd)
    element.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      element.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerEnd)
      window.removeEventListener('pointercancel', handlePointerEnd)
      element.removeEventListener('wheel', handleWheel)
    }
  }, [gl])

  // 언마운트(지도/워프 전환) 시 FOV 복원 — 다른 씬은 기본 60을 가정한다
  useEffect(
    () => () => {
      if (camera instanceof PerspectiveCamera) {
        camera.fov = FOV_REST
        camera.updateProjectionMatrix()
      }
    },
    [camera],
  )

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

    if (camera instanceof PerspectiveCamera) {
      camera.fov += (targetFov.current - camera.fov) * blend
      camera.updateProjectionMatrix()
    }
  })

  return null
}
