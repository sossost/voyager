import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Matrix4, Quaternion, Vector3 } from 'three'

import { starWorldPosition } from '@/engine'
import {
  WARP_AIM_PROGRESS,
  WARP_CHARGE_PROGRESS,
  WARP_IGNITION_PROGRESS,
  WARP_STAGE_A_MS,
} from '@/scenes/warp/warpTimeline'
import { useGameStore } from '@/store'

/**
 * 워프 카메라 리그 — 스테이지 A 동안 카메라를 전담한다 (결정 26·31·34·41-f).
 *
 * 워프는 항상 1인칭(우주선 시점)에서 경험한다. 발동 뷰에 따라 진입이 갈린다:
 *  - 우주선 뷰: 정박 포즈에서 목표 별 방향으로 부드럽게 회전(예열 홀드 동안).
 *  - 퍼스펙티브 뷰: 우주선 포즈로 컷(줌아웃 시) 또는 근접 스윕(줌인 시) 후 목표로 회전.
 * 시퀀스는 다섯 박자다: ① 목표 응시 정렬(회전) → ②③ 정렬 고정 대기·충전(카메라 정지,
 * 상단 게이지만 0→100%) → ④ 게이지 만충 후 시선 고정한 채 목표 반대로 반동(wind-up,
 * 도착 줌인과 대칭) → ⑤ 점화(WARP_IGNITION_PROGRESS)에 풀백 지점에서 목표 방향 큐빅
 * 가속 돌진(뿜). 연출(반동·돌진)은 게이지 만충 후에 시작한다 — 회전·반동·돌진이 겹치지 않아야 읽힌다.
 * 별밭 시차가 이동감을, 스트리크가 속도감을 만든다. OrbitControls는 워프 동안 비활성 —
 * 타임라인은 ref 기반, store 쓰기 없음 (철칙 6).
 */

/** 우주선 시점 거리 — 출발 항성에서 목표 반대편으로 이만큼 물러난 포즈. */
const SHIP_OFFSET_DISTANCE = 30
/**
 * 이탈 풀백 — 정렬을 마친 뒤 목표 반대로 이만큼 물러섰다가(반동) 돌진한다.
 * 도착의 빨려드는 줌인(ShipCameraRig)과 대칭되는 출발 반동. 정렬·반동·돌진 지점이
 * 모두 dollyDirection 축에 colinear라, 회전을 먼저 끝내면 반동이 "축 방향 순수
 * 후퇴(목표가 화면 중앙 고정)"로 또렷이 읽힌다. 돌진 시작점이 곧 이 풀백 지점이라 연속적.
 */
const DEPARTURE_PULLBACK_DISTANCE = 70
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
  /** 정렬 종료 포즈 — 출발 항성 뒤 우주선 포즈. 반동이 여기서 풀백 지점으로 물러선다. */
  readonly shipPosition: Vector3
  /** 반동 종료(점화) 포즈 — 우주선 포즈에서 풀백만큼 더 물러선 돌진 시작점. */
  readonly launchPosition: Vector3
  /** 정렬 위치 보간 시작점 — 발동 위치(가까우면) 또는 우주선 포즈(멀어 컷이면). */
  readonly aimFromPosition: Vector3
  readonly dollyDirection: Vector3
  /** 풀백 + 본 돌진을 합친 총 전진 거리 — 풀백 지점에서 목표 방향으로 이만큼 돌진. */
  readonly rushDistance: number
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
      // 풀백 지점 — 우주선 포즈에서 목표 반대로 더 물러선 곳(반동). 예열의 종착점이자 돌진 시작점.
      const launchPosition = shipPosition
        .clone()
        .addScaledVector(dollyDirection, -DEPARTURE_PULLBACK_DISTANCE)

      // 정렬은 우주선 포즈로 좁힌다 — 발동 위치가 멀면(퍼스펙티브 줌아웃) 컷, 가까우면 스윕
      const aimFromPosition =
        camera.position.distanceTo(shipPosition) > SHIP_POSE_CUT_DISTANCE
          ? shipPosition.clone()
          : camera.position.clone()

      // 정렬·반동·돌진 지점이 dollyDirection 축에 colinear라 응시 방위는 어느 지점에서나 동일
      startQuat.copy(camera.quaternion)
      lookMatrix.lookAt(shipPosition, targetPosition, UP)
      aimQuat.setFromRotationMatrix(lookMatrix)

      const dollyDistance = Math.min(
        MAX_DOLLY_DISTANCE,
        shipPosition.distanceTo(targetPosition) * DOLLY_DISTANCE_RATIO,
      )
      poseRef.current = {
        shipPosition,
        launchPosition,
        aimFromPosition,
        dollyDirection,
        // 풀백을 되감고도 본 돌진 거리를 채우도록 합산 — 끝점은 풀백 유무와 동일.
        rushDistance: DEPARTURE_PULLBACK_DISTANCE + dollyDistance,
      }
    }
    const pose = poseRef.current

    const elapsed = state.clock.elapsedTime - startRef.current
    const progress = Math.min(1, elapsed / (WARP_STAGE_A_MS / 1_000))

    if (progress < WARP_AIM_PROGRESS) {
      // ① 정렬 단계 — 우주선 포즈로 좁히며 목표 별 방향으로 회전한다 (아직 반동 없음)
      const aim = easeOut(clamp01(progress / WARP_AIM_PROGRESS))
      camera.position.lerpVectors(pose.aimFromPosition, pose.shipPosition, aim)
      camera.quaternion.slerpQuaternions(startQuat, aimQuat, aim)
      return
    }

    if (progress < WARP_CHARGE_PROGRESS) {
      // ②③ 대기·충전 단계 — 카메라는 정렬 포즈에 정지하고, 상단 게이지만 차오른다.
      // 연출(반동·돌진)은 게이지가 다 찬 뒤(WARP_CHARGE_PROGRESS)에야 시작한다.
      camera.position.copy(pose.shipPosition)
      camera.quaternion.copy(aimQuat)
      return
    }

    if (progress < WARP_IGNITION_PROGRESS) {
      // ④ 반동 단계 — 게이지 만충 후, 정렬을 고정한 채(목표 응시) 목표 반대로 물러선다 (wind-up).
      // 축 방향 순수 후퇴라 목표가 중앙에 박힌 채 배경만 멀어진다.
      const recoil = easeOut(
        clamp01((progress - WARP_CHARGE_PROGRESS) / (WARP_IGNITION_PROGRESS - WARP_CHARGE_PROGRESS)),
      )
      camera.position.lerpVectors(pose.shipPosition, pose.launchPosition, recoil)
      camera.quaternion.copy(aimQuat)
      return
    }

    // ⑤ 돌진(뿜) 단계 — 풀백 지점에서 목표 방향 큐빅 가속 (rush=0이 곧 풀백 지점이라 연속적)
    const rushLocal = clamp01((progress - WARP_IGNITION_PROGRESS) / (1 - WARP_IGNITION_PROGRESS))
    const rush = rushLocal * rushLocal * rushLocal
    camera.position
      .copy(pose.launchPosition)
      .addScaledVector(pose.dollyDirection, pose.rushDistance * rush)
    camera.lookAt(targetPosition)
  })

  return null
}
