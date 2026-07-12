import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { BufferGeometry, Color, Float32BufferAttribute, Vector3 } from 'three'

import type { Star, StarId } from '@/engine'
import { SECTOR_SIZE } from '@/engine'
import { EXOTIC_RENDER, SPECTRAL_RENDER } from '@/scenes/galaxy/spectral'
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

  // 이색 천체는 EXOTIC_RENDER로 색/크기 차별화 (결정 10) — 1 draw call·피킹 불변.
  const render =
    star.kind === 'main_sequence' ? SPECTRAL_RENDER[star.spectral] : EXOTIC_RENDER[star.kind]
  color.set(render.color)
  return {
    r: color.r * brightness,
    g: color.g * brightness,
    b: color.b * brightness,
    size: render.size * sizeJitter,
  }
}

/**
 * 별의 멱법칙 감쇠 계수 [FAINT_FLOOR, 1] — 좌표 파생 결정론 (모든 플레이어 동일).
 * 이색 천체는 제외(1) — 희소 등대(펄서 청백 점 등)의 발견성은 함교에서도 유지한다.
 */
function faintOf(star: Star): number {
  if (star.kind !== 'main_sequence') return 1
  const variance = fract(star.localPos[0] * 0.731 + star.localPos[1] * 0.269 + star.localPos[2] * 0.457)
  const skewed = variance * variance * variance
  return FAINT_FLOOR + (1 - FAINT_FLOOR) * skewed
}

function buildGeometry(stars: readonly Star[]): BufferGeometry {
  const count = stars.length
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  // 현재 별 플래그 — 1인 포인트만 uCurrentFade를 받는다 (크로스페이드, 결정 41-c). 기본 0.
  const current = new Float32Array(count)
  const faints = new Float32Array(count)
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
    faints[index] = faintOf(star)
  })

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('starColor', new Float32BufferAttribute(colors, 3))
  geometry.setAttribute('size', new Float32BufferAttribute(sizes, 1))
  geometry.setAttribute('aCurrent', new Float32BufferAttribute(current, 1))
  geometry.setAttribute('aFaint', new Float32BufferAttribute(faints, 1))
  return geometry
}

/**
 * 함교(원반 내부) 뷰 성간 소광 τ/유닛 — e-folding ≈1,500유닛 (misc-ux 함교 중심부 난잡 완화).
 *
 * 실측은 은하면 평균 A_V ≈ 1.7 mag/kpc (Gontcharov 2016) — 게임 스케일(은하 반경 4,800유닛
 * ↔ 원반 반경 ~15 kpc, 1 kpc ≈ 320유닛)로 환산하면 τ ≈ 0.005/유닛이라 600유닛 밖이 전부
 * 소멸해 항행 정보가 죽는다. 의도적으로 ~1/8로 완화한 값 (M-6 분광 분포 평탄화와 같은
 * 게임성 완화) — 근거리(≤400유닛) 이웃은 거의 그대로, 중심부 원거리 스펙클(2,000유닛+
 * ×수천 개 가산 블렌딩)만 은하수 띠(ShipViewGalaxyGlow)에 흡수되도록 감광한다.
 */
const SHIP_VIEW_EXTINCTION_PER_UNIT = 1 / 1_500

/**
 * 함교 뷰 점 크기 상한(px) — 이웃 별도 실제로는 수 광년 거리의 점광원이라 행성 원반과
 * 크기가 경합하면 안 된다 (은하 중심부 밀집 지역에서 근접 별이 행성만 하게 보이는 문제).
 * 항법 조망 뷰는 발견성이 우선이라 품질 프리셋 상한(8~12px)을 그대로 쓴다.
 */
const SHIP_VIEW_MAX_POINT_SIZE = 6

