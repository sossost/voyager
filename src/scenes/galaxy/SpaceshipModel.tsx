import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, type Group, type Mesh, MeshBasicMaterial, RingGeometry } from 'three'

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

/** 모델 스케일 — 항성계 프레이밍 거리(~138)에서 곁의 3인칭 요소로 읽히는 크기. */
const SHIP_SCALE = 1.5
/**
 * 우주선 오프셋 — ShipCameraRig 정박 방향(Y:42, Z:132, 결정 41-e)을 축약해
 * 별로부터 같은 방향으로 떨어진 위치에 배치한다. 이렇게 하면 퍼스펙티브 뷰에서
 * "카메라가 보는 방향에서 멀어진 배"로 읽혀 별과 분리감이 생긴다 (백로그 H-4).
 * 별 구체 반경(5)보다 충분히 멀어 겹침 없음.
 */
const SHIP_OFFSET_Y = 22
const SHIP_OFFSET_Z = 68

/** 가벼운 아이들 — 천천히 요잉하며 미세하게 부유한다 (살아있는 느낌). */
const IDLE_YAW_SPEED = 0.25
const BOB_SPEED = 1.1
const BOB_AMPLITUDE = 0.6

/** 헤일로 링 — 우주선을 별밭에서 돋보이게 하는 엔진 청록 선택 링 (백로그 H-6). */
const HALO_RING_INNER = 3.2
const HALO_RING_OUTER = 3.6
const HALO_RING_SEGMENTS = 48
const HALO_PULSE_SPEED = 1.8
const HALO_MIN_OPACITY = 0.18
const HALO_MAX_OPACITY = 0.45

export function SpaceshipModel() {
  const seed = useGameStore((state) => state.seed)
  const currentStarId = useGameStore((state) => state.currentStarId)

  const anchorRef = useRef<Group>(null)
  const shipRef = useRef<Group>(null)
  const haloRef = useRef<Mesh>(null)

  const position = useMemo(
    () => starWorldPosition(seed, currentStarId) ?? ([0, 0, 0] as const),
    [seed, currentStarId],
  )

  const haloGeometry = useMemo(
    () => new RingGeometry(HALO_RING_INNER, HALO_RING_OUTER, HALO_RING_SEGMENTS),
    [],
  )
  const haloMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        color: ENGINE_COLOR,
        transparent: true,
        opacity: HALO_MIN_OPACITY,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [],
  )

  useEffect(() => () => haloGeometry.dispose(), [haloGeometry])
  useEffect(() => () => haloMaterial.dispose(), [haloMaterial])

  useFrame((state) => {
    const ship = shipRef.current
    const halo = haloRef.current
    if (ship == null) return

    const elapsed = state.clock.elapsedTime
    ship.rotation.y = elapsed * IDLE_YAW_SPEED
    ship.position.y = Math.sin(elapsed * BOB_SPEED) * BOB_AMPLITUDE

    // 헤일로 빌보드 + 펄스 — 우주선이 별밭에 묻히지 않게 (백로그 H-6)
    if (halo != null) {
      halo.quaternion.copy(state.camera.quaternion)
      haloMaterial.opacity =
        HALO_MIN_OPACITY +
        (HALO_MAX_OPACITY - HALO_MIN_OPACITY) * (0.5 + 0.5 * Math.sin(elapsed * HALO_PULSE_SPEED))
    }
  })

  return (
    <group
      ref={anchorRef}
      position={[position[0], position[1] + SHIP_OFFSET_Y, position[2] + SHIP_OFFSET_Z]}
    >
      {/* 헤일로 링 — 빌보드 렌더, 우주선보다 앞에 그려 항상 보인다 */}
      <mesh ref={haloRef} geometry={haloGeometry} material={haloMaterial} />
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
