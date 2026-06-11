import { useMemo } from 'react'

import { starWorldPosition } from '@/engine/galaxy/position'
import { QUALITY_PRESETS } from '@/quality/presets'
import { GalaxyBackdrop } from '@/scenes/galaxy/GalaxyBackdrop'
import { SectorPoints } from '@/scenes/galaxy/SectorPoints'
import { SelectedStarMarker } from '@/scenes/galaxy/SelectedStarMarker'
import { useStarPicking } from '@/scenes/galaxy/useStarPicking'
import { useVisibleSectors } from '@/scenes/galaxy/useVisibleSectors'
import { CameraRig } from '@/scenes/shared/CameraRig'
import { useGameStore } from '@/store'

const GALAXY_CENTER: readonly [number, number, number] = [0, 0, 0]

export function GalaxyScene() {
  const seed = useGameStore((state) => state.seed)
  const currentStarId = useGameStore((state) => state.currentStarId)
  const qualityTier = useGameStore((state) => state.qualityTier)
  const preset = QUALITY_PRESETS[qualityTier]

  const focus = useMemo(
    () => starWorldPosition(seed, currentStarId) ?? GALAXY_CENTER,
    [seed, currentStarId],
  )

  const sectors = useVisibleSectors()
  useStarPicking(sectors)

  return (
    <>
      <color attach="background" args={['#05060f']} />
      <CameraRig focus={focus} />
      <GalaxyBackdrop />
      {sectors.map((sector) => (
        <SectorPoints key={sector.key} sector={sector} maxPointSize={preset.maxPointSize} />
      ))}
      <SelectedStarMarker />
    </>
  )
}