/**
 * 광도 멱법칙 (O-19) — 실제 광도함수는 어두운 별이 압도적(멱법칙)이라 하늘 질감이
 * "다수의 희미한 별 + 소수의 등대"로 갈린다. 변주 세제곱이 근사 — 균일 v에 대해
 * v³은 하위 80%가 절반 이하 밝기로 깔린다 (DecorativeStarfield 제곱 치우침의 강화판).
 * 함교(감상) 뷰 전용(uFaintMix) — 항법(도구) 뷰의 발견성·클릭 가시성은 불변.
 * 바닥값은 완전 소실 방지 — 소광(uExtinction)과 곱해지므로 0이면 별이 사라진다.
 */
const FAINT_FLOOR = 0.18

/**
 * 줌아웃 조망의 사진 전환 (galaxy-realism-pass) — 은하 전경에서 점 필드가 "채도 높은
 * 색종이 입자"로 읽히는 문제. 항행 거리(줌인)에선 도구 가독성(과장 색·균일 밝기·클릭)을
 * 유지하고, 은하 조망으로 줌아웃할수록 멱법칙 감광·탈채도·크기 축소를 점진 적용해
 * 확산광(GalaxyNebula 헤이즈)이 형상을 넘겨받게 한다. 거리 창은 성운 페이드인과 동일
 * (GalaxyNebula FADE_NEAR/FAR) — 헤이즈가 떠오르는 만큼 점이 물러난다.
 */
const PHOTO_FADE_NEAR = 2_000
const PHOTO_FADE_FAR = 4_500
/** 조망 최대 적용률 — 1이면 어두운 별이 소실돼 지도 기능이 죽는다. */
const PHOTO_FAINT_MAX = 0.75
const PHOTO_DESATURATE_MAX = 0.7
/** 조망에서 점 크기 상한 축소율 — 점이 잘아져야 확산광에 섞인다. */
const PHOTO_POINT_SHRINK = 0.45

function smoothstep01(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

interface GalaxyStarFieldProps {
  readonly stars: readonly Star[]
  readonly maxPointSize: number
  readonly visitedStars: ReadonlySet<StarId>
  readonly currentStarId: StarId
  /** 원반 내부 시점(함교·워프) 여부 — 참이면 성간 소광을 적용한다. 조망(항법) 뷰는 거짓. */
  readonly isInsideDisk: boolean
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
  isInsideDisk,
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
    // 성간 소광·점 크기 상한·광도 멱법칙 — 원반 내부 시점에서만. 뷰 전환이 즉시 컷이라 페이드 불필요.
    setUniform(material, 'uExtinction', isInsideDisk ? SHIP_VIEW_EXTINCTION_PER_UNIT : 0)
    if (isInsideDisk) {
      setUniform(material, 'uFaintMix', 1)
      setUniform(material, 'uDesaturate', 0)
      setUniform(material, 'uMaxPointSize', Math.min(maxPointSize, SHIP_VIEW_MAX_POINT_SIZE))
    } else {
      // 항법 조망 — 줌아웃할수록 사진 톤으로 전환 (근거리 항행 가독성은 photo=0 → 불변)
      const controls = state.controls as { target?: Vector3 } | null
      const zoomDistance =
        controls?.target == null ? 0 : state.camera.position.distanceTo(controls.target)
      const photo = smoothstep01(PHOTO_FADE_NEAR, PHOTO_FADE_FAR, zoomDistance)
      setUniform(material, 'uFaintMix', PHOTO_FAINT_MAX * photo)
      setUniform(material, 'uDesaturate', PHOTO_DESATURATE_MAX * photo)
      setUniform(material, 'uMaxPointSize', maxPointSize * (1 - PHOTO_POINT_SHRINK * photo))
    }

    // 현재 별 포인트 크로스페이드 — 구체(StarSurface)는 항상 렌더되므로 카메라 거리로
    // 항상 핸드오프한다. 가까우면 구체, 멀면(퍼스펙티브 줌아웃) 포인트로 (결정 41-c).
    let currentFade = 1
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
    setUniform(material, 'uCurrentFade', currentFade)
  })

  return <points geometry={geometry} material={material} />
}
