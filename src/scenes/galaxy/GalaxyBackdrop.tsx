import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { BufferGeometry, Float32BufferAttribute } from 'three'

import {
  GALAXY_HALF_THICKNESS_SECTORS,
  GALAXY_RADIUS_SECTORS,
  hash01,
  SECTOR_SIZE,
  sectorDensity,
} from '@/engine'
import { QUALITY_PRESETS } from '@/quality/presets'
import {
  createStarGlowMaterial,
  setUniform,
  setVector3Uniform,
} from '@/scenes/shared/starGlowMaterial'
import { useGameStore } from '@/store'

/** 이 밀도 미만은 점을 만들지 않는다 — 팔 사이 공간이 어두워야 나선 레인이 읽힌다. */
const MIN_VISIBLE_DENSITY = 0.03
const BACKDROP_OPACITY = 0.7
/**
 * 최대 줌아웃(6,000 유닛)에서 이웃 샘플(화면 ~16px 간격)과 글로우가 겹치는 크기 —
 * 원근 계수 700/6000 ≈ 0.12라 size 100이 화면 ~18px이다. 근접 시에는 uMaxPointSize가 캡.
 */
const BACKDROP_BASE_SIZE = 80
const BACKDROP_DENSITY_SIZE_SPAN = 120
/** 밀도→밝기 증폭 — 팔(≈0.2)과 팔 사이(≈0.03)의 대비를 화면 밝기로 키운다. */
const BRIGHTNESS_FLOOR = 0.2
const BRIGHTNESS_DENSITY_GAIN = 2.2

/** 격자 패턴을 깨는 결정론적 지터 솔트 — hash01의 y축을 채널 구분에 쓴다. */
const JITTER_SALT = 101
const JITTER_CHANNEL_X = 11
const JITTER_CHANNEL_Y = 33
const JITTER_CHANNEL_Z = 22
const JITTER_CHANNEL_SIZE = 44
/** 수직 산포 최대 비율 — 원반 절반 두께 대비. 밀도가 높을수록 두껍게 부푼다. */
const VERTICAL_SPREAD_RATIO = 0.5

/**
 * 카메라 근접 페이드인 반경 (월드 단위) — 이 안의 백드롭 글로우는 숨긴다.
 * 근경(SectorPoints)이 담당하는 영역에서 원경 블롭이 별밭을 가리는 것을 막는다.
 */
const NEAR_FADE_INNER = 500
const NEAR_FADE_OUTER = 1_800

/** 벌지(중심) 난색 → 나선팔(외곽) 한색 — 이 반경(섹터)에 걸쳐 섞는다. */
const COLOR_BLEND_RADIUS_SECTORS = 10
const BULGE_COLOR = [1.0, 0.82, 0.6] as const
const ARM_COLOR = [0.5, 0.58, 0.92] as const

function clamp01(value: number): number {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

/**
 * 은하 원경 — 밀도 함수를 굵게 샘플링한 1드로콜 글로우 점구름.
 * 로드 반경 밖에서도 은하의 나선팔·벌지 형상이 보이게 한다 (줌아웃 조망).
 * 지터·산포는 hash01 기반 결정론 — 모든 플레이어가 같은 원경을 본다.
 * 샘플 간격·점 크기 캡은 품질 티어가 통제한다 (fill-rate가 모바일 병목, 결정 12).
 */
export function GalaxyBackdrop() {
  const qualityTier = useGameStore((state) => state.qualityTier)
  const { backdropStride, backdropMaxPointSize } = QUALITY_PRESETS[qualityTier]

  const geometry = useMemo(() => {
    const positions: number[] = []
    const colors: number[] = []
    const sizes: number[] = []
    const jitterSpan = backdropStride * SECTOR_SIZE

    for (let sx = -GALAXY_RADIUS_SECTORS; sx <= GALAXY_RADIUS_SECTORS; sx += backdropStride) {
      for (let sz = -GALAXY_RADIUS_SECTORS; sz <= GALAXY_RADIUS_SECTORS; sz += backdropStride) {
        const density = sectorDensity({ sx, sy: 0, sz })
        if (density < MIN_VISIBLE_DENSITY) continue

        const jitterX = (hash01(sx, JITTER_CHANNEL_X, sz, JITTER_SALT) - 0.5) * jitterSpan
        const jitterZ = (hash01(sx, JITTER_CHANNEL_Z, sz, JITTER_SALT) - 0.5) * jitterSpan
        const verticalSpread =
          (hash01(sx, JITTER_CHANNEL_Y, sz, JITTER_SALT) - 0.5) *
          2 *
          GALAXY_HALF_THICKNESS_SECTORS *
          SECTOR_SIZE *
          VERTICAL_SPREAD_RATIO *
          (0.3 + 0.7 * density)

        positions.push(sx * SECTOR_SIZE + jitterX, verticalSpread, sz * SECTOR_SIZE + jitterZ)

        const radius = Math.sqrt(sx * sx + sz * sz)
        const warmth = clamp01(1 - radius / COLOR_BLEND_RADIUS_SECTORS)
        const brightness = clamp01(BRIGHTNESS_FLOOR + density * BRIGHTNESS_DENSITY_GAIN)
        colors.push(
          (ARM_COLOR[0] + (BULGE_COLOR[0] - ARM_COLOR[0]) * warmth) * brightness,
          (ARM_COLOR[1] + (BULGE_COLOR[1] - ARM_COLOR[1]) * warmth) * brightness,
          (ARM_COLOR[2] + (BULGE_COLOR[2] - ARM_COLOR[2]) * warmth) * brightness,
        )
        // 크기 지터 — 균일한 방울 패턴을 깨서 성운처럼 읽히게 한다
        const sizeJitter = 0.6 + 0.8 * hash01(sx, JITTER_CHANNEL_SIZE, sz, JITTER_SALT)
        sizes.push((BACKDROP_BASE_SIZE + density * BACKDROP_DENSITY_SIZE_SPAN) * sizeJitter)
      }
    }

    const built = new BufferGeometry()
    built.setAttribute('position', new Float32BufferAttribute(positions, 3))
    built.setAttribute('starColor', new Float32BufferAttribute(colors, 3))
    built.setAttribute('size', new Float32BufferAttribute(sizes, 1))
    return built
  }, [backdropStride])

  const material = useMemo(
    () =>
      createStarGlowMaterial({
        maxPointSize: backdropMaxPointSize,
        initialOpacity: BACKDROP_OPACITY,
        fadeInner: NEAR_FADE_INNER,
        fadeOuter: NEAR_FADE_OUTER,
        fadeInvert: true,
      }),
    [backdropMaxPointSize],
  )

  useFrame((state) => {
    setUniform(material, 'uPixelRatio', state.gl.getPixelRatio())
    // 근접 페이드 기준 = 카메라 위치 — 코앞의 원경 블롭만 숨기고 먼 은하 글로우는 남긴다
    const cameraPosition = state.camera.position
    setVector3Uniform(material, 'uFadeCenter', cameraPosition.x, cameraPosition.y, cameraPosition.z)
  })

  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])

  return <points geometry={geometry} material={material} />
}
