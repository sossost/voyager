import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { BufferGeometry, Color, Float32BufferAttribute, Vector3 } from 'three'

import type { Star, StarId } from '@/engine'
import { SECTOR_SIZE } from '@/engine'
import { SPECTRAL_RENDER } from '@/scenes/galaxy/spectral'
import { fract } from '@/scenes/shared/fract'
import { createStarGlowMaterial, setUniform } from '@/scenes/shared/starGlowMaterial'
import { starVariance } from '@/scenes/shared/starVariance'
import { crossfadeProgress } from '@/scenes/system/starCrossfade'

/**
 * 원거리 별 크기 하한 — size 어트리뷰트 1단위당 px. 분광형 크기에 비례하므로
 * 최대 줌아웃에서도 O형 거성과 M형 왜성의 크기 격차가 뭉개지지 않는다.
 */
const STAR_MIN_POINT_SIZE_PER_UNIT = 1.2

/**
 * 샤프 → 소프트 글로우 전환 카메라 거리 (월드 단위).
 * 항성계 항행 거리(~400)에서는 또렷한 점광원, 은하 조망(최대 6,000)에서는
 * 부드러운 글로우로 — 확대할수록 초점이 맞는 느낌을 만든다.
 */
const SOFT_NEAR_DISTANCE = 800
const SOFT_FAR_DISTANCE = 3_200

/** 별 개성 변주 폭 — 같은 분광형 안에서도 밝기·크기가 이만큼 갈린다. */
const BRIGHTNESS_BASE = 0.55
const BRIGHTNESS_SPAN = 0.6
const SIZE_JITTER_BASE = 0.75
const SIZE_JITTER_SPAN = 0.55

/**
 * 방문 별 틴트 — 별 자체가 청록빛으로 "켜진다" (링 마커 대체, 백로그 F-2).
 * 줌아웃에서도 보이도록 색을 섞고 밝기·크기를 키운다 (정보 위계: 방문 > 미방문).
 */
const VISITED_TINT = new Color('#52f5d0')
const VISITED_TINT_MIX = 0.6
const VISITED_BRIGHTNESS_BOOST = 1.45
const VISITED_SIZE_BOOST = 1.18

interface StarBaseAttributes {
  readonly r: number
  readonly g: number
  readonly b: number
  readonly size: number
}

/** 별 개성: 결정론적 좌표(localPos) 파생 변주 — 모든 플레이어가 같은 하늘을 본다. */
function starBaseAttributes(star: Star, color: Color): StarBaseAttributes {
  const brightness = BRIGHTNESS_BASE + BRIGHTNESS_SPAN * starVariance(star.localPos)
  const sizeJitter =
    SIZE_JITTER_BASE +
    SIZE_JITTER_SPAN * fract(star.localPos[0] * 0.317 + star.localPos[2] * 0.613)

  const render = SPECTRAL_RENDER[star.spectral]
  color.set(render.color)
  return {
    r: color.r * brightness,
    g: color.g * brightness,
    b: color.b * brightness,
    size: render.size * sizeJitter,
  }
}

function buildGeometry(stars: readonly Star[]): BufferGeometry {
  const count = stars.length
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  // 현재 별 플래그 — 1인 포인트만 uCurrentFade를 받는다 (크로스페이드, 결정 41-c). 기본 0.
  const current = new Float32Array(count)
  const color = new Color()

  stars.forEach((star, index) => {
    positions[index * 3] = star.sector.sx * SECTOR_SIZE + star.localPos[0]
    positions[index * 3 + 1] = star.sector.sy * SECTOR_SIZE + star.localPos[1]
    positions[index * 3 + 2] = star.sector.sz * SECTOR_SIZE + star.localPos[2]

    const base = starBaseAttributes(star, color)
    colors[index * 3] = base.r
    colors[index * 3 + 1] = base.g
    colors[index * 3 + 2] = base.b
    sizes[index] = base.size
  })

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('starColor', new Float32BufferAttribute(colors, 3))
  geometry.setAttribute('size', new Float32BufferAttribute(sizes, 1))
  geometry.setAttribute('aCurrent', new Float32BufferAttribute(current, 1))
  return geometry
}

