import { useMemo } from 'react'

import { starWorldPosition } from '@/engine/galaxy/position'
import { QUALITY_PRESETS } from '@/quality/presets'
import { CurrentStarBeacon } from '@/scenes/galaxy/CurrentStarBeacon'
import { GalaxyNebula } from '@/scenes/galaxy/GalaxyNebula'
import { GalaxyStarField } from '@/scenes/galaxy/GalaxyStarField'
import { JourneyPath } from '@/scenes/galaxy/JourneyPath'
import { SelectedStarMarker } from '@/scenes/galaxy/SelectedStarMarker'
import { useGalaxyStars } from '@/scenes/galaxy/useGalaxyStars'
import { useStarPicking } from '@/scenes/galaxy/useStarPicking'
import { CameraRig } from '@/scenes/shared/CameraRig'
import { DistantGalaxies } from '@/scenes/shared/DistantGalaxies'
import { useGameStore } from '@/store'

const GALAXY_CENTER: readonly [number, number, number] = [0, 0, 0]

/**
 * 두 시점 (결정 34):
 * - 우주선 뷰(ship): 궤도 중심 = 현재 별. 시뮬레이션의 기본 시점 — 이웃 몇 섹터까지만 조망.
 * - 은하 전도(map): 궤도 중심 = 은하 중심 고정. 항행 목적지를 고르는 전략 지도.
 * 뷰 전환은 CameraRig의 초점 스냅으로 즉시 컷된다 — 트랜지션 없음.
 */
const SHIP_MIN_DISTANCE = 15
const SHIP_MAX_DISTANCE = 600
const MAP_MIN_DISTANCE = 200
/** 은하 전체(지름 9,600 유닛)가 화면에 들어오는 줌아웃 한계 — 나선 형상 조망용. */
const GALAXY_MAX_ZOOM_OUT = 6_000

export function GalaxyScene() {
  const seed = useGameStore((state) => state.seed)
  const currentStarId = useGameStore((state) => state.currentStarId)
  const scene = useGameStore((state) => state.scene)
  const visitedStars = useGameStore((state) => state.visitedStars)
  const qualityTier = useGameStore((state) => state.qualityTier)
  const preset = QUALITY_PRESETS[qualityTier]

  // warpTo가 currentStarId를 즉시 목적지로 바꾸므로(결정 16: 저장 선행),
  // 워프 중 카메라 앵커는 출발 별(from)에 둔다 — 연출은 현 위치에서 시작해야 한다
  const anchorStarId = scene.kind === 'warping' ? scene.from : currentStarId
  const isMapView = scene.kind === 'galaxy' && scene.view === 'map'

  const shipFocus = useMemo(
    () => starWorldPosition(seed, anchorStarId) ?? GALAXY_CENTER,
    [seed, anchorStarId],
  )
  const focus = isMapView ? GALAXY_CENTER : shipFocus

  const stars = useGalaxyStars()
  useStarPicking(stars)

  return (
    <>
      <color attach="background" args={['#05060f']} />
      <CameraRig
        focus={focus}
        minDistance={isMapView ? MAP_MIN_DISTANCE : SHIP_MIN_DISTANCE}
        maxDistance={isMapView ? GALAXY_MAX_ZOOM_OUT : SHIP_MAX_DISTANCE}
      />
      <DistantGalaxies />
      <GalaxyNebula />
      <GalaxyStarField
        stars={stars}
        maxPointSize={preset.maxPointSize}
        visitedStars={visitedStars}
      />
      {/* 지도 정보 레이어 — 여정은 지도 전용, 비콘은 지도의 "여기" + 워프 중 목적지 표지 */}
      {isMapView ? <JourneyPath /> : null}
      {isMapView || scene.kind === 'warping' ? <CurrentStarBeacon /> : null}
      <SelectedStarMarker />
    </>
  )
}
