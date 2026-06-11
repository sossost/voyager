import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { BufferGeometry, Float32BufferAttribute } from 'three'

import { createStarGlowMaterial, setUniform } from '@/scenes/shared/starGlowMaterial'

/**
 * 균일 장식 별밭 — 천구 전체에 고르게 흩어진 배경 별 (결정 28, 백로그 G-a-2).
 *
 * 물리 충실(은하수 띠)은 "구름 같다"로 기각 — 스텔라리스식 게임 미학을 따른다:
 * 배경은 균일하고 차분해야 전경(항성·행성·은하 별)이 산다.
 * 별계 씬과 은하 우주선 뷰가 공유한다 — 반경/중심만 씬에 맞게 주입한다.
 * 결정론 해시 기반 — 시드 무관 장식이라 모든 플레이어가 같은 하늘을 본다.
 */

/** 별 수 — 빈틈없이 고르되 과밀하지 않게 (각밀도는 반경과 무관하다). */
const STARFIELD_COUNT = 6_000
/** 밝기 분포 — 제곱 치우침: 다수는 어둡고 소수만 또렷하다. */
const BRIGHTNESS_BASE = 0.3
const BRIGHTNESS_SPAN = 0.65
/** 크기 변주 (size 어트리뷰트 단위). */
const SIZE_BASE = 1.1
const SIZE_SPAN = 1.4
/** 점 크기 캡 — 배경은 풍경, 전경 별보다 도드라지면 안 된다. */
const STARFIELD_MAX_POINT_SIZE = 3
const STARFIELD_MIN_POINT_SIZE_PER_UNIT = 0.8
/** 색온도 양끝 — 백색을 중심으로 살짝 차갑거나 따뜻하게. */
const COOL_TINT: readonly [number, number, number] = [0.75, 0.83, 1]
const WARM_TINT: readonly [number, number, number] = [1, 0.88, 0.72]
const TINT_STRENGTH = 0.55

const SCENE_ORIGIN: readonly [number, number, number] = [0, 0, 0]

/** 결정론 해시 — 모든 플레이어가 같은 하늘을 본다 (전역 난수 금지). */
function hash01(n: number): number {
  const value = Math.sin(n) * 43758.5453
  return value - Math.floor(value)
}

function buildStarfieldGeometry(radius: number): BufferGeometry {
  const positions = new Float32Array(STARFIELD_COUNT * 3)
  const colors = new Float32Array(STARFIELD_COUNT * 3)
  const sizes = new Float32Array(STARFIELD_COUNT)

  for (let star = 0; star < STARFIELD_COUNT; star++) {
    // 구면 균일 분포: y는 [-1,1] 균일, 방위각은 [0,2π) 균일
    const y = 1 - 2 * hash01(star * 5 + 1)
    const azimuth = hash01(star * 5 + 2) * Math.PI * 2
    const horizontal = Math.sqrt(Math.max(0, 1 - y * y))
    positions[star * 3] = Math.cos(azimuth) * horizontal * radius
    positions[star * 3 + 1] = y * radius
    positions[star * 3 + 2] = Math.sin(azimuth) * horizontal * radius

    const dimSkew = hash01(star * 5 + 3)
    const brightness = BRIGHTNESS_BASE + BRIGHTNESS_SPAN * dimSkew * dimSkew

    // 백색 중심의 색온도 변주 — 단색 별밭은 죽어 보인다
    const temperature = hash01(star * 5 + 4)
    const tint = temperature < 0.5 ? COOL_TINT : WARM_TINT
    const tintBlend = Math.abs(temperature - 0.5) * 2 * TINT_STRENGTH
    colors[star * 3] = (1 + (tint[0] - 1) * tintBlend) * brightness
    colors[star * 3 + 1] = (1 + (tint[1] - 1) * tintBlend) * brightness
    colors[star * 3 + 2] = (1 + (tint[2] - 1) * tintBlend) * brightness

    sizes[star] = SIZE_BASE + SIZE_SPAN * hash01(star * 5 + 5)
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('starColor', new Float32BufferAttribute(colors, 3))
  geometry.setAttribute('size', new Float32BufferAttribute(sizes, 1))
  return geometry
}

interface DecorativeStarfieldProps {
  /** 천구 반경 (월드 단위) — 씬의 전경 콘텐츠보다 바깥, 카메라 far 안이어야 한다. */
  readonly radius: number
  /** 천구 중심 — 기본은 씬 원점. 우주선 뷰는 정박 별에 둬 하늘이 시점을 감싸게 한다. */
  readonly center?: readonly [number, number, number]
}

export function DecorativeStarfield({ radius, center = SCENE_ORIGIN }: DecorativeStarfieldProps) {
  const geometry = useMemo(() => buildStarfieldGeometry(radius), [radius])
  const material = useMemo(
    () =>
      createStarGlowMaterial({
        maxPointSize: STARFIELD_MAX_POINT_SIZE,
        initialOpacity: 1,
        minPointSizePerUnit: STARFIELD_MIN_POINT_SIZE_PER_UNIT,
      }),
    [],
  )

  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])

  useFrame((state) => {
    setUniform(material, 'uPixelRatio', state.gl.getPixelRatio())
  })

  return (
    <points
      geometry={geometry}
      material={material}
      position={[center[0], center[1], center[2]]}
    />
  )
}
