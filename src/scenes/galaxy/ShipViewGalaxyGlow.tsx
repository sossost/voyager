import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  BackSide,
  CanvasTexture,
  type Group,
  MeshBasicMaterial,
  RepeatWrapping,
} from 'three'

import {
  BAND_HALF_HEIGHT,
  BAND_RADIUS,
  type BandPanoramaJob,
  bandPanoramaKey,
  createBandPanoramaJob,
} from '@/scenes/galaxy/galaxyBandPanorama'

/**
 * 우주선 뷰 은하 광원감 (백로그 G-b-6, 결정 38) — 함내에서 은하가 "별 점의 집합"이
 * 아니라 "빛 덩어리"로 읽히게 하는 두 레이어:
 *
 * ① 원반 밴드 — 정박 별을 중심으로 한 실린더 안쪽 면에, (방위각 × 고도) 3D 광선
 *    적분 파노라마(galaxyBandPanorama)를 붙인다. 벌지 돔·렌즈형 두께·클럼프 얼룩이
 *    실제 밀도에서 나온다. 저해상 프리뷰를 즉시 띄우고 고해상은 프레임 예산으로
 *    정련해 완료 시 스왑한다 (결정 33의 프레임 분산 베이크와 같은 철학).
 * ② 코어 글로우 — 은하 중심의 가산 빌보드 1장 (DistantGalaxies 스머지 패턴).
 *
 * 결정 28에서 점·입자 접근이 두 차례 기각된 자리다 — GalaxyNebula(결정 23)처럼
 * 연속 텍스처 + 가산 블렌딩만 쓴다. 우주선 뷰·워프 전용 (전도는 GalaxyNebula 담당).
 * 렌더 전용 — 시드 생성 분포·GEN_VERSION·저장 포맷과 무관하다.
 */

const BAND_HEIGHT = BAND_HALF_HEIGHT * 2
/** 실린더 둘레 분할 — 반경 10,500에서 다각형 모서리가 보이지 않는 최소선 (지오메트리 1회 업로드). */
const BAND_RADIAL_SEGMENTS = 96
const BAND_HEIGHT_SEGMENTS = 1
/** 뚜껑 없는 열린 실린더 — 안쪽 면(BackSide)만 쓴다. */
const BAND_OPEN_ENDED = true
const BAND_OPACITY = 0.4
/** 고해상 정련의 프레임당 시간 예산(ms) — 저사양에서도 PerformanceMonitor를 자극하지 않는 선. */
const REFINE_BUDGET_MS = 2

/** 코어 글로우 텍스처 한 변(px) — 라디얼 그라디언트라 저해상도로 충분하다. */
const CORE_TEXTURE_SIZE = 256
/** 코어 글로우 월드 크기 — 벌지 지름(1,200)을 살짝 감싸는 헤일로. */
const CORE_BASE_SIZE = 1_800
/** 화면 각크기 상한 (크기/거리) — 글로우는 벌지 별 무리의 심지여야지 하늘을 덮으면 "구체"로 읽힌다. */
const CORE_MAX_ANGULAR_RATIO = 0.22
const CORE_OPACITY = 0.45
/** 벌지 안쪽까지 들어가면 "중심 방향의 빛"이라는 빌보드의 전제가 깨진다 — 근접 페이드. */
const CORE_FADE_NEAR = 700
const CORE_FADE_FAR = 1_600

