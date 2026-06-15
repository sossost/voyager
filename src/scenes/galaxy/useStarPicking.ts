import { useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { Vector3 } from 'three'

import type { Star } from '@/engine'
import { SECTOR_SIZE } from '@/engine'
import { currentBodies } from '@/scenes/system/currentBodies'
import { useGameStore } from '@/store'

/** 이 거리(px) 이상 움직였으면 드래그(카메라 조작)로 본다. */
const CLICK_SLOP_PX = 6
/** 마우스 히트 반경 — 터치는 2배 (모바일 AC, 결정 20). */
const BASE_HIT_RADIUS_PX = 14
/** 별 본체 히트 반경 = 화면상 구체 반경 × 이 배수 — 코로나 글로우 디스크까지 포함. */
const STAR_HIT_RADIUS_FACTOR = 2.4

const projected = new Vector3()
const bodyCenter = new Vector3()
const bodyEdge = new Vector3()
const cameraRight = new Vector3()

/**
 * 현재 항성계 별 본체 중 클릭에 가장 가까운 것 — 화면공간, 본체의 *화면상 반경*까지 히트로
 * 본다(큰 구체는 디스크 전체 클릭 가능, 작은 퍼스펙티브 별은 하한 반경). currentBodies는
 * CurrentSystem이 뷰 스케일까지 반영해 게시하므로 우주선·퍼스펙티브 모두에서 정확하다.
 * 반환: 본체 인덱스(0=주성) 또는 -1.
 */
function pickNearestBody(
  pointer: { clientX: number; clientY: number },
  rect: DOMRect,
  camera: Parameters<Vector3['project']>[0],
  hitFloorPx: number,
): number {
  let nearest = -1
  let nearestDistance = Number.POSITIVE_INFINITY
  cameraRight.set(1, 0, 0).applyQuaternion(camera.quaternion)

  for (let i = 0; i < currentBodies.count; i++) {
    const world = currentBodies.positions[i]
    if (world == null) continue
    bodyCenter.copy(world).project(camera)
    if (bodyCenter.z > 1 || bodyCenter.z < -1) continue
    const cx = rect.left + ((bodyCenter.x + 1) / 2) * rect.width
    const cy = rect.top + ((1 - bodyCenter.y) / 2) * rect.height

    // 화면상 반경 = 중심과 (중심 + 카메라우측·월드반경)의 화면 거리.
    bodyEdge
      .copy(cameraRight)
      .multiplyScalar(currentBodies.radii[i] ?? 0)
      .add(world)
      .project(camera)
    const ex = rect.left + ((bodyEdge.x + 1) / 2) * rect.width
    const ey = rect.top + ((1 - bodyEdge.y) / 2) * rect.height
    const screenRadius = Math.hypot(ex - cx, ey - cy)

    // 코로나 글로우까지 포함해 보이는 별 디스크 전체를 클릭 가능하게 — 구체 반경의 배수.
    const hitRadius = Math.max(hitFloorPx, screenRadius * STAR_HIT_RADIUS_FACTOR)
    const distance = Math.hypot(cx - pointer.clientX, cy - pointer.clientY)
    if (distance < hitRadius && distance < nearestDistance) {
      nearestDistance = distance
      nearest = i
    }
  }
  return nearest
}

function pickNearestStar(
  pointer: { clientX: number; clientY: number },
  rect: DOMRect,
  camera: Parameters<Vector3['project']>[0],
  stars: readonly Star[],
  hitRadiusPx: number,
): Star | null {
  let nearest: Star | null = null
  let nearestDistance = hitRadiusPx

  for (const star of stars) {
    projected.set(
      star.sector.sx * SECTOR_SIZE + star.localPos[0],
      star.sector.sy * SECTOR_SIZE + star.localPos[1],
      star.sector.sz * SECTOR_SIZE + star.localPos[2],
    )
    projected.project(camera)
    // NDC 밖(뒤쪽 포함)은 후보가 아니다
    if (projected.z > 1 || projected.z < -1) continue

    const screenX = rect.left + ((projected.x + 1) / 2) * rect.width
    const screenY = rect.top + ((1 - projected.y) / 2) * rect.height
    const distance = Math.hypot(screenX - pointer.clientX, screenY - pointer.clientY)

    if (distance < nearestDistance) {
      nearestDistance = distance
      nearest = star
    }
  }
  return nearest
}

/**
 * 화면공간 최근접 별 피킹 — click/tap 시점에만 O(n) 수행 (결정 20).
 * n = 은하 전체 별(약 7천, 결정 22) — 클릭 1회당 수 ms로 충분히 싸다.
 * 화면에 보이는 모든 별이 후보이므로 '보이는 것 = 클릭 가능한 것'이 항상 성립한다.
 */
export function useStarPicking(stars: readonly Star[]) {
  const gl = useThree((state) => state.gl)
  const camera = useThree((state) => state.camera)
  const starsRef = useRef(stars)
  starsRef.current = stars

  useEffect(() => {
    const element = gl.domElement
    let isPointerDown = false
    let downX = 0
    let downY = 0

    const handlePointerDown = (event: PointerEvent) => {
      isPointerDown = true
      downX = event.clientX
      downY = event.clientY
    }

    const handlePointerUp = (event: PointerEvent) => {
      if (!isPointerDown) return
      isPointerDown = false

      const { scene, selectStar } = useGameStore.getState()
      if (scene.kind !== 'galaxy') return

      const dragDistance = Math.hypot(event.clientX - downX, event.clientY - downY)
      if (dragDistance > CLICK_SLOP_PX) return

      const rect = element.getBoundingClientRect()
      const hitRadius = event.pointerType === 'touch' ? BASE_HIT_RADIUS_PX * 2 : BASE_HIT_RADIUS_PX

      // 현재 항성계 본체 우선 — 다중성계는 본체별 선택, 큰 구체는 디스크 전체가 클릭 가능.
      if (currentBodies.starId != null && currentBodies.count >= 1) {
        const bodyIndex = pickNearestBody(event, rect, camera, hitRadius)
        if (bodyIndex >= 0) {
          selectStar(currentBodies.starId, bodyIndex)
          return
        }
      }

      // 그 외 — 카탈로그 별(포인트 스프라이트) 피킹.
      const star = pickNearestStar(event, rect, camera, starsRef.current, hitRadius)
      selectStar(star?.id ?? null)
    }

    element.addEventListener('pointerdown', handlePointerDown)
    element.addEventListener('pointerup', handlePointerUp)
    return () => {
      element.removeEventListener('pointerdown', handlePointerDown)
      element.removeEventListener('pointerup', handlePointerUp)
    }
  }, [gl, camera])
}
