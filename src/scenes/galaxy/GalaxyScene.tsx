import { useMemo } from "react";

import { starById } from "@/engine";
import { starWorldPosition } from "@/engine/galaxy/position";
import { QUALITY_PRESETS } from "@/quality/presets";
import { CurrentStarArrowProjector } from "@/scenes/galaxy/CurrentStarArrowProjector";
import { CurrentStarBeacon } from "@/scenes/galaxy/CurrentStarBeacon";
import { GalaxyNebula } from "@/scenes/galaxy/GalaxyNebula";
import { GalaxyStarField } from "@/scenes/galaxy/GalaxyStarField";
import { JourneyPath } from "@/scenes/galaxy/JourneyPath";
import { ScannedExoticMarkers } from "@/scenes/galaxy/ScannedExoticMarkers";
import { ShipCameraRig } from "@/scenes/galaxy/ShipCameraRig";
import { ShipViewGalaxyGlow } from "@/scenes/galaxy/ShipViewGalaxyGlow";
import { SpaceshipModel } from "@/scenes/galaxy/SpaceshipModel";
import { StarCalloutProjector } from "@/scenes/galaxy/StarCalloutProjector";
import { useGalaxyStars } from "@/scenes/galaxy/useGalaxyStars";
import { useStarPicking } from "@/scenes/galaxy/useStarPicking";
import { CameraRig } from "@/scenes/shared/CameraRig";
import { DecorativeStarfield } from "@/scenes/shared/DecorativeStarfield";
import { DistantGalaxies } from "@/scenes/shared/DistantGalaxies";
import { LensEnvironmentBaker } from "@/scenes/shared/lensEnvironment";
import { CurrentSystem } from "@/scenes/system/CurrentSystem";
import { useGameStore } from "@/store";

const GALAXY_CENTER: readonly [number, number, number] = [0, 0, 0];

/**
 * 두 시점 (결정 34·36·41):
 * - 우주선 뷰(ship): 1인칭 — 회전축이 카메라 자신 (ShipCameraRig, 현재 별 옆 정박).
 * - 퍼스펙티브 뷰(perspective): 3인칭 — 궤도 중심 = 우주선(현재 별). 우주선 모델 주위를
 *   공전하며 줌아웃으로 은하를 조망하고 항행 목적지를 고른다 (결정 41-e).
 * 뷰 전환은 리그 교체 = 즉시 컷 — 트랜지션 없음. 워프 중엔 WarpCameraRig가 전담한다.
 */
/** 퍼스펙티브 최소 거리 — 우주선·항성에 근접하는 한계. */
const PERSPECTIVE_MIN_DISTANCE = 4;
/**
 * 퍼스펙티브 진입 거리 — 1/8 스케일 시스템(Neptune ≈5 world units)이 한눈에 들어오는 오프셋.
 * 거리 ≈ 16유닛 → Neptune이 시야각 ~17° 차지해 시스템이 적당히 크게 보인다.
 */
const PERSPECTIVE_OFFSET_Y = 5;
const PERSPECTIVE_OFFSET_Z = 15;
/** 은하 전체(지름 9,600 유닛)가 화면에 들어오는 줌아웃 한계 — 나선 형상 조망용. */
const GALAXY_MAX_ZOOM_OUT = 6_000;
/**
 * 우주선 뷰 하늘 천구 반경 — 정박 별에서 가장 먼 은하 별(≤9,600)보다 바깥이라
 * 장식이 항상 배경으로 읽히고, 정박 오프셋(≤4,800)을 더해도 far(30,000) 안이다.
 */
const SHIP_SKY_RADIUS = 12_000;
/** 함교 뷰 기본 시선 고도(도) — 항성계 궤도면을 내려다보는 각도. 블랙홀계만 낮게(옆에서) 본다. */
const SHIP_SYSTEM_ELEVATION_DEG = 28;

