import { useMemo } from 'react'

import { starWorldPosition } from '@/engine/galaxy/position'
import { QUALITY_PRESETS } from '@/quality/presets'
import { GalaxyNebula } from '@/scenes/galaxy/GalaxyNebula'
import { GalaxyStarField } from '@/scenes/galaxy/GalaxyStarField'
import { SelectedStarMarker } from '@/scenes/galaxy/SelectedStarMarker'
import { useGalaxyStars } from '@/scenes/galaxy/useGalaxyStars'
import { useStarPicking } from '@/scenes/galaxy/useStarPicking'
import { VisitedStarMarkers } from '@/scenes/galaxy/VisitedStarMarkers'
import { CameraRig } from '@/scenes/shared/CameraRig'
import { DistantGalaxies } from '@/scenes/shared/DistantGalaxies'
import { useGameStore } from '@/store'

const GALAXY_CENTER: readonly [number, number, number] = [0, 0, 0]
/** 은하 전체(지름 9,600 유닛)가 화면에 들어오는 줌아웃 한계 — 나선 형상 조망용. */
const GALAXY_MAX_ZOOM_OUT = 6_000

export function GalaxyScene() {
  const seed = useGameStore((state) => state.seed)
  const currentStarId = useGameStore((state) => state.currentStarId)
  const scene = useGameStore((state) => state.scene)
  const qualityTier = useGameStore((state) => state.qualityTier)
  const preset = QUALITY_PRESETS[qualityTier]

  // warpTo가 currentStarId를 즉시 목적지로 바꾸므로(결정 16: 저장 선행),
  // 워프 중 카메라 앵커는 출발 별(from)에 둔다 — 연출은 현 위치에서 시작해야 한다
  const anchorStarId = scene.kind === 'warping' ? scene.from : currentStarId
  const focus = useMemo(
    () => starWorldPosition(seed, anchorStarId) ?? GALAXY_CENTER,
    [seed, anchorStarId],
  )

  const stars = useGalaxyStars()
  useStarPicking(stars)

  return (
    <>
      <color attach="background" args={['#05060f']} />
      <CameraRig focus={focus} maxDistance={GALAXY_MAX_ZOOM_OUT} />
      <DistantGalaxies />
      <GalaxyNebula />
      <GalaxyStarField stars={stars} maxPointSize={preset.maxPointSize} />
      <VisitedStarMarkers />
      <SelectedStarMarker />
    </>
  )
}
