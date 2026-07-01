import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  type InstancedMesh,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  RingGeometry,
  Vector3,
} from 'three'

import type { Star } from '@/engine'
import { starWorldPosition } from '@/engine/galaxy/position'
import { usePrefersReducedMotion } from '@/scenes/shared/useReducedMotion'
import { useGameStore } from '@/store'

/**
 * 스캔된 희귀 천체 마커 (exotic-scan) — 스캔으로 드러낸 희귀 특이 천체(블랙홀·펄서, scannedStars)를
 * 항법뷰에서 홀로색 원형 링으로 표시한다. 블랙홀은 거의 검은 점이라 안 보이고 펄서도 항법 조망에선
 * 찾기 번거로우므로 이 마커가 위치를 짚어준다(제거된 주황 링 대체). 흔한 백색왜성·적색거성은 스캔
 * 대상이 아니다(색·크기로 이미 보임). 두 겹 구성: **항상 보이는 코어 링** + **주기적으로 퍼지며
 * 사라지는 핑 링**(소나 파동) — 레이더 접촉점.
 *
 * 현재 별은 제외한다 — CurrentSystem이 강착원반 본체로 근접 렌더한다. InstancedMesh 2개(코어·핑),
 * 매 프레임 빌보드 + 화면 고정 스케일 + 핑 확장/페이드. 연속 값은 ref+useFrame만 (철칙 6).
 * 항법(perspective)뷰에서만 마운트된다 (결정 4). reduced-motion이면 핑을 끄고 정적 코어만 둔다.
 */

/** 홀로색 — 엔진 청록. 제거된 amber 링·보라 선택 링과 갈린다. */
const MARKER_COLOR = '#7cf2e0'
const MARKER_SCREEN_RADIUS_PX = 13
const MIN_WORLD_SCALE = 1.6
const FALLBACK_FOV_DEGREES = 60
/** 표시 상한 — 스캔 범위가 넓어져도 draw 비용을 막는다(현실적으론 수개~수십개). */
const MAX_MARKERS = 96
const RING_SEGMENTS = 48
/** 소나 핑 1주기(초) — 링이 코어에서 바깥으로 퍼졌다 사라지는 시간. */
const PING_PERIOD_S = 1.7
/** 핑이 코어 대비 최대 몇 배까지 퍼지는가. */
const PING_MAX_SCALE = 2.8
const CORE_OPACITY = 0.85
const PING_OPACITY = 0.55

interface ScannedExoticMarkersProps {
  readonly stars: readonly Star[]
}

export function ScannedExoticMarkers({ stars }: ScannedExoticMarkersProps) {
  const seed = useGameStore((state) => state.seed)
  const currentStarId = useGameStore((state) => state.currentStarId)
  const scannedStars = useGameStore((state) => state.scannedStars)
  const reducedMotion = usePrefersReducedMotion()

  const positions = useMemo(() => {
    const result: Vector3[] = []
    for (const star of stars) {
      // scannedStars가 진실의 원천 — 스캔된 희귀 천체(블랙홀·펄서)만 담긴다. 현재 별은 본체로 렌더.
      if (star.id === currentStarId || !scannedStars.has(star.id)) continue
      const world = starWorldPosition(seed, star.id)
      if (world == null) continue
      result.push(new Vector3(world[0], world[1], world[2]))
      if (result.length >= MAX_MARKERS) break
    }
    return result
  }, [stars, seed, currentStarId, scannedStars])

  // 얇은 원형 링 — 코어·핑 공용. inner 0.9/outer 1.0 = 가는 테두리 (두께 0.1)
  const geometry = useMemo(() => new RingGeometry(0.9, 1.0, RING_SEGMENTS), [])
  const coreMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        color: MARKER_COLOR,
        transparent: true,
        opacity: CORE_OPACITY,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [],
  )
  const pingMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        color: MARKER_COLOR,
        transparent: true,
        opacity: PING_OPACITY,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [],
  )

  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => coreMaterial.dispose(), [coreMaterial])
  useEffect(() => () => pingMaterial.dispose(), [pingMaterial])

  const coreRef = useRef<InstancedMesh>(null)
  const pingRef = useRef<InstancedMesh>(null)
  const dummy = useMemo(() => new Object3D(), [])

  useFrame((state) => {
    if (positions.length === 0) return
    const camera = state.camera
    const fov = camera instanceof PerspectiveCamera ? camera.fov : FALLBACK_FOV_DEGREES
    const tanHalfFov = Math.tan((fov * Math.PI) / 360)

    // 핑 위상 — 0→1 반복. reduced-motion이면 정지(핑 메시 자체가 언마운트되지만 안전상 opacity도 0).
    const phase = reducedMotion ? 0 : (state.clock.elapsedTime % PING_PERIOD_S) / PING_PERIOD_S
    const pingScaleMul = 1 + phase * (PING_MAX_SCALE - 1)
    pingMaterial.opacity = reducedMotion ? 0 : PING_OPACITY * (1 - phase)

    const core = coreRef.current
    const ping = pingRef.current
    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i] as Vector3
      const distance = camera.position.distanceTo(pos)
      // 화면 고정 크기 — 거리에서 1px의 월드 길이를 역산 (CurrentStarBeacon과 동일).
      const worldPerPixel = (2 * distance * tanHalfFov) / state.size.height
      const base = Math.max(MARKER_SCREEN_RADIUS_PX * worldPerPixel, MIN_WORLD_SCALE)

      if (core != null) {
        dummy.position.copy(pos)
        dummy.quaternion.copy(camera.quaternion)
        dummy.scale.setScalar(base)
        dummy.updateMatrix()
        core.setMatrixAt(i, dummy.matrix)
      }
      if (ping != null) {
        dummy.position.copy(pos)
        dummy.quaternion.copy(camera.quaternion)
        dummy.scale.setScalar(base * pingScaleMul)
        dummy.updateMatrix()
        ping.setMatrixAt(i, dummy.matrix)
      }
    }
    if (core != null) {
      core.count = positions.length
      core.instanceMatrix.needsUpdate = true
    }
    if (ping != null) {
      ping.count = positions.length
      ping.instanceMatrix.needsUpdate = true
    }
  })

  if (positions.length === 0) return null

  return (
    <>
      <instancedMesh
        key={`core-${positions.length}`}
        ref={coreRef}
        args={[geometry, coreMaterial, positions.length]}
      />
      {reducedMotion === false ? (
        <instancedMesh
          key={`ping-${positions.length}`}
          ref={pingRef}
          args={[geometry, pingMaterial, positions.length]}
        />
      ) : null}
    </>
  )
}
