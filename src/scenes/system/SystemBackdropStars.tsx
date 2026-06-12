import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { BufferGeometry, Color, Float32BufferAttribute } from 'three'

import type { Seed, StarId } from '@/engine'
import { SECTOR_SIZE, starWorldPosition } from '@/engine'
import { SPECTRAL_RENDER } from '@/scenes/galaxy/spectral'
import { generateGalaxyStars } from '@/scenes/galaxy/useGalaxyStars'
import { createStarGlowMaterial, setUniform } from '@/scenes/shared/starGlowMaterial'
import { starVariance } from '@/scenes/shared/starVariance'

/**
 * 항성계 씬 배경 별 — 은하의 실제 이웃 별을 천구 셸에 투영한다 (백로그 E-6, 결정 25).
 *
 * generateGalaxyStars의 시드당 캐시를 재사용하므로 생성 비용 0에 가깝고,
 * 방향이 실제 은하 좌표 그대로라 "은하 지도에서 보이던 그 별이 그 방향 하늘에 떠 있다".
 * 항성계 씬은 플로팅 오리진(현재 별 = 0,0,0, 결정 15)이므로 현재 별 기준 상대 방향을
 * 고정 반경 셸로 정규화한다 — 가장 가까운 이웃도 행성 궤도(~53)와 절대 겹치지 않는다.
 * 렌더 전용 — Points 1드로콜, 시드 결정론 유지, GEN_VERSION 무관.
 */

/** 천구 셸 반경 — 카메라 최대 거리(180)보다 충분히 멀어 시차가 없다. */
const BACKDROP_SHELL_RADIUS = 4_000
/** 이 실거리(월드 단위)에서 밝기 1 — 가까운 이웃일수록 또렷하게 박힌다. */
const FULL_BRIGHTNESS_DISTANCE = 150
/** 거리 감쇠 지수 — 1보다 작게 둬서 먼 별이 너무 빨리 죽지 않게 한다. */
const BRIGHTNESS_FALLOFF_EXPONENT = 0.8
/** 밝기 하한 (지터 적용 후 최종값 기준) — 은하 건너편 별도 희미하게 남아 띠가 살아난다. */
const MIN_BRIGHTNESS = 0.04
/** 배경 별 점 크기 캡(px) — 항성·행성이 주인공이므로 작게 누른다. */
const BACKDROP_MAX_POINT_SIZE = 4
/**
 * 배경 별 크기 하한 (size 어트리뷰트 1단위당 px) — 셸이 항상 원거리(4,000)라
 * 원근항(~0.17px/단위)이 늘 하한 아래이므로 사실상 이 값이 화면 크기를 결정한다.
 * 은하 씬(1.2)보다 작게: 배경은 풍경이지 선택 대상이 아니다.
 */
const BACKDROP_MIN_POINT_SIZE_PER_UNIT = 0.5
/** 별 개성 변주 — 은하 지도와 같은 starVariance 해시 (모두가 같은 하늘). */
const BRIGHTNESS_JITTER_BASE = 0.7
const BRIGHTNESS_JITTER_SPAN = 0.6

function buildBackdropGeometry(seed: Seed, starId: StarId): BufferGeometry | null {
  const origin = starWorldPosition(seed, starId)
  if (origin == null) return null

  const stars = generateGalaxyStars(seed)
  // 현재 별 1개만 제외되는 상한으로 선할당 — GalaxyStarField.buildGeometry와 같은 패턴
  const maxCount = stars.length - 1
  const positions = new Float32Array(maxCount * 3)
  const colors = new Float32Array(maxCount * 3)
  const sizes = new Float32Array(maxCount)
  const color = new Color()
  let writeIndex = 0

  for (const star of stars) {
    if (star.id === starId) continue

    const dx = star.sector.sx * SECTOR_SIZE + star.localPos[0] - origin[0]
    const dy = star.sector.sy * SECTOR_SIZE + star.localPos[1] - origin[1]
    const dz = star.sector.sz * SECTOR_SIZE + star.localPos[2] - origin[2]
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)
    if (distance === 0) continue

    const shellScale = BACKDROP_SHELL_RADIUS / distance
    positions[writeIndex * 3] = dx * shellScale
    positions[writeIndex * 3 + 1] = dy * shellScale
    positions[writeIndex * 3 + 2] = dz * shellScale

    const falloff = Math.min(
      1,
      Math.pow(FULL_BRIGHTNESS_DISTANCE / distance, BRIGHTNESS_FALLOFF_EXPONENT),
    )
    const jitter = BRIGHTNESS_JITTER_BASE + BRIGHTNESS_JITTER_SPAN * starVariance(star.localPos)
    const brightness = Math.max(MIN_BRIGHTNESS, falloff * jitter)

    const render = SPECTRAL_RENDER[star.spectral]
    color.set(render.color)
    colors[writeIndex * 3] = color.r * brightness
    colors[writeIndex * 3 + 1] = color.g * brightness
    colors[writeIndex * 3 + 2] = color.b * brightness
    sizes[writeIndex] = render.size
    writeIndex++
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute(positions.subarray(0, writeIndex * 3), 3),
  )
  geometry.setAttribute(
    'starColor',
    new Float32BufferAttribute(colors.subarray(0, writeIndex * 3), 3),
  )
  geometry.setAttribute('size', new Float32BufferAttribute(sizes.subarray(0, writeIndex), 1))
  return geometry
}

interface SystemBackdropStarsProps {
  readonly seed: Seed
  readonly starId: StarId
}

export function SystemBackdropStars({ seed, starId }: SystemBackdropStarsProps) {
  const geometry = useMemo(() => buildBackdropGeometry(seed, starId), [seed, starId])
  const material = useMemo(
    () =>
      createStarGlowMaterial({
        maxPointSize: BACKDROP_MAX_POINT_SIZE,
        initialOpacity: 1,
        minPointSizePerUnit: BACKDROP_MIN_POINT_SIZE_PER_UNIT,
      }),
    [],
  )

  useEffect(
    () => () => {
      if (geometry != null) geometry.dispose()
    },
    [geometry],
  )
  useEffect(() => () => material.dispose(), [material])

  useFrame((state) => {
    setUniform(material, 'uPixelRatio', state.gl.getPixelRatio())
  })

  if (geometry == null) return null

  return <points geometry={geometry} material={material} />
}
