import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { BufferGeometry, Float32BufferAttribute } from 'three'

import { BAND_HALF_HEIGHT, BAND_RADIUS } from '@/scenes/galaxy/galaxyBandPanorama'
import { createStarGlowMaterial, setUniform } from '@/scenes/shared/starGlowMaterial'

/**
 * 은하수 띠 별먼지 (galaxy-realism-pass) — 실제 은하수 사진의 질감은 매끈한 광채가
 * 아니라 "분해된 별 알갱이의 강"이다. 베이크 밴드(연속 발광)는 구조적으로 에어브러시로
 * 읽히므로, 은하면에 가우시안 집중된 미세 별 점을 밴드 실린더 바로 안쪽 셸에 뿌려
 * 입자감을 보탠다 (사용자 피드백: "구글 은하수 사진과 다른 느낌" — 입자감 부재).
 *
 * DecorativeStarfield(균일 천구)와 같은 결정론 해시 장식 — 시드 무관, 클릭 불가,
 * 렌더 전용. 함교·워프 시점 전용으로 마운트한다 (조망 뷰에선 밴드와 함께 걷힘).
 */

const DUST_COUNT = 12_000
/** 밴드 실린더(10,500) 바로 안쪽 — 베이크 글로우와 같은 깊이감으로 겹친다. */
const DUST_RADIUS = BAND_RADIUS * 0.96
/** 수직 가우시안 σ — 밴드 프라이어(σ=1,000)와 같은 스케일로 띠에 붙는다. */
const DUST_SIGMA_WORLD = 850
/** 별 알갱이 크기·밝기 — 배경 질감이므로 전경 별보다 항상 작고 어둡다. */
const DUST_MAX_POINT_SIZE = 2.2
const DUST_MIN_POINT_SIZE_PER_UNIT = 0.55
const SIZE_BASE = 0.7
const SIZE_SPAN = 1.1
/** 반중심 방향에서도 희미한 띠가 읽히는 하한 (겨울 은하수) — 코어 방향은 베이크가 지배. */
const BRIGHTNESS_BASE = 0.18
const BRIGHTNESS_SPAN = 0.9
/** 색온도 — 은하수 사진의 황금빛~청백 별 알갱이. */
const WARM_TINT: readonly [number, number, number] = [1, 0.86, 0.66]
const COOL_TINT: readonly [number, number, number] = [0.78, 0.85, 1]

/** 결정론 해시 (DecorativeStarfield와 동일 기법) — 모든 플레이어가 같은 하늘. */
function hash01(n: number): number {
  const value = Math.sin(n) * 43758.5453
  return value - Math.floor(value)
}

/** 근사 가우시안 [-1, 1] — 균일 해시 4개 합 (중심극한). */
function gaussianish(seed: number): number {
  return (hash01(seed) + hash01(seed + 0.37) + hash01(seed + 0.71) + hash01(seed + 1.13) - 2) / 2
}

function buildDustGeometry(): BufferGeometry {
  const positions = new Float32Array(DUST_COUNT * 3)
  const colors = new Float32Array(DUST_COUNT * 3)
  const sizes = new Float32Array(DUST_COUNT)

  for (let i = 0; i < DUST_COUNT; i++) {
    const azimuth = hash01(i * 7 + 1) * Math.PI * 2
    // 수직은 가우시안 — 띠 중앙에 빽빽하고 위아래로 성기게. 밴드 높이 안으로 클램프.
    const y = Math.max(
      -BAND_HALF_HEIGHT * 0.9,
      Math.min(BAND_HALF_HEIGHT * 0.9, gaussianish(i * 7 + 2) * 2 * DUST_SIGMA_WORLD),
    )
    positions[i * 3] = Math.cos(azimuth) * DUST_RADIUS
    positions[i * 3 + 1] = y
    positions[i * 3 + 2] = Math.sin(azimuth) * DUST_RADIUS

    // 멱법칙 밝기 (세제곱 치우침) — 다수는 겨우 보이는 알갱이, 소수만 또렷
    const skew = hash01(i * 7 + 3)
    const brightness = BRIGHTNESS_BASE + BRIGHTNESS_SPAN * skew * skew * skew
    const temperature = hash01(i * 7 + 4)
    const tint = temperature < 0.45 ? COOL_TINT : WARM_TINT
    const tintBlend = Math.abs(temperature - 0.45) * 1.4
    colors[i * 3] = (1 + (tint[0] - 1) * tintBlend) * brightness
    colors[i * 3 + 1] = (1 + (tint[1] - 1) * tintBlend) * brightness
    colors[i * 3 + 2] = (1 + (tint[2] - 1) * tintBlend) * brightness

    sizes[i] = SIZE_BASE + SIZE_SPAN * hash01(i * 7 + 5)
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('starColor', new Float32BufferAttribute(colors, 3))
  geometry.setAttribute('size', new Float32BufferAttribute(sizes, 1))
  return geometry
}

interface BandStarDustProps {
  /** 정박 별 월드 좌표 — 밴드 실린더와 같은 중심 (평면 좌표만, 수직은 원반면 y=0). */
  readonly anchor: readonly [number, number, number]
}

export function BandStarDust({ anchor }: BandStarDustProps) {
  const geometry = useMemo(() => buildDustGeometry(), [])
  const material = useMemo(
    () =>
      createStarGlowMaterial({
        maxPointSize: DUST_MAX_POINT_SIZE,
        initialOpacity: 1,
        minPointSizePerUnit: DUST_MIN_POINT_SIZE_PER_UNIT,
      }),
    [],
  )

  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])

  useFrame((state) => {
    setUniform(material, 'uPixelRatio', state.gl.getPixelRatio())
  })

  return <points geometry={geometry} material={material} position={[anchor[0], 0, anchor[2]]} />
}
