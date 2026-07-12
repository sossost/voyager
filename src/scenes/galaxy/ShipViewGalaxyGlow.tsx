import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, BackSide, CanvasTexture, MeshBasicMaterial, RepeatWrapping } from 'three'

import {
  BAND_HALF_HEIGHT,
  BAND_RADIUS,
  type BandPanoramaJob,
  bandPanoramaKey,
  createBandPanoramaJob,
} from '@/scenes/galaxy/galaxyBandPanorama'
import { enableLensEnvLayer } from '@/scenes/shared/lensEnvironment'

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
/** 은은한 존재감 (galaxy-realism-pass 최종) — 0.4는 뿌연 안개로 기각, 육안 은하수 수준으로. */
const BAND_OPACITY = 0.18
/**
 * 띠 거리 페이드 — 정박·항법 근거리에선 보이고, 줌아웃(은하 조망)하면 사라진다.
 * 항법뷰에서 축소 시 정박 별 중심의 띠가 배경에 둥 떠 부자연스러운 것을 막는다(사용자 지적).
 * 함교는 카메라-별 거리가 항상 ≈63(SHIP_DISTANCE)이라 늘 NEAR 안 → 띠가 그대로 보인다.
 */
const BAND_FADE_NEAR = 280
const BAND_FADE_FAR = 1_100
/**
 * 벌지 내부 정박의 밴드 감쇠 (galaxy-realism-pass) — 벌지 안 하늘의 사진 문법은 안개가
 * 아니라 빽빽한 황금 별밭(바데의 창)이다. 매끈한 저해상 베이크는 벌지 내부에선 어떤
 * 톤이어도 "베이지 벽/형광등"으로 읽히므로(실측 2회 기각), 밴드를 배경 잔광 수준으로
 * 낮추고 별 스펙클이 하늘을 끌고 가게 한다. 벌지 밖 정박은 무영향.
 */
const BULGE_ANCHOR_NEAR_WORLD = 300
const BULGE_ANCHOR_FAR_WORLD = 900
const BULGE_BAND_OPACITY_SCALE = 0.5
/** 고해상 정련의 프레임당 시간 예산(ms) — 저사양에서도 PerformanceMonitor를 자극하지 않는 선. */
const REFINE_BUDGET_MS = 2

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

interface ShipViewGalaxyGlowProps {
  /** 정박 별 월드 좌표 — 밴드 파노라마의 시점이자 실린더 중심. */
  readonly anchor: readonly [number, number, number]
}

export function ShipViewGalaxyGlow({ anchor }: ShipViewGalaxyGlowProps) {
  /** 이미 스왑까지 끝낸 job — 완료된 job의 refine/compose 재호출을 막는다. */
  const completedJobRef = useRef<BandPanoramaJob | null>(null)

  const acquisition = useMemo(() => acquireBandTexture(anchor), [anchor])

  // 벌지 내부 정박은 밴드를 잔광 수준으로 — 별밭이 하늘의 주인공 (위 상수 주석 참조).
  const anchorRadius = Math.hypot(anchor[0], anchor[2])
  const bulgeness = 1 - smoothstep(BULGE_ANCHOR_NEAR_WORLD, BULGE_ANCHOR_FAR_WORLD, anchorRadius)
  const bandOpacity = BAND_OPACITY * (1 - BULGE_BAND_OPACITY_SCALE * bulgeness)

  const bandMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        map: acquisition.texture,
        transparent: true,
        opacity: bandOpacity,
        blending: AdditiveBlending,
        depthWrite: false,
        side: BackSide,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- opacity는 useFrame이 매 프레임 재설정
    [acquisition.texture],
  )
  useEffect(() => () => bandMaterial.dispose(), [bandMaterial])
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

    // 띠 거리 페이드 — 카메라가 정박 별에서 멀어지면(항법 줌아웃) 띠를 걷어 은하 조망을
    // 깨끗하게 둔다. 함교(≈63u)·항법 근거리에선 NEAR 안이라 그대로 보인다.
    const bandDistance = Math.hypot(
      state.camera.position.x - anchor[0],
      state.camera.position.y - anchor[1],
      state.camera.position.z - anchor[2],
    )
    bandMaterial.opacity =
      bandOpacity * (1 - smoothstep(BAND_FADE_NEAR, BAND_FADE_FAR, bandDistance))

  })

  // 코어 글로우 빌보드는 제거됐다 (galaxy-realism-pass) — 완전 원형 방사 그라디언트가
  // "인공 광원"으로 읽혔다 (사용자 기각). 벌지 광은 밴드 파노라마의 밀도 적분이
  // 불규칙한 실구조(클럼프·소광)로 이미 그린다.
  return (
    /* 원반 밴드 — 실린더 중심은 정박 별의 평면 좌표, 수직 중심은 원반면(y=0) */
    <mesh position={[anchor[0], 0, anchor[2]]} material={bandMaterial} onUpdate={enableLensEnvLayer}>
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
  )
}
