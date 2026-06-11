import { useMemo } from 'react'

import { SECTOR_SIZE } from '@/engine'
import { starWorldPosition } from '@/engine/galaxy/position'
import { QUALITY_PRESETS } from '@/quality/presets'
import { GalaxyBackdrop } from '@/scenes/galaxy/GalaxyBackdrop'
import { SectorPoints } from '@/scenes/galaxy/SectorPoints'
import { SelectedStarMarker } from '@/scenes/galaxy/SelectedStarMarker'
import { useStarPicking } from '@/scenes/galaxy/useStarPicking'
import { useVisibleSectors } from '@/scenes/galaxy/useVisibleSectors'
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

  // 로드 큐브에 내접하는 구 반경 — 이 밖(큐브 모서리)은 페이드아웃되어 구형으로 읽힌다
  const fadeOuter = (preset.sectorLoadRadius + 0.5) * SECTOR_SIZE

  const sectors = useVisibleSectors()
  useStarPicking(sectors, fadeOuter)

  return (
    <>
      <color attach="background" args={['#05060f']} />
      <CameraRig focus={focus} maxDistance={GALAXY_MAX_ZOOM_OUT} />
      <GalaxyBackdrop />
      {sectors.map((sector) => (
        <SectorPoints
          key={sector.key}
          sector={sector}
          maxPointSize={preset.maxPointSize}
          fadeOuter={fadeOuter}
        />
      ))}
      <VisitedStarMarkers sectors={sectors} />
      <SelectedStarMarker />
    </>
  )
}
