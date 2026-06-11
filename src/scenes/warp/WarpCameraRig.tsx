import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Vector3 } from 'three'

import { starWorldPosition } from '@/engine'
import {
  WARP_DIVE_END_PROGRESS,
  WARP_STAGE_A_MS,
  WARP_TURN_END_PROGRESS,
} from '@/scenes/warp/warpTimeline'
import { useGameStore } from '@/store'

/**
 * 워프 카메라 리그 — 스테이지 A 동안 카메라를 전담한다 (결정 26·31).
 *
 * 3막 구성: ① 확대 — 플레이어가 보던 포즈에서 출발 항성으로 다이브해
 * 우주선 시점이 된다, ② 응시 — 시선을 목표 항성으로 돌린다, ③ 돌진 —
 * 가속 곡선으로 목표를 향해 전진한다. 별밭 시차가 진짜 이동감을 만들고
 * 스트리크(다이브 후 점화)가 화면 중앙(=목표)에서 방사된다.
 * OrbitControls는 워프 동안 비활성 — 타임라인은 ref 기반, store 쓰기 없음 (철칙 6).
 */

/** 우주선 시점 거리 — 출발 항성에서 이만큼까지 다가간다 (은하 줌 하한 15와 같은 자릿수). */
const SHIP_APPROACH_DISTANCE = 30
/** 목표 방향 돌진 거리 상한 (월드 단위) — 가까운 별로 워프해도 과하지 않게. */
const MAX_DOLLY_DISTANCE = 2_200
/** 돌진 시작점에서 목표까지 거리 대비 돌진 비율 — 목표 항성을 지나치지 않는다. */
const DOLLY_DISTANCE_RATIO = 0.45

interface WarpPose {
  readonly initialPosition: Vector3
  readonly initialLook: Vector3
  /** 다이브 종착점 — 출발 항성 근접, 현재 뷰 축을 따라 들어간다. */
  readonly shipPosition: Vector3
  readonly dollyDirection: Vector3
  readonly dollyDistance: number
}

function clamp01(value: number): number {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

function smoothstep01(value: number): number {
  const t = clamp01(value)
  return t * t * (3 - 2 * t)
}

export function WarpCameraRig() {
  const seed = useGameStore((state) => state.seed)
  const scene = useGameStore((state) => state.scene)
  const targetStarId = scene.kind === 'warping' ? scene.to : null
  const fromStarId = scene.kind === 'warping' ? scene.from : null

  const controls = useThree((state) => state.controls) as {
    enabled: boolean
    target: Vector3
  } | null

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

    // 첫 프레임에 출발 포즈 고정 — 플레이어가 보던 그 시점에서 연출이 시작된다
    if (startRef.current == null || poseRef.current == null) {
      startRef.current = state.clock.elapsedTime
      const initialPosition = camera.position.clone()
      const initialLook =
        controls?.target instanceof Vector3
          ? controls.target.clone()
          : initialPosition.clone().add(camera.getWorldDirection(lookScratch))

      // 다이브 종착점: 현재 뷰 축을 따라 출발 항성으로 — 이미 더 가까우면 그대로
      const approach = initialPosition.clone().sub(fromPosition)
      const initialDistance = approach.length()
      const shipDistance = Math.min(SHIP_APPROACH_DISTANCE, initialDistance)
      const shipPosition =
        initialDistance > 1
          ? fromPosition.clone().addScaledVector(approach.divideScalar(initialDistance), shipDistance)
          : initialPosition.clone()

      const toTarget = targetPosition.clone().sub(shipPosition)
      const distanceToTarget = toTarget.length()
      poseRef.current = {
        initialPosition,
        initialLook,
        shipPosition,
        dollyDirection:
          distanceToTarget > 1 ? toTarget.divideScalar(distanceToTarget) : toTarget.set(0, 0, 0),
        dollyDistance: Math.min(MAX_DOLLY_DISTANCE, distanceToTarget * DOLLY_DISTANCE_RATIO),
      }
    }
    const pose = poseRef.current

    const elapsed = state.clock.elapsedTime - startRef.current
    const progress = Math.min(1, elapsed / (WARP_STAGE_A_MS / 1_000))

    // ① 확대 — 출발 항성으로 다이브, 시선은 아직 항성에 (우주선 시점으로 전환)
    const dive = smoothstep01(progress / WARP_DIVE_END_PROGRESS)
    camera.position.lerpVectors(pose.initialPosition, pose.shipPosition, dive)

    // ② 응시 — 시선을 출발 항성에서 목표 항성으로 돌린다
    const turn = smoothstep01(
      (progress - WARP_DIVE_END_PROGRESS) / (WARP_TURN_END_PROGRESS - WARP_DIVE_END_PROGRESS),
    )
    lookScratch.lerpVectors(pose.initialLook, targetPosition, turn)

    // ③ 돌진 — 가속(local³)으로 목표를 향해 전진, 별밭 시차가 속도감을 만든다
    const rushLocal = clamp01((progress - WARP_TURN_END_PROGRESS) / (1 - WARP_TURN_END_PROGRESS))
    const rush = rushLocal * rushLocal * rushLocal
    camera.position.addScaledVector(pose.dollyDirection, pose.dollyDistance * rush)
    camera.lookAt(lookScratch)
  })

  return null
}
