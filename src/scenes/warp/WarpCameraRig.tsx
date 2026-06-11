import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Vector3 } from 'three'

import { starWorldPosition } from '@/engine'
import { WARP_STAGE_A_MS } from '@/scenes/warp/warpTimeline'
import { useGameStore } from '@/store'

/**
 * 워프 카메라 리그 — 스테이지 A 동안 카메라를 전담한다 (결정 26 보완).
 *
 * 플레이어가 보던 "현 위치" 포즈에서 출발해, 초반에 시선을 목표 항성으로
 * 부드럽게 돌리고, 이후 가속 곡선으로 목표를 향해 돌진한다 — 별밭의 시차가
 * 진짜 이동감을 만들고, 화면 중앙(=목표 항성)에서 스트리크가 방사된다.
 * OrbitControls는 워프 동안 비활성 — 타임라인은 ref 기반, store 쓰기 없음 (철칙 6).
 */

/** 시선이 목표 항성으로 완전히 돌아가는 진행도 — 이후는 순수 돌진 구간. */
const LOOK_SETTLE_PROGRESS = 0.35
/** 목표 방향 돌진 거리 상한 (월드 단위) — 가까운 별로 워프해도 과하지 않게. */
const MAX_DOLLY_DISTANCE = 2_200
/** 출발 시점 목표까지 거리 대비 돌진 비율 — 목표 항성을 지나치지 않는다. */
const DOLLY_DISTANCE_RATIO = 0.45

interface WarpPose {
  readonly initialPosition: Vector3
  readonly initialLook: Vector3
  readonly dollyDirection: Vector3
  readonly dollyDistance: number
}

function smoothstep01(value: number): number {
  const t = Math.min(1, Math.max(0, value))
  return t * t * (3 - 2 * t)
}

export function WarpCameraRig() {
  const seed = useGameStore((state) => state.seed)
  const scene = useGameStore((state) => state.scene)
  const targetStarId = scene.kind === 'warping' ? scene.to : null

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

  // 워프 동안 OrbitControls 정지 — 카메라는 이 리그가 전담한다
  useEffect(() => {
    if (controls == null) return
    controls.enabled = false
    return () => {
      controls.enabled = true
    }
  }, [controls])

  useFrame((state) => {
    if (targetPosition == null) return
    const camera = state.camera

    // 첫 프레임에 출발 포즈 고정 — 플레이어가 보던 그 시점에서 연출이 시작된다
    if (startRef.current == null || poseRef.current == null) {
      startRef.current = state.clock.elapsedTime
      const initialPosition = camera.position.clone()
      const initialLook =
        controls?.target instanceof Vector3
          ? controls.target.clone()
          : initialPosition.clone().add(camera.getWorldDirection(lookScratch))
      const toTarget = targetPosition.clone().sub(initialPosition)
      const distanceToTarget = toTarget.length()
      poseRef.current = {
        initialPosition,
        initialLook,
        dollyDirection: distanceToTarget > 1 ? toTarget.divideScalar(distanceToTarget) : toTarget.set(0, 0, 0),
        dollyDistance: Math.min(MAX_DOLLY_DISTANCE, distanceToTarget * DOLLY_DISTANCE_RATIO),
      }
    }
    const pose = poseRef.current

    const elapsed = state.clock.elapsedTime - startRef.current
    const progress = Math.min(1, elapsed / (WARP_STAGE_A_MS / 1_000))

    // 1) 시선 전환 — 초반(~35%)에 목표 항성으로 부드럽게 돌아간다
    const lookBlend = smoothstep01(progress / LOOK_SETTLE_PROGRESS)
    lookScratch.lerpVectors(pose.initialLook, targetPosition, lookBlend)

    // 2) 돌진 — 가속(progress³)으로 목표를 향해 전진, 별밭 시차가 속도감을 만든다
    const dolly = progress * progress * progress
    camera.position
      .copy(pose.initialPosition)
      .addScaledVector(pose.dollyDirection, pose.dollyDistance * dolly)
    camera.lookAt(lookScratch)
  })

  return null
}
