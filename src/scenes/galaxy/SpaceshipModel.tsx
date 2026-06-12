import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  type Group,
  type Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Quaternion,
  RingGeometry,
  Vector3,
} from 'three'

import { starWorldPosition } from '@/engine/galaxy/position'
import { useGameStore } from '@/store'

/**
 * 퍼스펙티브(3인칭) 뷰의 우주선 모델 (결정 41-e) — 현재 항성계 곁에 떠 있는 내 배.
 * 퍼스펙티브 뷰에서만 렌더하며 CurrentStarBeacon을 대체한다(현재 위치 = 우주선 위치).
 *
 * 기하 도형 플레이스홀더 — 나중에 실아트로 교체 가능하게 이 컴포넌트로 캡슐화한다.
 * 항성과 겹치지 않게 궤도면 위로 띄우고, 항성계(CurrentSystem)의 주변광·항성 포인트라이트로
 * 셰이딩한다(자체 광원 없음). 약한 emissive로 위쪽 면도 묻히지 않게 한다. 렌더 전용 — GEN 무관.
 */

/** 선체 색 — 한색 별밭·보라 선택과 갈리는 차가운 강철. */
const HULL_COLOR = '#cdd6e6'
const WING_COLOR = '#8590a6'
/** 콕핏·엔진 액센트 — 비콘과 같은 호박색(현재 위치 표지의 연속성). */
const ACCENT_COLOR = '#ffd166'
const ENGINE_COLOR = '#7cf2e0'

/**
 * 모델 스케일 — 1/8 스케일 항성계(Neptune ≈5 world units)에서 읽히는 크기.
 * 선체 길이 = 3.6 * SHIP_SCALE ≈ 0.54 world units — 시스템 대비 작은 점으로 보인다.
 */
const SHIP_SCALE = 0.15
/**
 * 우주선 오프셋 — 1/8 스케일 기준 Neptune(≈5 world units) 바로 바깥에 배치.
 * 별과 분리감을 주면서 시스템과 함께 읽히는 거리.
 */
const SHIP_OFFSET_Y = 3
const SHIP_OFFSET_Z = 8

/** 부유 — 미세하게 떠오르내리며 살아있는 느낌 (회전 없음, 항성 바라보기 고정). */
const BOB_SPEED = 1.1
const BOB_AMPLITUDE = 0.6

/**
 * 위치 마커 링 — 줌아웃해도 현재 위치를 항상 화면 고정 크기로 표시.
 * CurrentStarBeacon의 worldPerPixel 기법 동일 적용.
 */
const MARKER_RING_INNER = 0.85
const MARKER_RING_OUTER = 1.0
const MARKER_RING_SEGMENTS = 48
const MARKER_SCREEN_PX = 10
const MARKER_MIN_WORLD_SCALE = 0.4
const FALLBACK_FOV_DEGREES = 60
const MARKER_PULSE_SPEED = 1.8
const MARKER_MIN_OPACITY = 0.55
const MARKER_MAX_OPACITY = 0.9

/**
 * 항성 방향 고정 쿼터니언 — anchor 로컬 +Z가 항성을 향한다.
 * anchor 위치는 star+(0,22,68)이므로 anchor→star 방향은 (0,-22,-68) normalized.
 * 매 프레임 재계산을 피하기 위해 모듈 레벨에서 한 번만 계산.
 */
const _Z = new Vector3(0, 0, 1)
const _TO_STAR = new Vector3(0, -SHIP_OFFSET_Y, -SHIP_OFFSET_Z).normalize()
const SHIP_FACING_QUAT = new Quaternion().setFromUnitVectors(_Z, _TO_STAR)
const SHIP_FACING_QUAT_INV = SHIP_FACING_QUAT.clone().invert()

