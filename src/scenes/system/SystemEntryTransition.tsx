import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Vector3 } from 'three'

/**
 * 항성계 진입 트랜지션 — 기본 시점보다 멀리서 시작해 부드럽게 줌인으로 안착한다.
 * 띡 하고 뜨는 즉시 스왑 대신 "다가가는" 한 호흡을 만든다 (결정 27).
 * 이징 동안 OrbitControls를 멈추고, 안착하면 되돌린다 — ref 기반, store 쓰기 없음 (철칙 6).
 */

/** 시작 거리 = 안착 거리 × 배수 — 살짝 멀리서 다가온다. */
const ENTRY_DISTANCE_MULTIPLIER = 1.45
const ENTRY_DURATION_S = 0.9

interface SystemEntryTransitionProps {
  /** 안착 카메라 거리 — CameraRig maxDistance와 같은 값 (클램프 스냅 방지). */
  readonly restDistance: number
}

export function SystemEntryTransition({ restDistance }: SystemEntryTransitionProps) {
  const controls = useThree((state) => state.controls) as { enabled: boolean } | null

  const startedRef = useRef<number | null>(null)
  const doneRef = useRef(false)
  const startPosition = useMemo(() => new Vector3(), [])
  const restPosition = useMemo(() => new Vector3(), [])

  // 중단(언마운트) 시에도 컨트롤 복원 보장
  useEffect(
    () => () => {
      if (controls != null) controls.enabled = true
    },
    [controls],
  )

  useFrame((state) => {
    if (doneRef.current) return
    const camera = state.camera

    // 첫 프레임: CameraRig가 배치한 기본 방향을 읽어 시작/안착 지점을 고정
    if (startedRef.current == null) {
      startedRef.current = state.clock.elapsedTime
      restPosition.copy(camera.position).normalize().multiplyScalar(restDistance)
      startPosition.copy(restPosition).multiplyScalar(ENTRY_DISTANCE_MULTIPLIER)
      if (controls != null) controls.enabled = false
    }

    const elapsed = state.clock.elapsedTime - startedRef.current
    const t = Math.min(1, elapsed / ENTRY_DURATION_S)
    const eased = 1 - Math.pow(1 - t, 3) // easeOutCubic — 빠르게 다가와 살며시 안착

    camera.position.lerpVectors(startPosition, restPosition, eased)
    camera.lookAt(0, 0, 0)

    if (t >= 1) {
      doneRef.current = true
      if (controls != null) controls.enabled = true
    }
  })

  return null
}
