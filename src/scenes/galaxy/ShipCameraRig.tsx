import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'

import { cameraActions } from '@/scenes/shared/cameraActions'
import { useGameStore } from '@/store'

/**
 * 우주선 1인칭 시점 리그 (결정 36·41) — 회전축이 카메라 자신이다.
 *
 * OrbitControls(외부 점을 도는 관찰자 시점)와 달리, 카메라가 현재 별 옆의
 * 고정 위치에 떠서 드래그로 시선만 돌린다(요/피치) — "함교에서 고개를 돌리는"
 * 느낌. 휠/줌 버튼으로 정박 거리를 좁은 범위에서만 당길 수 있다(FOV 줌은
 * "막" 피드백으로 기각된 결정 37 — 이건 거리 줌이라 시야가 자연스럽다). 거리
 * 탐색 본류는 여전히 퍼스펙티브 뷰의 몫. 모든 연속 값은 ref + useFrame (철칙 6).
 *
 * 단, 워프 도착(pendingArrival) 직후엔 정박 거리보다 멀리서 시작해 빨려들 듯
 * 줌인으로 안착한다 — 플래시가 걷히며 드러나는 도착 확대 연출 (결정 41-c 보강).
 * 정박 오프셋을 같은 방향으로 스케일만 키우므로 피치가 불변(별이 계속 중앙)이다.
 */

/**
 * 우주선 정박 위치 — 현재 별 기준 오프셋 (별을 살짝 내려다보며 시작한다).
 * 거리 ≈63유닛 — 항성계 전체(Neptune ≤29유닛)가 시야에 들어오는 거리.
 */
const SHIP_OFFSET_X = 0
const SHIP_OFFSET_Y = 20
const SHIP_OFFSET_Z = 60

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

/**
 * 함교 거리 줌 — 정박 오프셋에 곱하는 배율. 1.0 = 정박(가장 멀리, 항성계 전체),
 * 아래로 갈수록 별/행성에 가까이. "좀만 확대" 의도라 범위를 좁게 둔다.
 */
const SHIP_ZOOM_MIN = 0.55
const SHIP_ZOOM_DEFAULT = 1.0
/** 휠 한 틱(deltaY≈100)당 배율 변화. */
const SHIP_ZOOM_WHEEL_STEP = 0.0009
/** 줌 버튼 한 번당 배율 변화. */
const SHIP_ZOOM_BUTTON_STEP = 0.12

/** 도착 확대 — 정박 거리의 이 배수에서 시작해 1배(정박)로 빨려든다. */
const ARRIVAL_START_DISTANCE_MULTIPLIER = 2.4
/**
 * 도착 줌인 길이. easeInOut으로 가속 구간(큰 움직임)이 플래시 페이드아웃(0.65s)이 걷히는
 * 동안 드러나도록 충분히 길게 둔다 — 플래시 뒤에서 다 끝나버리면 확대가 안 보인다.
 */
const ARRIVAL_DURATION_S = 1.5

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min
  if (value > max) return max
  return value
}

/** easeInOutCubic — 천천히 가속해(플래시 뒤) 페이드가 걷힐 때 크게 들어오고 살며시 멈춘다. */
function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
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
  const targetZoom = useRef(SHIP_ZOOM_DEFAULT)
  const currentZoom = useRef(SHIP_ZOOM_DEFAULT)

  // 복귀 버튼 — 시선·거리를 정박 포즈로 즉시 리셋한다. 줌 버튼은 거리를 좁은 범위로 조절.
  useEffect(() => {
    const setZoom = (next: number) => {
      targetZoom.current = clamp(next, SHIP_ZOOM_MIN, SHIP_ZOOM_DEFAULT)
    }
    cameraActions.reset = () => {
      targetYaw.current = 0
      targetPitch.current = INITIAL_PITCH
      setZoom(SHIP_ZOOM_DEFAULT)
    }
    cameraActions.zoomIn = () => setZoom(targetZoom.current - SHIP_ZOOM_BUTTON_STEP)
    cameraActions.zoomOut = () => setZoom(targetZoom.current + SHIP_ZOOM_BUTTON_STEP)
    return () => {
      cameraActions.reset = null
      cameraActions.zoomIn = null
      cameraActions.zoomOut = null
    }
  }, [])

  // 도착 확대 — 마운트가 워프 도착이면(pendingArrival) 줌인을 시작하고 플래그를 소비한다.
  // 뷰 토글로 마운트했으면 작동하지 않는다 (pendingArrival=false → 즉시 정박).
  const arrivalStartRef = useRef<number | null>(null)
  const isArrivingRef = useRef(false)
  useEffect(() => {
    if (!useGameStore.getState().pendingArrival) return
    isArrivingRef.current = true
    arrivalStartRef.current = null
    useGameStore.getState().consumeArrival()
  }, [])

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

    // 휠 = 거리 줌 — 위로 굴리면(deltaY<0) 별에 가까이 당긴다
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()
      targetZoom.current = clamp(
        targetZoom.current + event.deltaY * SHIP_ZOOM_WHEEL_STEP,
        SHIP_ZOOM_MIN,
        SHIP_ZOOM_DEFAULT,
      )
    }

    element.addEventListener('pointerdown', handlePointerDown)
    element.addEventListener('wheel', handleWheel, { passive: false })
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerEnd)
    window.addEventListener('pointercancel', handlePointerEnd)

    return () => {
      element.removeEventListener('pointerdown', handlePointerDown)
      element.removeEventListener('wheel', handleWheel)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerEnd)
      window.removeEventListener('pointercancel', handlePointerEnd)
    }
  }, [gl])

  useFrame((state, delta) => {
    const blend = 1 - Math.exp(-LOOK_DAMPING * delta)
    currentYaw.current += (targetYaw.current - currentYaw.current) * blend
    currentPitch.current += (targetPitch.current - currentPitch.current) * blend
    currentZoom.current += (targetZoom.current - currentZoom.current) * blend

    // 정박 배율은 사용자 거리 줌(currentZoom). 도착 중엔 먼 배율에서 그 줌으로 빨려든다 —
    // 같은 방향 스케일만 키우므로 피치 불변(별이 계속 중앙).
    let offsetScale = currentZoom.current
    if (isArrivingRef.current) {
      if (arrivalStartRef.current == null) arrivalStartRef.current = state.clock.elapsedTime
      const progress = (state.clock.elapsedTime - arrivalStartRef.current) / ARRIVAL_DURATION_S
      if (progress >= 1) {
        isArrivingRef.current = false
      } else {
        offsetScale =
          ARRIVAL_START_DISTANCE_MULTIPLIER +
          (currentZoom.current - ARRIVAL_START_DISTANCE_MULTIPLIER) * easeInOut(progress)
      }
    }

    camera.position.set(
      anchor[0] + SHIP_OFFSET_X * offsetScale,
      anchor[1] + SHIP_OFFSET_Y * offsetScale,
      anchor[2] + SHIP_OFFSET_Z * offsetScale,
    )
    camera.rotation.order = 'YXZ'
    camera.rotation.set(currentPitch.current, currentYaw.current, 0)
  })

  return null
}
