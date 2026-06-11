import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { BufferGeometry, Color, Float32BufferAttribute, type Vector3 } from 'three'

import { SECTOR_SIZE } from '@/engine'
import { SPECTRAL_RENDER } from '@/scenes/galaxy/spectral'
import type { LoadedSector } from '@/scenes/galaxy/useVisibleSectors'
import {
  createStarGlowMaterial,
  setUniform,
  setVector3Uniform,
} from '@/scenes/shared/starGlowMaterial'

/** 신규 섹터 알파 페이드인 — 청크 로드 팝핑 마스킹 (결정 12). */
const FADE_IN_S = 0.3
/** 구형 페이드 시작 반경 비율 — 이 안쪽은 완전 불투명, 바깥은 fadeOuter까지 감쇠. */
const FADE_INNER_RATIO = 0.55

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
  /** 카메라 초점 기준 구형 페이드 소멸 반경 (월드 단위) — 섹터 로드 큐브의 모서리를 가린다. */
  readonly fadeOuter: number
}

/** 섹터당 Points 1개 = 드로콜 1 — 드로콜 수가 가시 섹터 수로 고정된다 (결정 12). */
export function SectorPoints({ sector, maxPointSize, fadeOuter }: SectorPointsProps) {
  const geometry = useMemo(() => buildGeometry(sector), [sector])
  const material = useMemo(
    () =>
      createStarGlowMaterial({
        maxPointSize,
        fadeInner: fadeOuter * FADE_INNER_RATIO,
        fadeOuter,
      }),
    [maxPointSize, fadeOuter],
  )

  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])

  useFrame((state) => {
    setUniform(material, 'uOpacity', Math.min(1, (state.clock.elapsedTime - sector.bornAt) / FADE_IN_S))
    setUniform(material, 'uPixelRatio', state.gl.getPixelRatio())

    // 페이드 중심 = 섹터 로딩 중심(controls.target) — useVisibleSectors와 동일 기준
    const controls = state.controls as { target?: Vector3 } | null
    const focus = controls?.target ?? state.camera.position
    setVector3Uniform(material, 'uFadeCenter', focus.x, focus.y, focus.z)
  })

  return <points geometry={geometry} material={material} />
}
