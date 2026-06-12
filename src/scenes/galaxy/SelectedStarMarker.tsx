import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { DoubleSide, type Group } from 'three'

import { starWorldPosition } from '@/engine/galaxy/position'
import { useGameStore } from '@/store'

const PULSE_SPEED = 4
const PULSE_AMPLITUDE = 0.12
const RING_INNER_RADIUS = 2.4
const RING_OUTER_RADIUS = 3.0
const RING_SEGMENTS = 48

/** 선택한 별 주위의 맥동하는 링 — 항상 카메라를 향한다. */
export function SelectedStarMarker() {
  const seed = useGameStore((state) => state.seed)
  const selectedStarId = useGameStore((state) => state.selectedStarId)
  const groupRef = useRef<Group>(null)

  const position = useMemo(
    () => (selectedStarId == null ? null : starWorldPosition(seed, selectedStarId)),
    [seed, selectedStarId],
  )

  useFrame((state) => {
    const group = groupRef.current
    if (group == null) return
    // 시각 연출 전용 — 초월함수는 scenes/에서 허용 (결정 14)
    const pulse = 1 + PULSE_AMPLITUDE * Math.sin(state.clock.elapsedTime * PULSE_SPEED)
    group.scale.setScalar(pulse)
    group.quaternion.copy(state.camera.quaternion)
  })

  if (position == null) return null

  return (
    <group ref={groupRef} position={[position[0], position[1], position[2]]}>
      <mesh>
        <ringGeometry args={[RING_INNER_RADIUS, RING_OUTER_RADIUS, RING_SEGMENTS]} />
        <meshBasicMaterial color="#7c5cff" transparent opacity={0.9} side={DoubleSide} />
      </mesh>
    </group>
  )
}
