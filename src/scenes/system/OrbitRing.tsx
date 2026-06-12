import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import type { LineBasicMaterial, LineLoop } from 'three'
import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three'

import { systemFadeOpacity } from '@/scenes/system/starCrossfade'

const ORBIT_SEGMENTS = 96
const FULL_TURN = Math.PI * 2
const RING_BASE_OPACITY = 0.7

interface OrbitRingProps {
  readonly radius: number
}

/** 행성 궤도 라인 — 시각 연출 전용이라 초월함수 사용 가능 (결정 14).
 *  카메라 거리에 따라 불투명도를 0→0.7로 부드럽게 페이드인해 팝인 이질감을 제거한다 (백로그 H-3). */
export function OrbitRing({ radius }: OrbitRingProps) {
  const loopRef = useRef<LineLoop>(null)
  const matRef = useRef<LineBasicMaterial>(null)
  const scratchWorld = useMemo(() => new Vector3(), [])

  const geometry = useMemo(() => {
    const positions = new Float32Array(ORBIT_SEGMENTS * 3)
    for (let i = 0; i < ORBIT_SEGMENTS; i++) {
      const angle = (i / ORBIT_SEGMENTS) * FULL_TURN
      positions[i * 3] = Math.cos(angle) * radius
      positions[i * 3 + 1] = 0
      positions[i * 3 + 2] = Math.sin(angle) * radius
    }
    const built = new BufferGeometry()
    built.setAttribute('position', new Float32BufferAttribute(positions, 3))
    return built
  }, [radius])

  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame((state) => {
    const loop = loopRef.current
    const mat = matRef.current
    if (loop == null || mat == null) return
    const dist = state.camera.position.distanceTo(loop.getWorldPosition(scratchWorld))
    mat.opacity = RING_BASE_OPACITY * systemFadeOpacity(dist)
  })

  return (
    <lineLoop ref={loopRef} geometry={geometry}>
      <lineBasicMaterial ref={matRef} color="#2a2f4a" transparent opacity={0} />
    </lineLoop>
  )
}
