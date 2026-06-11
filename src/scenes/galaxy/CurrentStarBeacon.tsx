import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  DoubleSide,
  type Group,
  type Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  RingGeometry,
  Vector3,
} from 'three'

import { starWorldPosition } from '@/engine/galaxy/position'
import { useGameStore } from '@/store'

/**
 * 현재 위치 비콘 — 어떤 줌에서도 "여기"가 한눈에 (백로그 F-2, 정보 위계 최상단).
 * 화면 고정 크기로 클램프한 펄스 링 + 소나처럼 퍼지는 확장 링 2개.
 * 워프 중에는 currentStarId가 이미 목적지(결정 16)라 착륙 지점 비콘이 된다.
 */

/** "여기"의 색 — 한색 별밭·보라 선택 링·청록 방문 틴트와 모두 갈리는 따뜻한 호박색. */
const BEACON_COLOR = '#ffd166'
/** 화면 고정 크기 목표 — 비콘 링의 화면 반지름 (px). */
const BEACON_SCREEN_RADIUS_PX = 17
/** 근접 줌에서 별 점광원에 들러붙지 않도록 월드 스케일 하한을 둔다. */
const MIN_WORLD_SCALE = 1.6
/** 카메라가 PerspectiveCamera가 아닐 때(이론상 없음)의 FOV 폴백. */
const FALLBACK_FOV_DEGREES = 60

const PULSE_SPEED = 2.6
const PULSE_AMPLITUDE = 0.07
/** 소나 링 — 주기마다 비콘 크기에서 최대 배율까지 퍼지며 사라진다. */
const SONAR_PERIOD_SECONDS = 2.4
const SONAR_MAX_SCALE = 3.4
const SONAR_MAX_OPACITY = 0.7

const RING_SEGMENTS = 48

function fract(value: number): number {
  return value - Math.floor(value)
}

export function CurrentStarBeacon() {
  const seed = useGameStore((state) => state.seed)
  const currentStarId = useGameStore((state) => state.currentStarId)

  const groupRef = useRef<Group>(null)
  const pulseRef = useRef<Mesh>(null)
  const sonarARef = useRef<Mesh>(null)
  const sonarBRef = useRef<Mesh>(null)
  const worldPosition = useRef(new Vector3())

  const position = useMemo(
    () => starWorldPosition(seed, currentStarId),
    [seed, currentStarId],
  )

  const pulseGeometry = useMemo(() => new RingGeometry(0.78, 0.95, RING_SEGMENTS), [])
  const sonarGeometry = useMemo(() => new RingGeometry(0.92, 1.0, RING_SEGMENTS), [])
  const pulseMaterial = useMemo(() => buildRingMaterial(0.95), [])
  const sonarMaterialA = useMemo(() => buildRingMaterial(0), [])
  const sonarMaterialB = useMemo(() => buildRingMaterial(0), [])

  useEffect(() => () => pulseGeometry.dispose(), [pulseGeometry])
  useEffect(() => () => sonarGeometry.dispose(), [sonarGeometry])
  useEffect(() => () => pulseMaterial.dispose(), [pulseMaterial])
  useEffect(() => () => sonarMaterialA.dispose(), [sonarMaterialA])
  useEffect(() => () => sonarMaterialB.dispose(), [sonarMaterialB])

  useFrame((state) => {
    const group = groupRef.current
    if (group == null || position == null) return

    // 화면 고정 크기: 수직 FOV 기준으로 1px이 차지하는 월드 길이를 거리에서 역산
    const camera = state.camera
    const fov = camera instanceof PerspectiveCamera ? camera.fov : FALLBACK_FOV_DEGREES
    worldPosition.current.set(position[0], position[1], position[2])
    const distance = camera.position.distanceTo(worldPosition.current)
    const worldPerPixel = (2 * distance * Math.tan((fov * Math.PI) / 360)) / state.size.height
    const scale = Math.max(BEACON_SCREEN_RADIUS_PX * worldPerPixel, MIN_WORLD_SCALE)
    group.scale.setScalar(scale)
    group.quaternion.copy(camera.quaternion)

    const elapsed = state.clock.elapsedTime
    pulseRef.current?.scale.setScalar(1 + PULSE_AMPLITUDE * Math.sin(elapsed * PULSE_SPEED))

    updateSonarRing(sonarARef.current, sonarMaterialA, fract(elapsed / SONAR_PERIOD_SECONDS))
    updateSonarRing(sonarBRef.current, sonarMaterialB, fract(elapsed / SONAR_PERIOD_SECONDS + 0.5))
  })

  if (position == null) return null

  return (
    <group ref={groupRef} position={[position[0], position[1], position[2]]}>
      <mesh ref={pulseRef} geometry={pulseGeometry} material={pulseMaterial} />
      <mesh ref={sonarARef} geometry={sonarGeometry} material={sonarMaterialA} />
      <mesh ref={sonarBRef} geometry={sonarGeometry} material={sonarMaterialB} />
    </group>
  )
}

function buildRingMaterial(initialOpacity: number): MeshBasicMaterial {
  return new MeshBasicMaterial({
    color: BEACON_COLOR,
    transparent: true,
    opacity: initialOpacity,
    side: DoubleSide,
    depthWrite: false,
    blending: AdditiveBlending,
  })
}

/** 소나 위상(0~1) → 퍼지는 스케일 + 잦아드는 불투명도. */
function updateSonarRing(ring: Mesh | null, material: MeshBasicMaterial, phase: number): void {
  if (ring == null) return
  ring.scale.setScalar(1 + phase * (SONAR_MAX_SCALE - 1))
  const remaining = 1 - phase
  material.opacity = remaining * remaining * SONAR_MAX_OPACITY
}
