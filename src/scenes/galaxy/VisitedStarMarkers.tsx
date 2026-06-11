import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  DoubleSide,
  type InstancedMesh,
  Matrix4,
  type Mesh,
  MeshBasicMaterial,
  RingGeometry,
  Vector3,
} from 'three'

import { SECTOR_SIZE } from '@/engine'
import type { LoadedSector } from '@/scenes/galaxy/useVisibleSectors'
import { useGameStore } from '@/store'

/** 방문 마커는 누적 성장한다 — 인스턴스 예산 상한으로 드로콜·비용을 캡 (코드 리뷰 지적). */
const MAX_VISIBLE_MARKERS = 512
const RING_INNER = 1.5
const RING_OUTER = 1.9
const RING_SEGMENTS = 32

interface VisitedStarMarkersProps {
  readonly sectors: readonly LoadedSector[]
}

/**
 * 방문한 별 링 마커 — 방문 별 전체를 InstancedMesh 1개(드로콜 1)로,
 * 현재 위치만 강조색 단일 메시로 그린다. 빌보드 회전은 매 프레임 행렬 갱신.
 */
export function VisitedStarMarkers({ sectors }: VisitedStarMarkersProps) {
  const visitedStars = useGameStore((state) => state.visitedStars)
  const currentStarId = useGameStore((state) => state.currentStarId)

  const instancedRef = useRef<InstancedMesh>(null)
  const currentRef = useRef<Mesh>(null)
  const tempMatrix = useRef(new Matrix4())
  const tempPosition = useRef(new Vector3())
  const unitScale = useRef(new Vector3(1, 1, 1))

  const geometry = useMemo(() => new RingGeometry(RING_INNER, RING_OUTER, RING_SEGMENTS), [])
  const visitedMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        color: '#3f78c2',
        transparent: true,
        opacity: 0.55,
        side: DoubleSide,
        depthWrite: false,
      }),
    [],
  )

  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => visitedMaterial.dispose(), [visitedMaterial])

  const { visitedPositions, currentPosition } = useMemo(() => {
    const positions: [number, number, number][] = []
    let current: [number, number, number] | null = null

    for (const sector of sectors) {
      for (const star of sector.stars) {
        if (!visitedStars.has(star.id)) continue
        const worldPosition: [number, number, number] = [
          star.sector.sx * SECTOR_SIZE + star.localPos[0],
          star.sector.sy * SECTOR_SIZE + star.localPos[1],
          star.sector.sz * SECTOR_SIZE + star.localPos[2],
        ]
        if (star.id === currentStarId) {
          current = worldPosition
        } else if (positions.length < MAX_VISIBLE_MARKERS) {
          positions.push(worldPosition)
        }
      }
    }
    return { visitedPositions: positions, currentPosition: current }
  }, [sectors, visitedStars, currentStarId])

  useFrame((state) => {
    const instanced = instancedRef.current
    if (instanced != null) {
      instanced.count = visitedPositions.length
      for (let index = 0; index < visitedPositions.length; index++) {
        const position = visitedPositions[index]
        if (position == null) continue
        tempPosition.current.set(position[0], position[1], position[2])
        tempMatrix.current.compose(tempPosition.current, state.camera.quaternion, unitScale.current)
        instanced.setMatrixAt(index, tempMatrix.current)
      }
      instanced.instanceMatrix.needsUpdate = true
    }

    currentRef.current?.quaternion.copy(state.camera.quaternion)
  })

  return (
    <>
      <instancedMesh
        ref={instancedRef}
        args={[geometry, visitedMaterial, MAX_VISIBLE_MARKERS]}
        frustumCulled={false}
      />
      {currentPosition != null ? (
        <mesh ref={currentRef} position={currentPosition}>
          <ringGeometry args={[RING_INNER, RING_OUTER, RING_SEGMENTS]} />
          <meshBasicMaterial
            color="#7c5cff"
            transparent
            opacity={0.95}
            side={DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ) : null}
    </>
  )
}
