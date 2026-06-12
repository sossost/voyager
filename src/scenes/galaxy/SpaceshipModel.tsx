import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import type { Group } from 'three'

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
/** 항성 위로 띄우는 높이 — 궤도면(행성) 위라 별·행성과 겹치지 않는다. */
const SHIP_ABOVE_STAR = 18

/** 가벼운 아이들 — 천천히 요잉하며 미세하게 부유한다 (살아있는 느낌). */
const IDLE_YAW_SPEED = 0.25
const BOB_SPEED = 1.1
const BOB_AMPLITUDE = 0.6

export function SpaceshipModel() {
  const seed = useGameStore((state) => state.seed)
  const currentStarId = useGameStore((state) => state.currentStarId)

  const anchorRef = useRef<Group>(null)
  const shipRef = useRef<Group>(null)

  const position = useMemo(
    () => starWorldPosition(seed, currentStarId) ?? ([0, 0, 0] as const),
    [seed, currentStarId],
  )

  useFrame((state) => {
    const ship = shipRef.current
    if (ship == null) return
    const elapsed = state.clock.elapsedTime
    ship.rotation.y = elapsed * IDLE_YAW_SPEED
    ship.position.y = Math.sin(elapsed * BOB_SPEED) * BOB_AMPLITUDE
  })

  return (
    <group
      ref={anchorRef}
      position={[position[0], position[1] + SHIP_ABOVE_STAR, position[2]]}
    >
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
