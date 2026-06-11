import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Mesh } from 'three'

/**
 * Phase 1 헬로 씬 — 렌더 루프/품질 게이트 검증용.
 * Phase 3에서 GalaxyScene으로 대체된다.
 */
export function HelloScene() {
  const meshRef = useRef<Mesh>(null)

  useFrame((_, delta) => {
    const mesh = meshRef.current
    if (mesh == null) return
    mesh.rotation.x += delta * 0.6
    mesh.rotation.y += delta * 0.9
  })

  return (
    <>
      <color attach="background" args={['#05060f']} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[3, 3, 5]} intensity={1.2} />
      <mesh ref={meshRef}>
        <boxGeometry args={[1.4, 1.4, 1.4]} />
        <meshStandardMaterial color="#7c5cff" />
      </mesh>
    </>
  )
}
