import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { BufferGeometry, Color, Float32BufferAttribute } from 'three'

import type { Star } from '@/engine'
import { SECTOR_SIZE } from '@/engine'
import { SPECTRAL_RENDER } from '@/scenes/galaxy/spectral'
import { createStarGlowMaterial, setUniform } from '@/scenes/shared/starGlowMaterial'

/** 원거리 별 크기 하한 (px) — 줌아웃해도 별이 서브픽셀로 사라지지 않는다. */
const STAR_MIN_POINT_SIZE = 1.2

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

    const render = SPECTRAL_RENDER[star.spectral]
    color.set(render.color)
    colors[index * 3] = color.r
    colors[index * 3 + 1] = color.g
    colors[index * 3 + 2] = color.b
    sizes[index] = render.size
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
 * 은하 전체 별 필드 — 모든 별(약 3.5만)을 Points 1개 = 드로콜 1로 그린다 (결정 22).
 * 화면에 보이는 별이 곧 클릭 가능한 별이다 — 별도 원경 점은 색 보조용 백드롭뿐.
 */
export function GalaxyStarField({ stars, maxPointSize }: GalaxyStarFieldProps) {
  const geometry = useMemo(() => buildGeometry(stars), [stars])
  const material = useMemo(
    () =>
      createStarGlowMaterial({
        maxPointSize,
        initialOpacity: 1,
        profile: 'star',
        minPointSize: STAR_MIN_POINT_SIZE,
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