export function GalaxyScene() {
  const seed = useGameStore((state) => state.seed);
  const currentStarId = useGameStore((state) => state.currentStarId);
  const scene = useGameStore((state) => state.scene);
  const visitedStars = useGameStore((state) => state.visitedStars);
  const qualityTier = useGameStore((state) => state.qualityTier);
  const preset = QUALITY_PRESETS[qualityTier];

  // warpTo가 currentStarId를 즉시 목적지로 바꾸므로(결정 16: 저장 선행),
  // 워프 중 카메라 앵커는 출발 별(from)에 둔다 — 연출은 현 위치에서 시작해야 한다
  const anchorStarId = scene.kind === "warping" ? scene.from : currentStarId;
  const isPerspectiveView =
    scene.kind === "galaxy" && scene.view === "perspective";
  const isShipView = scene.kind === "galaxy" && scene.view === "ship";

  const shipFocus = useMemo(
    () => starWorldPosition(seed, anchorStarId) ?? GALAXY_CENTER,
    [seed, anchorStarId]
  );

  // 블랙홀에 주차 중이면 현재 별 위치의 UI(우주선·여정경로)를 숨긴다 — BH 측지선 렌즈가
  // 그 자리를 덮어 스크린공간 샘플로 끌려들면(아인슈타인 링으로 동심 복제) 사건지평선 안에
  // 우주선/마커가 비쳐 보인다(사용자 지적). BH 자체가 "여기" 표지라 UI도 불필요.
  const currentIsBlackHole = useMemo(
    () => starById(seed, currentStarId)?.kind === "black_hole",
    [seed, currentStarId]
  );

  const stars = useGalaxyStars();
  useStarPicking(stars);

  return (
    <>
      <color attach="background" args={["#05060f"]} />
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
      {isShipView ? (
        <ShipCameraRig
          anchor={shipFocus}
          elevationDeg={currentIsBlackHole ? 3 : SHIP_SYSTEM_ELEVATION_DEG}
        />
      ) : null}
      {/* 장식 배경 (백로그 G-a-2) — 퍼스펙티브는 원거리 은하 빌보드, 우주선 뷰·워프는
          균일 별밭. 은하 광원감(원반 밴드·코어 글로우, 백로그 G-b-6)은 모든 뷰에 마운트하되
          밴드는 카메라-별 거리로 페이드한다 — 항법뷰 근거리에선 함교와 같은 황색 은하수 배경이
          보이고(사용자 지적), 줌아웃해 은하를 조망하면 걷혀 부자연스럽지 않다(사용자 지적). */}
      {isPerspectiveView ? (
        <DistantGalaxies />
      ) : (
        <DecorativeStarfield radius={SHIP_SKY_RADIUS} center={shipFocus} />
      )}
      <ShipViewGalaxyGlow anchor={shipFocus} />
      {isPerspectiveView ? <GalaxyNebula /> : null}
      <GalaxyStarField
        stars={stars}
        maxPointSize={preset.maxPointSize}
        visitedStars={visitedStars}
        currentStarId={anchorStarId}
      />
      {/* 블랙홀 findability — 함교 "탐색"으로 스캔한 블랙홀을 항법뷰에서만 홀로 마커로 표시한다
          (exotic-scan, 제거된 주황 링 대체). 함교 1인칭엔 지도 마커를 띄우지 않는다 (결정 4). */}
      {isPerspectiveView ? <ScannedExoticMarkers stars={stars} /> : null}
      {/* 현재 항성계 — 모든 뷰(우주선·퍼스펙티브)와 워프에서 별 구체를 은하 좌표에 직접
          렌더한다. 크로스페이드가 거리에 따라 포인트↔구체를 핸드오프하므로 퍼스펙티브에서
          줌아웃하면 자연히 점으로 돌아간다. 행성은 워프 중엔 베이크하지 않는다 (결정 41) */}
      <CurrentSystem />
      {/* 블랙홀 렌즈 환경맵 — 원거리 배경(레이어 태그된 별밭·글로우·천구)만 큐브맵으로
          베이크해 레이마칭 탈출 광선이 방향 샘플한다 (스크린공간 배경 샘플의 구조적 한계 해소). */}
      <LensEnvironmentBaker
        anchor={shipFocus}
        active={currentIsBlackHole}
        bakeKey={`${anchorStarId}|${scene.kind === "galaxy" ? scene.view : "warp"}`}
      />
      {/* 퍼스펙티브 = 항성계 곁에 떠 있는 내 우주선을 3인칭으로 본다 (결정 41-e).
          블랙홀 주차 시엔 숨긴다 — 측지선 렌즈가 우주선을 사건지평선 안으로 끌어들이기 때문. */}
      {isPerspectiveView && !currentIsBlackHole ? <SpaceshipModel /> : null}
      {/* 정보 레이어 — 여정은 퍼스펙티브 전용, 비콘은 워프 중 도착 지점 표지 */}
      {isPerspectiveView && !currentIsBlackHole ? <JourneyPath /> : null}
      {scene.kind === "warping" ? <CurrentStarBeacon /> : null}
      <StarCalloutProjector />
      <CurrentStarArrowProjector />
    </>
  );
}
