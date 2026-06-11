import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { BufferGeometry, Color, Float32BufferAttribute } from 'three'

import type { Star } from '@/engine'
import { SECTOR_SIZE } from '@/engine'
import { SPECTRAL_RENDER } from '@/scenes/galaxy/spectral'
import { createStarGlowMaterial, setUniform } from '@/scenes/shared/starGlowMaterial'
import { starVariance } from '@/scenes/shared/starVariance'

/**
 * 원거리 별 크기 하한 — size 어트리뷰트 1단위당 px. 분광형 크기에 비례하므로
 * 최대 줌아웃에서도 O형 거성과 M형 왜성의 크기 격차가 뭉개지지 않는다.
 */
const STAR_MIN_POINT_SIZE_PER_UNIT = 1.2

/**
 * 샤프 → 소프트 글로우 전환 카메라 거리 (월드 단위).
 * 별계 항행 거리(~400)에서는 또렷한 점광원, 은하 조망(최대 6,000)에서는
 * 부드러운 글로우로 — 확대할수록 초점이 맞는 느낌을 만든다.
 */
const SOFT_NEAR_DISTANCE = 800
const SOFT_FAR_DISTANCE = 3_200

/** 별 개성 변주 폭 — 같은 분광형 안에서도 밝기·크기가 이만큼 갈린다. */
const BRIGHTNESS_BASE = 0.55
const BRIGHTNESS_SPAN = 0.6
const SIZE_JITTER_BASE = 0.75
const SIZE_JITTER_SPAN = 0.55

function fract(value: number): number {
  return value - Math.floor(value)
}

function buildGeometry(stars: readonly Star[]): BufferGeometry {
  const count = stars.length
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const color = new Color()

  stars.forEach((star, index) => {
    positions[index * 3] = star.sector.sx * SECTOR_SIZE + star.localPos[0]
    positions[index * 3 + 1] = star.sector.sy * SECTOR_SIZE + star.localPos[1]
    positions[index * 3 + 2] = star.sector.sz * SECTOR_SIZE + star.localPos[2]

    // 별 개성: 결정론적 좌표(localPos)에서 파생한 밝기·크기 변주 —
    // 모든 플레이어가 같은 하늘을 보고, 균일한 점 패턴이 깨진다
    const brightness = BRIGHTNESS_BASE + BRIGHTNESS_SPAN * starVariance(star.localPos)
    const sizeJitter =
      SIZE_JITTER_BASE +
      SIZE_JITTER_SPAN * fract(star.localPos[0] * 0.317 + star.localPos[2] * 0.613)

    const render = SPECTRAL_RENDER[star.spectral]
    color.set(render.color)
    colors[index * 3] = color.r * brightness
    colors[index * 3 + 1] = color.g * brightness
    colors[index * 3 + 2] = color.b * brightness
    sizes[index] = render.size * sizeJitter
  })

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('starColor', new Float32BufferAttribute(colors, 3))
  geometry.setAttribute('size', new Float32BufferAttribute(sizes, 1))
  return geometry
}

interface GalaxyStarFieldProps {
  readonly stars: readonly Star[]
  readonly maxPointSize: number
}

/**
 * 은하 전체 별 필드 — 모든 별(약 7천)을 Points 1개 = 드로콜 1로 그린다 (결정 22).
 * 화면의 모든 점이 클릭 가능한 진짜 별이다 (별도 원경 레이어 없음).
 */
export function GalaxyStarField({ stars, maxPointSize }: GalaxyStarFieldProps) {
  const geometry = useMemo(() => buildGeometry(stars), [stars])
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

  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])

  useFrame((state) => {
    setUniform(material, 'uPixelRatio', state.gl.getPixelRatio())
  })

  return <points geometry={geometry} material={material} />
}
