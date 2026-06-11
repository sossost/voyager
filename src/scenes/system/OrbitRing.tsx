import { useEffect, useMemo } from 'react'
import { BufferGeometry, Float32BufferAttribute } from 'three'

const ORBIT_SEGMENTS = 96
const FULL_TURN = Math.PI * 2

interface OrbitRingProps {
  readonly radius: number
}

/** 행성 궤도 라인 — 시각 연출 전용이라 초월함수 사용 가능 (결정 14). */
export function OrbitRing({ radius }: OrbitRingProps) {
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

  return (
    <lineLoop geometry={geometry}>
      <lineBasicMaterial color="#2a2f4a" transparent opacity={0.7} />
    </lineLoop>
  )
}
