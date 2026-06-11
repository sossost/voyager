import { useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { Vector3 } from 'three'

import type { Star } from '@/engine'
import { SECTOR_SIZE } from '@/engine'
import type { LoadedSector } from '@/scenes/galaxy/useVisibleSectors'
import { useGameStore } from '@/store'

/** 이 거리(px) 이상 움직였으면 드래그(카메라 조작)로 본다. */
const CLICK_SLOP_PX = 6
/** 마우스 히트 반경 — 터치는 2배 (모바일 AC, 결정 20). */
const BASE_HIT_RADIUS_PX = 14

const projected = new Vector3()

function pickNearestStar(
  pointer: { clientX: number; clientY: number },
  rect: DOMRect,
  camera: Parameters<Vector3['project']>[0],
  sectors: readonly LoadedSector[],
  hitRadiusPx: number,
  fadeCenter: Vector3,
  fadeOuter: number,
): Star | null {
  let nearest: Star | null = null
  let nearestDistance = hitRadiusPx

  for (const sector of sectors) {
    for (const star of sector.stars) {
      projected.set(
        star.sector.sx * SECTOR_SIZE + star.localPos[0],
        star.sector.sy * SECTOR_SIZE + star.localPos[1],
        star.sector.sz * SECTOR_SIZE + star.localPos[2],
      )
      // 구형 페이드로 완전히 투명해진 별은 선택 불가 — 보이는 것만 탭할 수 있다
      if (projected.distanceTo(fadeCenter) > fadeOuter) continue
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
  }
  return nearest
}

/**
 * 화면공간 최근접 별 피킹 — click/tap 시점에만 O(n) 수행 (결정 20).
 * Points raycast threshold 방식과 달리 점 크기와 무관한 히트 영역을 보장한다.
 * fadeOuter는 SectorPoints의 구형 페이드와 동일 기준 — 보이지 않는 별은 후보가 아니다.
 */
export function useStarPicking(sectors: readonly LoadedSector[], fadeOuter: number) {
  const gl = useThree((state) => state.gl)
  const camera = useThree((state) => state.camera)
  const getThreeState = useThree((state) => state.get)
  const sectorsRef = useRef(sectors)
  sectorsRef.current = sectors

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

      const hitRadius = event.pointerType === 'touch' ? BASE_HIT_RADIUS_PX * 2 : BASE_HIT_RADIUS_PX
      // 페이드 중심 = SectorPoints의 uFadeCenter와 동일 기준 (controls.target)
      const controls = getThreeState().controls as { target?: Vector3 } | null
      const fadeCenter = controls?.target ?? camera.position
      const star = pickNearestStar(
        event,
        element.getBoundingClientRect(),
        camera,
        sectorsRef.current,
        hitRadius,
        fadeCenter,
        fadeOuter,
      )
      selectStar(star?.id ?? null)
    }

    element.addEventListener('pointerdown', handlePointerDown)
    element.addEventListener('pointerup', handlePointerUp)
    return () => {
      element.removeEventListener('pointerdown', handlePointerDown)
      element.removeEventListener('pointerup', handlePointerUp)
    }
  }, [gl, camera, getThreeState, fadeOuter])
}