interface GalaxyStarFieldProps {
  readonly stars: readonly Star[]
  readonly maxPointSize: number
  readonly visitedStars: ReadonlySet<StarId>
  readonly currentStarId: StarId
  /** 현재 별 구체(StarSurface)가 렌더 중인가 — 그럴 때만 포인트를 거리로 페이드 (결정 41-c). */
  readonly isSystemVisible: boolean
}

/**
 * 은하 전체 별 필드 — 모든 별(약 7천)을 Points 1개 = 드로콜 1로 그린다 (결정 22).
 * 화면의 모든 점이 클릭 가능한 진짜 별이다 (별도 원경 레이어 없음).
 * 방문한 별은 어트리뷰트 갱신으로 청록빛 틴트를 얹는다 — 드로콜·캡 추가 없음.
 */
export function GalaxyStarField({
  stars,
  maxPointSize,
  visitedStars,
  currentStarId,
  isSystemVisible,
}: GalaxyStarFieldProps) {
  const geometry = useMemo(() => buildGeometry(stars), [stars])
  const currentStarScratch = useMemo(() => new Vector3(), [])
  const material = useMemo(
    () =>
      createStarGlowMaterial({
        maxPointSize,
        initialOpacity: 1,
        minPointSizePerUnit: STAR_MIN_POINT_SIZE_PER_UNIT,
        softNear: SOFT_NEAR_DISTANCE,
        softFar: SOFT_FAR_DISTANCE,
      }),
    [maxPointSize],
  )

  const indexByStarId = useMemo(() => {
    const map = new Map<StarId, number>()
    stars.forEach((star, index) => map.set(star.id, index))
    return map
  }, [stars])

  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])

  // 방문 집합은 늘어나기만 한다 — 기본 변주를 다시 계산한 뒤 틴트를 얹으므로 멱등이다.
  // (geometry가 재생성되면 deps로 다시 실행되어 틴트가 복원된다)
  useEffect(() => {
    const colorAttribute = geometry.getAttribute('starColor')
    const sizeAttribute = geometry.getAttribute('size')
    if (colorAttribute == null || sizeAttribute == null) return
    const color = new Color()
    let hasChanges = false

    for (const starId of visitedStars) {
      const index = indexByStarId.get(starId)
      if (index == null) continue
      const star = stars[index]
      if (star == null) continue

      const base = starBaseAttributes(star, color)
      color.setRGB(base.r, base.g, base.b)
      color.lerp(VISITED_TINT, VISITED_TINT_MIX).multiplyScalar(VISITED_BRIGHTNESS_BOOST)
      colorAttribute.setXYZ(index, color.r, color.g, color.b)
      sizeAttribute.setX(index, base.size * VISITED_SIZE_BOOST)
      hasChanges = true
    }

    if (hasChanges) {
      colorAttribute.needsUpdate = true
      sizeAttribute.needsUpdate = true
    }
  }, [geometry, indexByStarId, stars, visitedStars])

  // 현재 별 인덱스에만 aCurrent=1 — currentStarId/지오메트리 변경 시 한 번 (드묾)
  useEffect(() => {
    const attribute = geometry.getAttribute('aCurrent')
    if (attribute == null) return
    const array = attribute.array as Float32Array
    array.fill(0)
    const index = indexByStarId.get(currentStarId)
    if (index != null) array[index] = 1
    attribute.needsUpdate = true
  }, [geometry, indexByStarId, currentStarId])

  useFrame((state) => {
    setUniform(material, 'uPixelRatio', state.gl.getPixelRatio())

    // 현재 별 포인트 크로스페이드 — 구체가 보일 때만 카메라 거리로 페이드 (결정 41-c).
    // 구체가 없는 뷰(퍼스펙티브)에선 포인트를 그대로 보인다.
    let currentFade = 1
    if (isSystemVisible) {
      const index = indexByStarId.get(currentStarId)
      const star = index == null ? null : stars[index]
      if (star != null) {
        currentStarScratch.set(
          star.sector.sx * SECTOR_SIZE + star.localPos[0],
          star.sector.sy * SECTOR_SIZE + star.localPos[1],
          star.sector.sz * SECTOR_SIZE + star.localPos[2],
        )
        currentFade = crossfadeProgress(state.camera.position.distanceTo(currentStarScratch))
      }
    }
    setUniform(material, 'uCurrentFade', currentFade)
  })

  return <points geometry={geometry} material={material} />
}
