import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { DoubleSide, type Group } from 'three'

import type { StarId } from '@/engine'
import { SECTOR_SIZE } from '@/engine'
import type { LoadedSector } from '@/scenes/galaxy/useVisibleSectors'
import { useGameStore } from '@/store'

interface VisitedMarker {
  readonly id: StarId
  readonly position: readonly [number, number, number]
  readonly isCurrent: boolean
}

interface VisitedStarMarkersProps {
  readonly sectors: readonly LoadedSector[]
}

/** 로드된 섹터 안의 방문한 별에 링 마커 — 현재 위치는 강조색. */
export function VisitedStarMarkers({ sectors }: VisitedStarMarkersProps) {
  const visitedStars = useGameStore((state) => state.visitedStars)
  const currentStarId = useGameStore((state) => state.currentStarId)
  const groupRef = useRef<Group>(null)

  const markers = useMemo(() => {
    const found: VisitedMarker[] = []
    for (const sector of sectors) {
      for (const star of sector.stars) {
        if (!visitedStars.has(star.id)) continue
        found.push({
          id: star.id,
          position: [
            star.sector.sx * SECTOR_SIZE + star.localPos[0],
            star.sector.sy * SECTOR_SIZE + star.localPos[1],
            star.sector.sz * SECTOR_SIZE + star.localPos[2],
          ],
          isCurrent: star.id === currentStarId,
        })
      }
    }
    return found
  }, [sectors, visitedStars, currentStarId])

  useFrame((state) => {
    const group = groupRef.current
    if (group == null) return
    for (const child of group.children) {
      child.quaternion.copy(state.camera.quaternion)
    }
  })

  return (
    <group ref={groupRef}>
      {markers.map((marker) => (
        <mesh key={marker.id} position={[marker.position[0], marker.position[1], marker.position[2]]}>
          <ringGeometry args={[1.5, 1.9, 32]} />
          <meshBasicMaterial
            color={marker.isCurrent ? '#7c5cff' : '#3f78c2'}
            transparent
            opacity={marker.isCurrent ? 0.95 : 0.55}
            side={DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  )
}
