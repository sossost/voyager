import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { DoubleSide, type Group } from 'three'

import { starWorldPosition } from '@/engine/galaxy/position'
import { currentBodies } from '@/scenes/system/currentBodies'
import { useGameStore } from '@/store'

const PULSE_SPEED = 4
const PULSE_AMPLITUDE = 0.12
/** 정규화 링 — 안/밖 반경비. group.scale로 실제 크기를 입힌다. */
const RING_INNER_FACTOR = 0.82
const RING_SEGMENTS = 48
/** 멀리 있는 카탈로그 별(포인트 스프라이트) 선택 시 링 외경. */
const DISTANT_RING_RADIUS = 3.0
/** 현재 항성계 별(구체) 선택 시 별을 감싸는 헤일로 — 본체 반경의 배수. */
const BODY_HALO_FACTOR = 1.55

/**
 * 선택한 별 주위의 맥동하는 링 — 항상 카메라를 향한다.
 *
 * 다중성계(binary-stars): 클릭한 별(주성·동반성)의 *현재 월드 위치*(currentBodies, 뷰
 * 스케일 반영)에 링을 건다. 현재 항성계의 별(구체)을 선택하면 본체를 감싸는 헤일로 크기로
 * 키우고 depthTest를 꺼서 구체에 가려지지 않게 한다 — 우주선·퍼스펙티브 모두 정확하다.
 * 멀리 있는 카탈로그 별(포인트)은 카탈로그 좌표에 고정 크기 링.
 */
export function SelectedStarMarker() {
  const seed = useGameStore((state) => state.seed)
  const selectedStarId = useGameStore((state) => state.selectedStarId)
  const selectedBodyIndex = useGameStore((state) => state.selectedBodyIndex)
  const isShipView = useGameStore(
    (state) => state.scene.kind === 'galaxy' && state.scene.view === 'ship',
  )
  const groupRef = useRef<Group>(null)

  const catalogPosition = useMemo(
    () => (selectedStarId == null ? null : starWorldPosition(seed, selectedStarId)),
    [seed, selectedStarId],
  )

  useFrame((state) => {
    const group = groupRef.current
    if (group == null) return

    // 우주선 뷰에서 현재 항성계의 별이면 게시된 본체 월드 좌표·반경에 헤일로를 건다.
    // 퍼스펙티브에선 별이 작고 빠르게 공전해 링이 떨리므로 질량중심(카탈로그 좌표)에 둔다.
    const isCurrentBody =
      isShipView &&
      selectedStarId != null &&
      currentBodies.starId === selectedStarId &&
      selectedBodyIndex < currentBodies.count
    let radius = DISTANT_RING_RADIUS
    if (isCurrentBody) {
      const pos = currentBodies.positions[selectedBodyIndex]
      if (pos != null) group.position.copy(pos)
      radius = (currentBodies.radii[selectedBodyIndex] ?? DISTANT_RING_RADIUS) * BODY_HALO_FACTOR
    } else if (catalogPosition != null) {
      group.position.set(catalogPosition[0], catalogPosition[1], catalogPosition[2])
    }

    // 시각 연출 전용 — 초월함수는 scenes/에서 허용 (결정 14)
    const pulse = 1 + PULSE_AMPLITUDE * Math.sin(state.clock.elapsedTime * PULSE_SPEED)
    group.scale.setScalar(radius * pulse)
    group.quaternion.copy(state.camera.quaternion)
  })

  if (catalogPosition == null) return null

  return (
    <group ref={groupRef}>
      {/* 정규화 링(외경 1) — group.scale로 실제 크기. depthTest=false로 별 구체 위에 항상 보인다. */}
      <mesh renderOrder={10}>
        <ringGeometry args={[RING_INNER_FACTOR, 1, RING_SEGMENTS]} />
        <meshBasicMaterial
          color="#7c5cff"
          transparent
          opacity={0.9}
          side={DoubleSide}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}
