import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { BufferGeometry, Float32BufferAttribute } from 'three'

import { armRidgeAt, SECTOR_SIZE, sectorDensity } from '@/engine'
import { createStarGlowMaterial, setUniform } from '@/scenes/shared/starGlowMaterial'

/**
 * 성운 클러스터 (galaxy-realism-pass 최종안) — 텍스처를 그리는 대신 성운을 **실제 3D
 * 오브젝트로 배치**한다 (사용자 방향: 실제 별·성운 배치로 효과). 팔 능선 위 결정론
 * 위치에 비등방(길쭉한) 점 구름을 두므로:
 * - 형태가 원형/대칭 프리미티브가 아니라 불규칙 3D 구조 (기각된 라디얼 빌보드와 반대)
 * - 함교에서 가까운 성운은 하늘 한 켠의 큰 얼룩, 먼 성운은 작은 뭉침 — 시차 공짜
 * - 조망뷰에선 팔을 따라 박힌 발광 매듭으로 읽힘
 * 색은 발광(로즈 H-알파)/반사(청색) 두 계열. 해시 결정론 — 시드 무관, 렌더 전용.
 */

const SITE_COUNT = 36
const SITE_TRIALS = 4_000
/** 배치 반경 (섹터) — 벌지 밖 팔 구간. */
const SITE_RADIUS_MIN = 8
const SITE_RADIUS_MAX = 44
/** 후보 채택 문턱 — 밀도×팔능선이 높은 곳만 (별 형성 영역은 가스 밀집부). */
const SITE_ACCEPT_THRESHOLD = 0.22

const POINTS_PER_SITE = 170
/** 비등방 축 스케일 (월드) — 장축이 단축의 2~4배로 길쭉한 구름. */
const AXIS_LONG_MIN = 160
const AXIS_LONG_SPAN = 320
const AXIS_SHORT_MIN = 60
const AXIS_SHORT_SPAN = 90
const AXIS_VERTICAL = 55

/** 발광(로즈)·반사(청) 계열 — 포인트별 변주 폭. */
const ROSE_RGB: readonly [number, number, number] = [1, 0.52, 0.6]
const BLUE_RGB: readonly [number, number, number] = [0.62, 0.74, 1]
const BRIGHTNESS_BASE = 0.05
const BRIGHTNESS_SPAN = 0.3

const MAX_POINT_SIZE = 4
const MIN_POINT_SIZE_PER_UNIT = 0.35
const SIZE_BASE = 1.2
const SIZE_SPAN = 2.4

function hash01(n: number): number {
  const value = Math.sin(n) * 43758.5453
  return value - Math.floor(value)
}

/** 근사 가우시안 [-1, 1] — 균일 해시 4개 합 (중심극한). */
function gaussianish(seed: number): number {
  return (hash01(seed) + hash01(seed + 0.37) + hash01(seed + 0.71) + hash01(seed + 1.13) - 2) / 2
}

interface NebulaSite {
  readonly x: number
  readonly z: number
  readonly y: number
  readonly angle: number
  readonly axisLong: number
  readonly axisShort: number
  readonly isRose: boolean
}

function sampleSites(): readonly NebulaSite[] {
  const sites: NebulaSite[] = []
  for (let trial = 0; trial < SITE_TRIALS && sites.length < SITE_COUNT; trial++) {
    const seed = trial * 11 + 3
    const radius = SITE_RADIUS_MIN + (SITE_RADIUS_MAX - SITE_RADIUS_MIN) * hash01(seed)
    const azimuth = hash01(seed + 1) * Math.PI * 2
    const sx = Math.cos(azimuth) * radius
    const sz = Math.sin(azimuth) * radius
    const quality = sectorDensity({ sx, sy: 0, sz }) * (0.35 + 0.65 * armRidgeAt(sx, sz))
    if (quality < SITE_ACCEPT_THRESHOLD * hash01(seed + 2)) continue
    if (quality < SITE_ACCEPT_THRESHOLD * 0.5) continue

    sites.push({
      x: sx * SECTOR_SIZE,
      z: sz * SECTOR_SIZE,
      y: gaussianish(seed + 3) * 60,
      angle: hash01(seed + 4) * Math.PI * 2,
      axisLong: AXIS_LONG_MIN + AXIS_LONG_SPAN * hash01(seed + 5),
      axisShort: AXIS_SHORT_MIN + AXIS_SHORT_SPAN * hash01(seed + 6),
      isRose: hash01(seed + 7) < 0.55,
    })
  }
  return sites
}

function buildGeometry(): BufferGeometry {
  const sites = sampleSites()
  const count = sites.length * POINTS_PER_SITE
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const sizes = new Float32Array(count)

  let index = 0
  sites.forEach((site, siteIndex) => {
    const cos = Math.cos(site.angle)
    const sin = Math.sin(site.angle)
    const base = site.isRose ? ROSE_RGB : BLUE_RGB
    for (let p = 0; p < POINTS_PER_SITE; p++) {
      const seed = siteIndex * 100_003 + p * 13 + 7
      // 비등방 가우시안 — 장축 방향으로 길쭉, 수직은 얇게
      const along = gaussianish(seed) * site.axisLong
      const across = gaussianish(seed + 2.3) * site.axisShort
      positions[index * 3] = site.x + along * cos - across * sin
      positions[index * 3 + 1] = site.y + gaussianish(seed + 4.7) * AXIS_VERTICAL
      positions[index * 3 + 2] = site.z + along * sin + across * cos

      // 중심부일수록 밝게 — 구름 심이 생긴다 (완전 균일이면 안개 조각)
      const radial = Math.min(1, (Math.abs(along) / site.axisLong + Math.abs(across) / site.axisShort) * 0.7)
      const brightness =
        (BRIGHTNESS_BASE + BRIGHTNESS_SPAN * hash01(seed + 6.1) * hash01(seed + 6.1)) *
        (1 - radial * 0.75)
      colors[index * 3] = base[0] * brightness
      colors[index * 3 + 1] = base[1] * brightness
      colors[index * 3 + 2] = base[2] * brightness

      sizes[index] = SIZE_BASE + SIZE_SPAN * hash01(seed + 8.9)
      index++
    }
  })

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('starColor', new Float32BufferAttribute(colors, 3))
  geometry.setAttribute('size', new Float32BufferAttribute(sizes, 1))
  return geometry
}

export function NebulaClusters() {
  const geometry = useMemo(() => buildGeometry(), [])
  const material = useMemo(
    () =>
      createStarGlowMaterial({
        maxPointSize: MAX_POINT_SIZE,
        initialOpacity: 1,
        minPointSizePerUnit: MIN_POINT_SIZE_PER_UNIT,
        // 항상 소프트 글로우 — 성운 점은 별상이 아니라 가스 뭉침으로 읽혀야 한다
        softNear: 1,
        softFar: 2,
      }),
    [],
  )

  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])

  useFrame((state) => {
    setUniform(material, 'uPixelRatio', state.gl.getPixelRatio())
  })

  return <points geometry={geometry} material={material} />
}
