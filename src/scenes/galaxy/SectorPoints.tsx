import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { BufferGeometry, Color, Float32BufferAttribute } from 'three'

import { SECTOR_SIZE } from '@/engine'
import { SPECTRAL_RENDER } from '@/scenes/galaxy/spectral'
import type { LoadedSector } from '@/scenes/galaxy/useVisibleSectors'
import { createStarGlowMaterial, setUniform } from '@/scenes/shared/starGlowMaterial'

/** 신규 섹터 알파 페이드인 — 청크 로드 팝핑 마스킹 (결정 12). */
const FADE_IN_S = 0.3

function buildGeometry(sector: LoadedSector): BufferGeometry {
  const count = sector.stars.length
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const color = new Color()

  sector.stars.forEach((star, index) => {
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

interface SectorPointsProps {
  readonly sector: LoadedSector
  readonly maxPointSize: number
}

/** 섹터당 Points 1개 = 드로콜 1 — 드로콜 수가 가시 섹터 수로 고정된다 (결정 12). */
export function SectorPoints({ sector, maxPointSize }: SectorPointsProps) {
  const geometry = useMemo(() => buildGeometry(sector), [sector])
  const material = useMemo(() => createStarGlowMaterial({ maxPointSize }), [maxPointSize])

  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])

  useFrame((state) => {
    setUniform(material, 'uOpacity', Math.min(1, (state.clock.elapsedTime - sector.bornAt) / FADE_IN_S))
    setUniform(material, 'uPixelRatio', state.gl.getPixelRatio())
  })

  return <points geometry={geometry} material={material} />
}
