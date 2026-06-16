import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  DoubleSide,
  type Group,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Vector3,
} from 'three'

import { starWorldPosition } from '@/engine/galaxy/position'
import { useGameStore } from '@/store'

/**
 * 워프 목표 조준 레티클 — 워프 중 도착 지점을 "조준"하는 표지 (워프 전용 마운트).
 * 가운데가 벌어진 홀로색 크로스헤어(상·하·좌·우 4틱, 중앙 갭에 목표 별이 들어온다).
 * 어떤 줌에서도 같은 크기로 읽히도록 화면 고정 크기로 클램프하고 빌보드로 카메라를 향한다.
 * currentStarId가 이미 목적지(결정 16)라 자연히 착륙 조준점이 된다.
 */

/** 조준 색 — 함교 홀로그램 톤(--color-holo, #5eead4). 가산 블렌딩이라 Bloom이 글로우를 만든다. */
const RETICLE_COLOR = '#5eead4'
/** 화면 고정 크기 목표 — 레티클 틱 바깥 끝의 화면 반지름 (px). */
const RETICLE_SCREEN_RADIUS_PX = 24
/** 근접 줌에서 별 점광원에 들러붙지 않도록 월드 스케일 하한을 둔다. */
const MIN_WORLD_SCALE = 1.6
/** 카메라가 PerspectiveCamera가 아닐 때(이론상 없음)의 FOV 폴백. */
const FALLBACK_FOV_DEGREES = 60

/** 중앙 갭 반경 (로컬, 바깥 끝 = 1.0) — 목표 별이 이 안에 또렷이 보이도록 벌려 둔다. */
const GAP_RADIUS = 0.42
/** 틱 두께 (로컬). */
const TICK_THICKNESS = 0.07
/** 틱 길이 = 갭 끝에서 바깥 끝(1.0)까지. */
const TICK_LENGTH = 1 - GAP_RADIUS
/** 틱 중심까지의 거리 (갭 끝 + 길이의 절반). */
const TICK_CENTER = GAP_RADIUS + TICK_LENGTH / 2

/** 조준 "락온" 호흡 — 미세하게 수축·확장하며 살아 있는 느낌을 준다. */
const PULSE_SPEED = 2.6
const PULSE_AMPLITUDE = 0.05
const RETICLE_OPACITY = 0.9

export function CurrentStarBeacon() {
  const seed = useGameStore((state) => state.seed)
  const currentStarId = useGameStore((state) => state.currentStarId)

  const groupRef = useRef<Group>(null)
  const worldPosition = useRef(new Vector3())

  const position = useMemo(
    () => starWorldPosition(seed, currentStarId),
    [seed, currentStarId],
  )

  // 세로 틱(상·하)과 가로 틱(좌·우)용 평면 — 4틱이 두 지오메트리를 공유한다.
  const verticalGeometry = useMemo(() => new PlaneGeometry(TICK_THICKNESS, TICK_LENGTH), [])
  const horizontalGeometry = useMemo(() => new PlaneGeometry(TICK_LENGTH, TICK_THICKNESS), [])
  const material = useMemo(
    () =>
      new MeshBasicMaterial({
        color: RETICLE_COLOR,
        transparent: true,
        opacity: RETICLE_OPACITY,
        side: DoubleSide,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [],
  )

  useEffect(() => () => verticalGeometry.dispose(), [verticalGeometry])
  useEffect(() => () => horizontalGeometry.dispose(), [horizontalGeometry])
  useEffect(() => () => material.dispose(), [material])

  useFrame((state) => {
    const group = groupRef.current
    if (group == null || position == null) return

    // 화면 고정 크기: 수직 FOV 기준으로 1px이 차지하는 월드 길이를 거리에서 역산
    const camera = state.camera
    const fov = camera instanceof PerspectiveCamera ? camera.fov : FALLBACK_FOV_DEGREES
    worldPosition.current.set(position[0], position[1], position[2])
    const distance = camera.position.distanceTo(worldPosition.current)
    const worldPerPixel = (2 * distance * Math.tan((fov * Math.PI) / 360)) / state.size.height
    const baseScale = Math.max(RETICLE_SCREEN_RADIUS_PX * worldPerPixel, MIN_WORLD_SCALE)
    const pulse = 1 + PULSE_AMPLITUDE * Math.sin(state.clock.elapsedTime * PULSE_SPEED)
    group.scale.setScalar(baseScale * pulse)
    group.quaternion.copy(camera.quaternion)
  })

  if (position == null) return null

  return (
    <group ref={groupRef} position={[position[0], position[1], position[2]]}>
      <mesh geometry={verticalGeometry} material={material} position={[0, TICK_CENTER, 0]} />
      <mesh geometry={verticalGeometry} material={material} position={[0, -TICK_CENTER, 0]} />
      <mesh geometry={horizontalGeometry} material={material} position={[TICK_CENTER, 0, 0]} />
      <mesh geometry={horizontalGeometry} material={material} position={[-TICK_CENTER, 0, 0]} />
    </group>
  )
}
