import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  DoubleSide,
  type InstancedMesh,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  RingGeometry,
  Vector3,
} from 'three'

import type { Star } from '@/engine'
import { starWorldPosition } from '@/engine/galaxy/position'
import { useGameStore } from '@/store'

/**
 * 블랙홀 맵 마커 (결정 10·11) — 블랙홀은 거의 검은 점이라 별밭에서 안 보인다.
 * 각 블랙홀 위치에 화면 고정 크기의 가산 링을 띄워 항법상 찾을 수 있게 한다.
 *
 * 현재 별은 제외한다 — 그건 CurrentSystem이 강착원반 본체로 근접 렌더하므로(줌게이팅
 * 핸드오프). 나머지(원거리) 블랙홀만 링으로 표시한다. 1 InstancedMesh = 1 draw call,
 * 매 프레임 빌보드+화면 고정 스케일. 연속 값은 ref+useFrame만 (철칙 6).
 */

/** 블랙홀 링 색 — 강착 글로우를 연상시키는 따뜻한 호박빛(비콘 amber·보라 선택 링과 갈린다). */
const RING_COLOR = '#ff9a4d'
const RING_SCREEN_RADIUS_PX = 11
const MIN_WORLD_SCALE = 1.4
const FALLBACK_FOV_DEGREES = 60
const RING_SEGMENTS = 40
/** 표시 상한 — 로드된 영역에 블랙홀이 폭증해도 draw 비용을 막는다(현실적으론 수개~수십개). */
const MAX_RINGS = 96

interface BlackHoleMapRingsProps {
  readonly stars: readonly Star[]
}

export function BlackHoleMapRings({ stars }: BlackHoleMapRingsProps) {
  const seed = useGameStore((state) => state.seed)
  const currentStarId = useGameStore((state) => state.currentStarId)

  const positions = useMemo(() => {
    const result: Vector3[] = []
    for (const star of stars) {
      if (star.kind !== 'black_hole' || star.id === currentStarId) continue
      const world = starWorldPosition(seed, star.id)
      if (world == null) continue
      result.push(new Vector3(world[0], world[1], world[2]))
      if (result.length >= MAX_RINGS) break
    }
    return result
  }, [stars, seed, currentStarId])

  const geometry = useMemo(() => new RingGeometry(0.72, 1.0, RING_SEGMENTS), [])
  const material = useMemo(
    () =>
      new MeshBasicMaterial({
        color: RING_COLOR,
        transparent: true,
        opacity: 0.85,
        side: DoubleSide,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [],
  )

  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])

  const meshRef = useRef<InstancedMesh>(null)
  const dummy = useMemo(() => new Object3D(), [])

  useFrame((state) => {
    const mesh = meshRef.current
    if (mesh == null || positions.length === 0) return
    const camera = state.camera
    const fov = camera instanceof PerspectiveCamera ? camera.fov : FALLBACK_FOV_DEGREES
    const tanHalfFov = Math.tan((fov * Math.PI) / 360)
    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i] as Vector3
      const distance = camera.position.distanceTo(pos)
      // 화면 고정 크기 — 거리에서 1px의 월드 길이를 역산 (CurrentStarBeacon과 동일).
      const worldPerPixel = (2 * distance * tanHalfFov) / state.size.height
      const scale = Math.max(RING_SCREEN_RADIUS_PX * worldPerPixel, MIN_WORLD_SCALE)
      dummy.position.copy(pos)
      dummy.quaternion.copy(camera.quaternion)
      dummy.scale.setScalar(scale)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.count = positions.length
    mesh.instanceMatrix.needsUpdate = true
  })

  if (positions.length === 0) return null

  return (
    <instancedMesh
      key={positions.length}
      ref={meshRef}
      args={[geometry, material, positions.length]}
    />
  )
}