export function SpaceshipModel() {
  const seed = useGameStore((state) => state.seed)
  const currentStarId = useGameStore((state) => state.currentStarId)

  const anchorRef = useRef<Group>(null)
  const shipRef = useRef<Group>(null)
  const markerRef = useRef<Mesh>(null)

  const position = useMemo(
    () => starWorldPosition(seed, currentStarId) ?? ([0, 0, 0] as const),
    [seed, currentStarId],
  )

  const markerGeometry = useMemo(
    () => new RingGeometry(MARKER_RING_INNER, MARKER_RING_OUTER, MARKER_RING_SEGMENTS),
    [],
  )
  const markerMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        color: ENGINE_COLOR,
        transparent: true,
        opacity: MARKER_MIN_OPACITY,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [],
  )

  useEffect(() => () => markerGeometry.dispose(), [markerGeometry])
  useEffect(() => () => markerMaterial.dispose(), [markerMaterial])

  useFrame((state) => {
    const anchor = anchorRef.current
    const ship = shipRef.current
    const marker = markerRef.current
    if (anchor == null || ship == null) return

    const elapsed = state.clock.elapsedTime

    // 항성 방향 고정 — 우주선 코(+Z)가 항성을 향한다. 아이들 요잉 없음.
    anchor.quaternion.copy(SHIP_FACING_QUAT)

    // 부유 — anchor 로컬 Y 방향으로 미세하게 오르내린다.
    ship.position.y = Math.sin(elapsed * BOB_SPEED) * BOB_AMPLITUDE

    // 위치 마커 — 화면 고정 크기 billboard (CurrentStarBeacon과 동일 기법)
    if (marker != null) {
      const cam = state.camera
      const fov = cam instanceof PerspectiveCamera ? cam.fov : FALLBACK_FOV_DEGREES
      const dist = cam.position.distanceTo(anchor.position)
      const worldPerPixel = (2 * dist * Math.tan((fov * Math.PI) / 360)) / state.size.height
      marker.scale.setScalar(Math.max(MARKER_SCREEN_PX * worldPerPixel, MARKER_MIN_WORLD_SCALE))
      // anchor 회전 역보정으로 마커가 항상 카메라를 향한다
      marker.quaternion.copy(state.camera.quaternion).premultiply(SHIP_FACING_QUAT_INV)
      markerMaterial.opacity =
        MARKER_MIN_OPACITY +
        (MARKER_MAX_OPACITY - MARKER_MIN_OPACITY) *
          (0.5 + 0.5 * Math.sin(elapsed * MARKER_PULSE_SPEED))
    }
  })

  return (
    <group
      ref={anchorRef}
      position={[position[0], position[1] + SHIP_OFFSET_Y, position[2] + SHIP_OFFSET_Z]}
    >
      {/* 위치 마커 링 — 화면 고정 크기 billboard, 줌아웃해도 항상 보인다 */}
      <mesh ref={markerRef} geometry={markerGeometry} material={markerMaterial} />
      <group ref={shipRef} scale={SHIP_SCALE}>
        {/* 선체 — +Z를 향하는 원뿔 (cone 기본 +Y를 +90° 회전) */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[1, 3.6, 12]} />
          <meshStandardMaterial
            color={HULL_COLOR}
            emissive={HULL_COLOR}
            emissiveIntensity={0.18}
            roughness={0.45}
            metalness={0.5}
          />
        </mesh>
        {/* 날개 — 뒤로 스윕된 얇은 박스 2장 */}
        <mesh position={[1.15, 0, -0.7]} rotation={[0, 0, -0.32]}>
          <boxGeometry args={[2.2, 0.12, 1.1]} />
          <meshStandardMaterial
            color={WING_COLOR}
            emissive={WING_COLOR}
            emissiveIntensity={0.15}
            roughness={0.5}
            metalness={0.45}
          />
        </mesh>
        <mesh position={[-1.15, 0, -0.7]} rotation={[0, 0, 0.32]}>
          <boxGeometry args={[2.2, 0.12, 1.1]} />
          <meshStandardMaterial
            color={WING_COLOR}
            emissive={WING_COLOR}
            emissiveIntensity={0.15}
            roughness={0.5}
            metalness={0.45}
          />
        </mesh>
        {/* 콕핏 — 앞쪽 상단의 호박색 캐노피 */}
        <mesh position={[0, 0.35, 0.9]}>
          <sphereGeometry args={[0.5, 16, 12]} />
          <meshStandardMaterial
            color={ACCENT_COLOR}
            emissive={ACCENT_COLOR}
            emissiveIntensity={0.6}
            roughness={0.3}
          />
        </mesh>
        {/* 엔진 글로우 — 후미의 청록 가산 점 */}
        <mesh position={[0, 0, -1.9]}>
          <sphereGeometry args={[0.42, 12, 10]} />
          <meshBasicMaterial color={ENGINE_COLOR} transparent opacity={0.9} />
        </mesh>
      </group>
    </group>
  )
}
