import { useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { BufferGeometry, Float32BufferAttribute } from 'three'

import { GALAXY_RADIUS_SECTORS, SECTOR_SIZE, sectorDensity } from '@/engine'
import { createStarGlowMaterial, setUniform } from '@/scenes/shared/starGlowMaterial'

/** 백드롭 샘플 간격 (섹터 단위) — 점 약 1천 개로 은하 전경을 그린다. */
const BACKDROP_STRIDE_SECTORS = 3
const MIN_VISIBLE_DENSITY = 0.02
const BACKDROP_OPACITY = 0.5
const BACKDROP_MAX_POINT_SIZE = 56
const BACKDROP_BASE_SIZE = 10
const BACKDROP_DENSITY_SIZE_SPAN = 18

/**
 * 은하 원경 — 밀도 함수를 굵게 샘플링한 1드로콜 글로우 점구름.
 * 로드 반경 밖에서도 은하의 원반·덩어리 형상이 보이게 한다 (줌아웃 조망).
 */
export function GalaxyBackdrop() {
  const pixelRatio = useThree((state) => state.gl.getPixelRatio())

  const geometry = useMemo(() => {
    const positions: number[] = []
    const colors: number[] = []
    const sizes: number[] = []

    for (let sx = -GALAXY_RADIUS_SECTORS; sx <= GALAXY_RADIUS_SECTORS; sx += BACKDROP_STRIDE_SECTORS) {
      for (let sz = -GALAXY_RADIUS_SECTORS; sz <= GALAXY_RADIUS_SECTORS; sz += BACKDROP_STRIDE_SECTORS) {
        const density = sectorDensity({ sx, sy: 0, sz })
        if (density < MIN_VISIBLE_DENSITY) continue

        positions.push(sx * SECTOR_SIZE, 0, sz * SECTOR_SIZE)
        const brightness = 0.3 + density * 0.7
        colors.push(0.5 * brightness, 0.55 * brightness, 0.85 * brightness)
        sizes.push(BACKDROP_BASE_SIZE + density * BACKDROP_DENSITY_SIZE_SPAN)
      }
    }

    const built = new BufferGeometry()
    built.setAttribute('position', new Float32BufferAttribute(positions, 3))
    built.setAttribute('starColor', new Float32BufferAttribute(colors, 3))
    built.setAttribute('size', new Float32BufferAttribute(sizes, 1))
    return built
  }, [])

  const material = useMemo(
    () =>
      createStarGlowMaterial({
        maxPointSize: BACKDROP_MAX_POINT_SIZE,
        initialOpacity: BACKDROP_OPACITY,
      }),
    [],
  )

  useEffect(() => {
    setUniform(material, 'uPixelRatio', pixelRatio)
  }, [material, pixelRatio])

  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])

  return <points geometry={geometry} material={material} />
}
