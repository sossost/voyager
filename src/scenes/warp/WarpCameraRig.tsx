import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Vector3 } from 'three'

import { starWorldPosition } from '@/engine'
import { WARP_IGNITION_PROGRESS, WARP_STAGE_A_MS } from '@/scenes/warp/warpTimeline'
import { useGameStore } from '@/store'

/**
 * 워프 카메라 리그 — 스테이지 A 동안 카메라를 전담한다 (결정 26·31·34).
 *
 * 발동 즉시 우주선 시점으로 컷한다(트랜지션 없음): 출발 항성의 목표 반대편
 * 30유닛에서 목표 항성을 응시하는 포즈 — 출발 별이 바로 앞에, 목적지가 화면
 * 중앙에 놓인다. 짧은 홀드 동안 천천히 전진(엔진 예열)하다가 점화 시점부터
 * 큐빅 가속으로 돌진한다. 별밭 시차가 이동감을, 스트리크가 속도감을 만든다.
 * OrbitControls는 워프 동안 비활성 — 타임라인은 ref 기반, store 쓰기 없음 (철칙 6).
 */

/** 우주선 시점 거리 — 출발 항성에서 목표 반대편으로 이만큼 물러난 포즈. */
const SHIP_OFFSET_DISTANCE = 30
/** 목표 방향 돌진 거리 상한 (월드 단위) — 가까운 별로 워프해도 과하지 않게. */
const MAX_DOLLY_DISTANCE = 2_200
/** 돌진 시작점에서 목표까지 거리 대비 돌진 비율 — 목표 항성을 지나치지 않는다. */
const DOLLY_DISTANCE_RATIO = 0.45
/** 홀드 동안 전진하는 거리 — 정지화면이 아니라 예열로 읽히게 한다. */
const HOLD_CREEP_DISTANCE = 14

interface WarpPose {
  /** 컷 포즈 — 출발 항성 뒤 우주선 위치. */
  readonly shipPosition: Vector3
  readonly dollyDirection: Vector3
  readonly dollyDistance: number
}

function clamp01(value: number): number {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
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

    // 첫 프레임에 우주선 포즈로 즉시 컷 — 어디서 발동했든 같은 시점에서 시작한다 (결정 34)
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

      poseRef.current = {
        shipPosition,
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

    // 홀드: 예열 크리프 — 점화 전까지 천천히 전진한다
    const hold = clamp01(progress / WARP_IGNITION_PROGRESS)
    // 돌진: 점화 후 큐빅 가속
    const rushLocal = clamp01((progress - WARP_IGNITION_PROGRESS) / (1 - WARP_IGNITION_PROGRESS))
    const rush = rushLocal * rushLocal * rushLocal
    const advance = HOLD_CREEP_DISTANCE * hold + pose.dollyDistance * rush

    camera.position.copy(pose.shipPosition).addScaledVector(pose.dollyDirection, advance)
    camera.lookAt(targetPosition)
  })

  return null
}
