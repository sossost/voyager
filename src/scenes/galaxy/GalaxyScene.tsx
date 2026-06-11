import { useMemo } from 'react'

import { starWorldPosition } from '@/engine/galaxy/position'
import { QUALITY_PRESETS } from '@/quality/presets'
import { GalaxyBackdrop } from '@/scenes/galaxy/GalaxyBackdrop'
import { GalaxyStarField } from '@/scenes/galaxy/GalaxyStarField'
import { SelectedStarMarker } from '@/scenes/galaxy/SelectedStarMarker'
import { useGalaxyStars } from '@/scenes/galaxy/useGalaxyStars'
import { useStarPicking } from '@/scenes/galaxy/useStarPicking'
import { VisitedStarMarkers } from '@/scenes/galaxy/VisitedStarMarkers'
import { CameraRig } from '@/scenes/shared/CameraRig'
import { useGameStore } from '@/store'

const GALAXY_CENTER: readonly [number, number, number] = [0, 0, 0]
/** 은하 전체(지름 9,600 유닛)가 화면에 들어오는 줌아웃 한계 — 나선 형상 조망용. */
const GALAXY_MAX_ZOOM_OUT = 6_000

export function GalaxyScene() {
  const seed = useGameStore((state) => state.seed)
  const currentStarId = useGameStore((state) => state.currentStarId)
  const qualityTier = useGameStore((state) => state.qualityTier)
  const preset = QUALITY_PRESETS[qualityTier]

  const focus = useMemo(
    () => starWorldPosition(seed, currentStarId) ?? GALAXY_CENTER,
    [seed, currentStarId],
  )

  const stars = useGalaxyStars()
  useStarPicking(stars)

  return (
    <>
      <color attach="background" args={['#05060f']} />
      <CameraRig focus={focus} maxDistance={GALAXY_MAX_ZOOM_OUT} />
      <GalaxyBackdrop />
      <GalaxyStarField stars={stars} maxPointSize={preset.maxPointSize} />
      <VisitedStarMarkers />
      <SelectedStarMarker />
    </>
  )
}