function clamp01(value: number): number {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp01((value - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

function toBandTexture(canvas: HTMLCanvasElement): CanvasTexture {
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = 'srgb'
  // 방위각은 한 바퀴 — 기본 ClampToEdge면 0°/360° 경계에서 보간이 끊겨 수직 솔기가 보인다
  texture.wrapS = RepeatWrapping
  return texture
}

/**
 * 밴드 텍스처 단일 캐시 — 같은 정박 별이면 씬 전환(은하↔항성계) 리마운트에도 재베이크하지
 * 않는다 (DistantGalaxies 캐시와 같은 트레이드오프). 정박이 바뀌어 밀려난 텍스처는
 * 즉시 dispose하지 않고 적치한다 — 렌더 단계에서 파괴적 부수효과를 일으키면 동시성
 * 재렌더에서 표시 중인 텍스처를 폐기할 수 있어, 폐기는 커밋 이후(useEffect·useFrame)에 한다.
 */
interface CachedBand {
  readonly key: string
  readonly texture: CanvasTexture
  /** 고해상 정련까지 끝난 텍스처인가 — false면 재마운트 시 정련을 재시작한다. */
  readonly isRefined: boolean
}

let cachedBand: CachedBand | null = null
const evictedBandTextures: CanvasTexture[] = []

interface BandAcquisition {
  readonly texture: CanvasTexture
  /** 진행할 고해상 정련 작업 — 캐시가 이미 정련본이면 null. */
  readonly job: BandPanoramaJob | null
}

function acquireBandTexture(anchor: readonly [number, number, number]): BandAcquisition {
  const key = bandPanoramaKey(anchor)
  if (cachedBand != null && cachedBand.key === key) {
    // 정련이 끝나기 전에 떠났다 돌아온 경우 — 프리뷰는 캐시에 있으니 정련만 재시작
    const job = cachedBand.isRefined
      ? null
      : createBandPanoramaJob(anchor, { withPreview: false })
    return { texture: cachedBand.texture, job }
  }

  if (cachedBand != null) evictedBandTextures.push(cachedBand.texture)
  const job = createBandPanoramaJob(anchor, { withPreview: true })
  if (job.preview == null) throw new Error('은하 밴드 프리뷰 베이크가 비어 있습니다')
  const texture = toBandTexture(job.preview)
  cachedBand = { key, texture, isRefined: false }
  return { texture, job }
}

/**
 * 정련 완료 커밋 — 키가 현재 캐시와 일치할 때만 최종 텍스처로 교체한다(성공 시 true).
 * 정박이 이미 바뀐 늦은 정련본은 캐시를 건드리지 않고 적치만 한다 — 키 불일치
 * 커밋이 캐시를 덮어쓰면 새 정박의 텍스처가 고아가 된다(GPU 누수).
 */
function commitRefinedBand(key: string, texture: CanvasTexture): boolean {
  if (cachedBand == null || cachedBand.key !== key) {
    evictedBandTextures.push(texture)
    return false
  }
  evictedBandTextures.push(cachedBand.texture)
  cachedBand = { key, texture, isRefined: true }
  return true
}

function disposeEvictedBandTextures(): void {
  for (const texture of evictedBandTextures) texture.dispose()
  evictedBandTextures.length = 0
}

/** 코어 글로우 — 밝은 난색 심 + 옅은 외곽 헤이즈의 라디얼 스머지 (앱 수명 캐시). */
let cachedCoreTexture: CanvasTexture | null = null

function getCoreGlowTexture(): CanvasTexture {
  if (cachedCoreTexture != null) return cachedCoreTexture

  const canvas = document.createElement('canvas')
  canvas.width = CORE_TEXTURE_SIZE
  canvas.height = CORE_TEXTURE_SIZE
  const context = canvas.getContext('2d')
  if (context == null) throw new Error('코어 글로우 텍스처용 2D 컨텍스트를 만들 수 없습니다')

  // 에너지를 심에 모은다 — 외곽이 살아 있으면 가장자리 림이 보여 "원반"으로 읽힌다
  const center = CORE_TEXTURE_SIZE / 2
  const gradient = context.createRadialGradient(center, center, 0, center, center, center)
  gradient.addColorStop(0, 'rgba(255, 242, 220, 0.9)')
  gradient.addColorStop(0.15, 'rgba(255, 218, 168, 0.4)')
  gradient.addColorStop(0.4, 'rgba(255, 196, 136, 0.1)')
  gradient.addColorStop(0.75, 'rgba(255, 185, 125, 0.02)')
  gradient.addColorStop(1, 'rgba(255, 180, 120, 0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, CORE_TEXTURE_SIZE, CORE_TEXTURE_SIZE)

  cachedCoreTexture = new CanvasTexture(canvas)
  cachedCoreTexture.colorSpace = 'srgb'
  return cachedCoreTexture
}

interface ShipViewGalaxyGlowProps {
  /** 정박 별 월드 좌표 — 밴드 파노라마의 시점이자 실린더 중심. */
  readonly anchor: readonly [number, number, number]
}

export function ShipViewGalaxyGlow({ anchor }: ShipViewGalaxyGlowProps) {
  const coreGroupRef = useRef<Group>(null)
  /** 이미 스왑까지 끝낸 job — 완료된 job의 refine/compose 재호출을 막는다. */
  const completedJobRef = useRef<BandPanoramaJob | null>(null)

  const acquisition = useMemo(() => acquireBandTexture(anchor), [anchor])

  const bandMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        map: acquisition.texture,
        transparent: true,
        opacity: BAND_OPACITY,
        blending: AdditiveBlending,
        depthWrite: false,
        side: BackSide,
      }),
    [acquisition.texture],
  )
  const coreMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        map: getCoreGlowTexture(),
        transparent: true,
        opacity: CORE_OPACITY,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  )

  useEffect(() => () => bandMaterial.dispose(), [bandMaterial])
  useEffect(() => () => coreMaterial.dispose(), [coreMaterial])
  // 캐시에서 밀려난 이전 정박의 텍스처를 커밋 후 폐기 — 새 텍스처가 화면에 붙은 뒤라 안전
  useEffect(() => disposeEvictedBandTextures(), [acquisition])

  useFrame((state) => {
    // 고해상 정련 — 프레임 예산만큼 굽고, 완료되면 머티리얼에 직접 스왑
    // (1회성 교체라 store/리렌더가 필요 없다 — 철칙 6의 ref 원칙).
    // job·머티리얼·키를 같은 렌더 클로저에서 받으므로 항상 같은 정박의 쌍이다 —
    // ref로 건너 무장하면 앵커 변경 프레임에 낡은 job이 새 머티리얼에 쓰는 레이스가 생긴다.
    const job = acquisition.job
    if (job != null && completedJobRef.current !== job && job.refine(REFINE_BUDGET_MS)) {
      completedJobRef.current = job
      const refined = toBandTexture(job.composeFinal())
      if (commitRefinedBand(bandPanoramaKey(anchor), refined)) {
        bandMaterial.map = refined
        bandMaterial.needsUpdate = true
        disposeEvictedBandTextures()
      }
    }

    // 코어 빌보드 — 카메라 응시 + 각크기 클램프 + 근접 페이드 (연속 값은 ref, 철칙 6)
    const group = coreGroupRef.current
    if (group == null) return

    group.quaternion.copy(state.camera.quaternion)
    const coreDistance = state.camera.position.length() // 은하 중심 = 월드 원점
    group.scale.setScalar(Math.min(CORE_BASE_SIZE, coreDistance * CORE_MAX_ANGULAR_RATIO))
    coreMaterial.opacity =
      CORE_OPACITY * smoothstep(CORE_FADE_NEAR, CORE_FADE_FAR, coreDistance)
  })

  return (
    <>
      {/* 원반 밴드 — 실린더 중심은 정박 별의 평면 좌표, 수직 중심은 원반면(y=0) */}
      <mesh position={[anchor[0], 0, anchor[2]]} material={bandMaterial}>
        <cylinderGeometry
          args={[
            BAND_RADIUS,
            BAND_RADIUS,
            BAND_HEIGHT,
            BAND_RADIAL_SEGMENTS,
            BAND_HEIGHT_SEGMENTS,
            BAND_OPEN_ENDED,
          ]}
        />
      </mesh>
      <group ref={coreGroupRef}>
        <mesh material={coreMaterial}>
          <planeGeometry args={[1, 1]} />
        </mesh>
      </group>
    </>
  )
}
