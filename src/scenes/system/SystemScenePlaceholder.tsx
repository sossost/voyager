import { useMemo } from 'react'

import { starById } from '@/engine/galaxy/position'
import { SPECTRAL_RENDER } from '@/scenes/galaxy/spectral'
import { CameraRig } from '@/scenes/shared/CameraRig'
import { useGameStore } from '@/store'

const SYSTEM_ORIGIN: readonly [number, number, number] = [0, 0, 0]

/**
 * Phase 3 임시 태양계 씬 — 항성만 표시한다.
 * Phase 4에서 행성·궤도·워프가 있는 SystemScene으로 대체된다.
 */
export function SystemScenePlaceholder() {
  const seed = useGameStore((state) => state.seed)
  const scene = useGameStore((state) => state.scene)
  const currentStarId = useGameStore((state) => state.currentStarId)

  const starId = scene.kind === 'system' ? scene.starId : currentStarId
  const star = useMemo(() => starById(seed, starId), [seed, starId])
  const starColor = star == null ? '#ffffff' : SPECTRAL_RENDER[star.spectral].color

  return (
    <>
      <color attach="background" args={['#05060f']} />
      <CameraRig focus={SYSTEM_ORIGIN} minDistance={8} maxDistance={120} />
      <ambientLight intensity={0.3} />
      <mesh>
        <sphereGeometry args={[3, 48, 48]} />
        <meshBasicMaterial color={starColor} />
      </mesh>
      <pointLight position={[0, 0, 0]} intensity={120} color={starColor} />
    </>
  )
}
