import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Matrix4, Quaternion, Vector3 } from 'three'

import { starWorldPosition } from '@/engine'
import { WARP_IGNITION_PROGRESS, WARP_STAGE_A_MS } from '@/scenes/warp/warpTimeline'
import { useGameStore } from '@/store'

/**
 * 워프 카메라 리그 — 스테이지 A 동안 카메라를 전담한다 (결정 26·31·34·41-f).
 *
 * 워프는 항상 1인칭(우주선 시점)에서 경험한다. 발동 뷰에 따라 진입이 갈린다:
 *  - 우주선 뷰: 정박 포즈에서 목표 별 방향으로 부드럽게 회전(예열 홀드 동안).
 *  - 퍼스펙티브 뷰: 우주선 포즈로 컷(줌아웃 시) 또는 근접 스윕(줌인 시) 후 목표로 회전.
 * 점화(WARP_IGNITION_PROGRESS) 시점에 정렬을 마치고, 이후 목표 방향으로 큐빅 가속 돌진한다.
 * 별밭 시차가 이동감을, 스트리크가 속도감을 만든다. OrbitControls는 워프 동안 비활성 —
 * 타임라인은 ref 기반, store 쓰기 없음 (철칙 6).
 */

/** 우주선 시점 거리 — 출발 항성에서 목표 반대편으로 이만큼 물러난 포즈. */
const SHIP_OFFSET_DISTANCE = 30
/** 목표 방향 돌진 거리 상한 (월드 단위) — 가까운 별로 워프해도 과하지 않게. */
const MAX_DOLLY_DISTANCE = 2_200
/** 돌진 시작점에서 목표까지 거리 대비 돌진 비율 — 목표 항성을 지나치지 않는다. */
const DOLLY_DISTANCE_RATIO = 0.45
/**
 * 발동 위치가 우주선 포즈에서 이보다 멀면(퍼스펙티브 줌아웃) 위치를 즉시 컷한다 —
 * 먼 거리를 짧은 홀드에 스윕하면 멀미가 난다 (결정 41-f). 가까우면 부드럽게 스윕.
 */
const SHIP_POSE_CUT_DISTANCE = 400

const UP = new Vector3(0, 1, 0)

interface WarpPose {
  /** 점화 시점의 우주선 포즈 — 출발 항성 뒤. */
  readonly shipPosition: Vector3
  /** 회전·위치 보간 시작점 — 발동 위치(가까우면) 또는 우주선 포즈(멀어 컷이면). */
  readonly aimFromPosition: Vector3
  readonly dollyDirection: Vector3
  readonly dollyDistance: number
}

function clamp01(value: number): number {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

/** easeOutCubic — 빠르게 정렬을 시작해 살며시 안착한다. */
function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

export function WarpCameraRig() {
  const seed = useGameStore((state) => state.seed)
  const scene = useGameStore((state) => state.scene)
  const targetStarId = scene.kind === 'warping' ? scene.to : null
  const fromStarId = scene.kind === 'warping' ? scene.from : null

  const controls = useThree((state) => state.controls) as { enabled: boolean } | null

  const startRef = useRef<number | null>(null)
  const poseRef = useRef<WarpPose | null>(null)
  const lookScratch = useMemo(() => new Vector3(), [])
  // 발동 시점 카메라 방위 → 목표 응시 방위로 슬러프하기 위한 스크래치
  const startQuat = useMemo(() => new Quaternion(), [])
  const aimQuat = useMemo(() => new Quaternion(), [])
  const lookMatrix = useMemo(() => new Matrix4(), [])

  const targetPosition = useMemo(() => {
    if (targetStarId == null) return null
    const position = starWorldPosition(seed, targetStarId)
    return position == null ? null : new Vector3(position[0], position[1], position[2])
  }, [seed, targetStarId])

  const fromPosition = useMemo(() => {
    if (fromStarId == null) return null
    const position = starWorldPosition(seed, fromStarId)
    return position == null ? null : new Vector3(position[0], position[1], position[2])
  }, [seed, fromStarId])

  // 워프 동안 OrbitControls 정지 — 카메라는 이 리그가 전담한다
  useEffect(() => {
    if (controls == null) return
    controls.enabled = false
    return () => {
      controls.enabled = true
    }
  }, [controls])

  useFrame((state) => {
    if (targetPosition == null || fromPosition == null) return
    const camera = state.camera

    // 첫 프레임: 발동 위치/방위를 포착하고 워프 포즈를 계산한다 (어디서 발동했든 여기서 1인칭화)
    if (startRef.current == null || poseRef.current == null) {
      startRef.current = state.clock.elapsedTime

      const toTarget = lookScratch.copy(targetPosition).sub(fromPosition)
      const distanceFromStar = toTarget.length()
      const dollyDirection =
        distanceFromStar > 1
          ? toTarget.clone().divideScalar(distanceFromStar)
          : toTarget.clone().set(0, 0, 1)
      const shipPosition = fromPosition
        .clone()
        .addScaledVector(dollyDirection, -SHIP_OFFSET_DISTANCE)

      // 발동 위치가 멀면(퍼스펙티브 줌아웃) 컷, 가까우면(우주선 뷰·근접 퍼스펙티브) 스윕
      const aimFromPosition =
        camera.position.distanceTo(shipPosition) > SHIP_POSE_CUT_DISTANCE
          ? shipPosition.clone()
          : camera.position.clone()

      startQuat.copy(camera.quaternion)
      lookMatrix.lookAt(shipPosition, targetPosition, UP)
      aimQuat.setFromRotationMatrix(lookMatrix)

      poseRef.current = {
        shipPosition,
        aimFromPosition,
        dollyDirection,
        dollyDistance: Math.min(
          MAX_DOLLY_DISTANCE,
          shipPosition.distanceTo(targetPosition) * DOLLY_DISTANCE_RATIO,
        ),
      }
    }
    const pose = poseRef.current

    const elapsed = state.clock.elapsedTime - startRef.current
    const progress = Math.min(1, elapsed / (WARP_STAGE_A_MS / 1_000))

    if (progress < WARP_IGNITION_PROGRESS) {
      // 정렬(예열) 단계 — 우주선 포즈로 위치를 좁히며 목표 별 방향으로 회전한다
      const aim = easeOut(clamp01(progress / WARP_IGNITION_PROGRESS))
      camera.position.lerpVectors(pose.aimFromPosition, pose.shipPosition, aim)
      camera.quaternion.slerpQuaternions(startQuat, aimQuat, aim)
      return
    }

    // 돌진 단계 — 정렬을 마친 우주선 포즈에서 목표 방향 큐빅 가속
    const rushLocal = clamp01((progress - WARP_IGNITION_PROGRESS) / (1 - WARP_IGNITION_PROGRESS))
    const rush = rushLocal * rushLocal * rushLocal
    camera.position
      .copy(pose.shipPosition)
      .addScaledVector(pose.dollyDirection, pose.dollyDistance * rush)
    camera.lookAt(targetPosition)
  })

  return null
}
