import { useMemo } from 'react'

import { starWorldPosition } from '@/engine/galaxy/position'
import { QUALITY_PRESETS } from '@/quality/presets'
import { CurrentStarBeacon } from '@/scenes/galaxy/CurrentStarBeacon'
import { GalaxyNebula } from '@/scenes/galaxy/GalaxyNebula'
import { GalaxyStarField } from '@/scenes/galaxy/GalaxyStarField'
import { JourneyPath } from '@/scenes/galaxy/JourneyPath'
import { SelectedStarMarker } from '@/scenes/galaxy/SelectedStarMarker'
import { ShipCameraRig } from '@/scenes/galaxy/ShipCameraRig'
import { ShipViewGalaxyGlow } from '@/scenes/galaxy/ShipViewGalaxyGlow'
import { SpaceshipModel } from '@/scenes/galaxy/SpaceshipModel'
import { StarCalloutProjector } from '@/scenes/galaxy/StarCalloutProjector'
import { useGalaxyStars } from '@/scenes/galaxy/useGalaxyStars'
import { useStarPicking } from '@/scenes/galaxy/useStarPicking'
import { CameraRig } from '@/scenes/shared/CameraRig'
import { DecorativeStarfield } from '@/scenes/shared/DecorativeStarfield'
import { DistantGalaxies } from '@/scenes/shared/DistantGalaxies'
import { CurrentSystem } from '@/scenes/system/CurrentSystem'
import { useGameStore } from '@/store'

const GALAXY_CENTER: readonly [number, number, number] = [0, 0, 0]

/**
 * 두 시점 (결정 34·36·41):
 * - 우주선 뷰(ship): 1인칭 — 회전축이 카메라 자신 (ShipCameraRig, 현재 별 옆 정박).
 * - 퍼스펙티브 뷰(perspective): 3인칭 — 궤도 중심 = 우주선(현재 별). 우주선 모델 주위를
 *   공전하며 줌아웃으로 은하를 조망하고 항행 목적지를 고른다 (결정 41-e).
 * 뷰 전환은 리그 교체 = 즉시 컷 — 트랜지션 없음. 워프 중엔 WarpCameraRig가 전담한다.
 */
/** 퍼스펙티브 최소 거리 — 우주선 모델(~4 유닛)에 근접하는 한계. */
const PERSPECTIVE_MIN_DISTANCE = 24
/** 퍼스펙티브 진입 거리 — 우주선이 한눈에 잡히는 근접 오프셋(거리 ≈ 47). */
const PERSPECTIVE_OFFSET_Y = 22
const PERSPECTIVE_OFFSET_Z = 42
/** 은하 전체(지름 9,600 유닛)가 화면에 들어오는 줌아웃 한계 — 나선 형상 조망용. */
const GALAXY_MAX_ZOOM_OUT = 6_000
/**
 * 우주선 뷰 하늘 천구 반경 — 정박 별에서 가장 먼 은하 별(≤9,600)보다 바깥이라
 * 장식이 항상 배경으로 읽히고, 정박 오프셋(≤4,800)을 더해도 far(30,000) 안이다.
 */
const SHIP_SKY_RADIUS = 12_000

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
  const isPerspectiveView = scene.kind === 'galaxy' && scene.view === 'perspective'
  const isShipView = scene.kind === 'galaxy' && scene.view === 'ship'
  // 현재 항성계(별 구체)가 보이는 상태 — 우주선 뷰 + 워프(도착 별로 크로스페이드). 결정 41-c.
  const isSystemVisible = isShipView || scene.kind === 'warping'

  const shipFocus = useMemo(
    () => starWorldPosition(seed, anchorStarId) ?? GALAXY_CENTER,
    [seed, anchorStarId],
  )

  const stars = useGalaxyStars()
  useStarPicking(stars)

  return (
    <>
      <color attach="background" args={['#05060f']} />
      {/* 뷰별 카메라 리그 — 워프 중엔 어느 쪽도 마운트하지 않는다 (WarpCameraRig 전담) */}
      {isPerspectiveView ? (
        <CameraRig
          focus={shipFocus}
          minDistance={PERSPECTIVE_MIN_DISTANCE}
          maxDistance={GALAXY_MAX_ZOOM_OUT}
          offsetY={PERSPECTIVE_OFFSET_Y}
          offsetZ={PERSPECTIVE_OFFSET_Z}
        />
      ) : null}
      {isShipView ? <ShipCameraRig anchor={shipFocus} /> : null}
      {/* 장식 배경 (백로그 G-a-2) — 퍼스펙티브는 원거리 은하 빌보드, 우주선 뷰·워프는
          균일 별밭 + 은하 광원감(원반 밴드·코어 글로우, 백로그 G-b-6)이 하늘을 채운다 */}
      {isPerspectiveView ? (
        <DistantGalaxies />
      ) : (
        <>
          <DecorativeStarfield radius={SHIP_SKY_RADIUS} center={shipFocus} />
          <ShipViewGalaxyGlow anchor={shipFocus} />
        </>
      )}
      {isPerspectiveView ? <GalaxyNebula /> : null}
      <GalaxyStarField
        stars={stars}
        maxPointSize={preset.maxPointSize}
        visitedStars={visitedStars}
        currentStarId={currentStarId}
        isSystemVisible={isSystemVisible}
      />
      {/* 현재 항성계 — 우주선 뷰 + 워프(도착 별로 자연 확대) 시 별 구체를 은하 좌표에
          직접 렌더. 행성은 우주선 뷰에서만 (워프 중엔 별만, 결정 41) */}
      {isSystemVisible ? <CurrentSystem /> : null}
      {/* 퍼스펙티브 = 우주선 모델이 "여기"(현재 위치 = 우주선)를 대신 표지한다 (결정 41-e) */}
      {isPerspectiveView ? <SpaceshipModel /> : null}
      {/* 정보 레이어 — 여정은 퍼스펙티브 전용, 비콘은 워프 중 도착 지점 표지 */}
      {isPerspectiveView ? <JourneyPath /> : null}
      {scene.kind === 'warping' ? <CurrentStarBeacon /> : null}
      <SelectedStarMarker />
      <StarCalloutProjector />
    </>
  )
}
