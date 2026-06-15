import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { DoubleSide, type Group, Vector3 } from 'three'

import { starById } from '@/engine'
import { starWorldPosition } from '@/engine/galaxy/position'
import { bodyPositions, bodyVisualRadius, STAR_VISUAL_RADIUS } from '@/scenes/system/multiplicity'
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
 * 다중성계(binary-stars): 클릭한 별(주성·동반성)의 *현재 공전 위치*에 링을 건다.
 * 현재 항성계의 별(큰 구체)을 선택하면 본체를 감싸는 헤일로 크기로 키우고 depthTest를 꺼서
 * 구체에 가려지지 않게 한다 — 멀리 있는 카탈로그 별(포인트)은 기존 고정 크기.
 * 우주선 뷰(스케일 1)에선 본체에 정확히 붙고, 그 외(퍼스펙티브 1/8)에선 오프셋 스케일을
 * 알 수 없어 질량중심에 고정 크기로 붙인다 — StarCalloutProjector와 같은 근사.
 */
export function SelectedStarMarker() {
  const seed = useGameStore((state) => state.seed)
  const selectedStarId = useGameStore((state) => state.selectedStarId)
  const selectedBodyIndex = useGameStore((state) => state.selectedBodyIndex)
  const currentStarId = useGameStore((state) => state.currentStarId)
  const isShipView = useGameStore(
    (state) => state.scene.kind === 'galaxy' && state.scene.view === 'ship',
  )
  const groupRef = useRef<Group>(null)

  const base = useMemo(
    () => (selectedStarId == null ? null : starWorldPosition(seed, selectedStarId)),
    [seed, selectedStarId],
  )
  const star = useMemo(
    () => (selectedStarId == null ? null : starById(seed, selectedStarId)),
    [seed, selectedStarId],
  )

  // 현재 항성계 별 = 큰 구체로 렌더되므로 본체를 감싸는 헤일로 크기 + 본체 추종.
  const isCurrentSystem = selectedStarId != null && selectedStarId === currentStarId
  const encirclesBody = isShipView && isCurrentSystem && star != null
  const followsBody = encirclesBody && star.multiplicity !== 'single'

  const targetRadius = useMemo(() => {
    if (!encirclesBody || star == null) return DISTANT_RING_RADIUS
    const index =
      selectedBodyIndex >= 0 && selectedBodyIndex <= star.companions.length ? selectedBodyIndex : 0
    const spectral = index === 0 ? star.spectral : star.companions[index - 1]?.spectral ?? star.spectral
    const bodyRadius =
      index === 0 ? STAR_VISUAL_RADIUS : bodyVisualRadius(spectral, STAR_VISUAL_RADIUS)
    return bodyRadius * BODY_HALO_FACTOR
  }, [encirclesBody, star, selectedBodyIndex])

  const bodyScratch = useMemo(() => [new Vector3(), new Vector3(), new Vector3()], [])

  useFrame((state) => {
    const group = groupRef.current
    if (group == null || base == null) return

    group.position.set(base[0], base[1], base[2])
    if (followsBody && star != null) {
      const count = bodyPositions(star, state.clock.elapsedTime, bodyScratch)
      const index = selectedBodyIndex >= 0 && selectedBodyIndex < count ? selectedBodyIndex : 0
      group.position.add(bodyScratch[index] as Vector3)
    }

    // 시각 연출 전용 — 초월함수는 scenes/에서 허용 (결정 14)
    const pulse = 1 + PULSE_AMPLITUDE * Math.sin(state.clock.elapsedTime * PULSE_SPEED)
    group.scale.setScalar(targetRadius * pulse)
    group.quaternion.copy(state.camera.quaternion)
  })

  if (base == null) return null

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
