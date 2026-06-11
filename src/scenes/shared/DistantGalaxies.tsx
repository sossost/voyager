import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { AdditiveBlending, CanvasTexture, type Group, MeshBasicMaterial } from 'three'

/**
 * 원거리 배경 은하 — 우리 은하 바깥의 빈 검정을 채우는 장식 레이어 (백로그 E-1, 결정 24).
 *
 * 절차 베이크한 스머지 텍스처 1장을 빌보드 쿼드 몇 장으로 띄운다. 좌표는 은하 중심 기준.
 * 은하 전도(map) 전용 — 우주선 뷰·별계 씬은 균일 별밭(DecorativeStarfield)이 하늘을
 * 채운다 (백로그 G-a-2: 함내 시점에서는 "지도 장식"이 아니라 별이 보여야 한다).
 * 렌더 전용 — 시드·생성 분포와 무관하며 피킹(화면공간 별 클릭) 대상이 아니다.
 */

/** 스머지 텍스처 한 변(px) — 라디얼 그라디언트라 저해상도로 충분하다. */
const TEXTURE_SIZE = 192

interface DistantGalaxyConfig {
  /** 키 겸 식별자. */
  readonly id: string
  /** 하늘 방향 (정규화 전) — 셸 위 위치는 direction × distance. */
  readonly direction: readonly [number, number, number]
  /**
   * 셸 반경 (월드 단위) — 최대 줌아웃(6,000) 밖, 카메라 far(30,000) 안.
   * 상한 24,000: 별계 씬의 은하 중심 역오프셋(최대 ~4,800) + 쿼드 반폭을 더해도
   * far 평면을 넘지 않아야 한다 (24,000 + 4,800 + 850 ≈ 29,650 < 30,000).
   */
  readonly distance: number
  /** 쿼드 장축의 월드 크기. */
  readonly size: number
  /** 단축/장축 비 — 기울어진 원반 은하의 타원감 (1 = 정면 원형). */
  readonly aspect: number
  /** 면내 회전 (라디안). */
  readonly spin: number
  readonly tint: string
  readonly opacity: number
}

const DISTANT_GALAXIES: readonly DistantGalaxyConfig[] = [
  { id: 'spiral-high', direction: [0.55, 0.45, -0.7], distance: 18_000, size: 1_800, aspect: 0.42, spin: 0.6, tint: '#aebfff', opacity: 0.5 },
  { id: 'warm-west', direction: [-0.8, 0.25, -0.45], distance: 21_000, size: 1_300, aspect: 0.85, spin: 2.4, tint: '#ffd9b3', opacity: 0.42 },
  { id: 'dim-under', direction: [0.15, -0.6, -0.75], distance: 16_000, size: 900, aspect: 0.55, spin: 1.2, tint: '#c9d4ff', opacity: 0.38 },
  { id: 'edge-on-north', direction: [-0.35, 0.75, 0.55], distance: 23_000, size: 2_200, aspect: 0.3, spin: -0.9, tint: '#9fb0ff', opacity: 0.45 },
  { id: 'warm-east', direction: [0.9, -0.2, 0.35], distance: 19_000, size: 1_100, aspect: 0.7, spin: 0.2, tint: '#ffeede', opacity: 0.36 },
  { id: 'violet-south', direction: [0.05, 0.35, 0.95], distance: 17_000, size: 750, aspect: 0.9, spin: 1.8, tint: '#b9a8ff', opacity: 0.34 },
  { id: 'pale-low', direction: [-0.6, -0.45, 0.6], distance: 22_000, size: 1_500, aspect: 0.5, spin: -1.5, tint: '#cfe0ff', opacity: 0.4 },
  { id: 'speck-zenith', direction: [0.4, 0.85, -0.2], distance: 20_000, size: 650, aspect: 1, spin: 0, tint: '#ffffff', opacity: 0.3 },
  { id: 'tilted-nw', direction: [-0.15, 0.55, -0.85], distance: 19_500, size: 1_000, aspect: 0.6, spin: 2.1, tint: '#bcd0ff', opacity: 0.36 },
  { id: 'amber-up', direction: [0.75, 0.6, 0.3], distance: 24_000, size: 1_400, aspect: 0.38, spin: -2.6, tint: '#ffd0a6', opacity: 0.33 },
  { id: 'far-west-rim', direction: [-0.95, -0.1, -0.2], distance: 24_000, size: 1_700, aspect: 0.48, spin: 0.9, tint: '#a8baff', opacity: 0.3 },
  { id: 'speck-deep-south', direction: [0.3, -0.8, 0.4], distance: 21_500, size: 550, aspect: 0.85, spin: 1.4, tint: '#e6ecff', opacity: 0.28 },
  { id: 'speck-nw-low', direction: [-0.5, 0.3, -0.85], distance: 23_500, size: 480, aspect: 1, spin: 0.4, tint: '#ffffff', opacity: 0.26 },
  { id: 'violet-east', direction: [0.65, 0.15, 0.75], distance: 18_500, size: 850, aspect: 0.52, spin: -1.1, tint: '#c3b2ff', opacity: 0.32 },
  { id: 'pale-se', direction: [-0.25, -0.3, 0.9], distance: 23_500, size: 1_200, aspect: 0.7, spin: 2.9, tint: '#d6e2ff', opacity: 0.3 },
  { id: 'speck-apex', direction: [0.1, 0.9, 0.45], distance: 22_500, size: 520, aspect: 0.9, spin: 0.7, tint: '#fff3e4', opacity: 0.27 },
]

/** direction을 정규화해 셸 위 월드 좌표로. */
function shellPosition(config: DistantGalaxyConfig): readonly [number, number, number] {
  const [dx, dy, dz] = config.direction
  const length = Math.sqrt(dx * dx + dy * dy + dz * dz)
  return [
    (dx / length) * config.distance,
    (dy / length) * config.distance,
    (dz / length) * config.distance,
  ]
}

/** 밝은 코어 + 옅은 외곽 헤이즈의 라디얼 스머지 — 작게 보이면 원거리 은하로 읽힌다. */
function buildGalaxySmudgeTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = TEXTURE_SIZE
  canvas.height = TEXTURE_SIZE
  const context = canvas.getContext('2d')
  if (context == null) throw new Error('배경 은하 텍스처용 2D 컨텍스트를 만들 수 없습니다')

  const center = TEXTURE_SIZE / 2
  const gradient = context.createRadialGradient(center, center, 0, center, center, center)
  gradient.addColorStop(0, 'rgba(255, 248, 238, 0.95)')
  gradient.addColorStop(0.12, 'rgba(228, 232, 255, 0.55)')
  gradient.addColorStop(0.45, 'rgba(168, 184, 255, 0.16)')
  gradient.addColorStop(1, 'rgba(120, 140, 255, 0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE)

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = 'srgb'
  return texture
}

/**
 * 텍스처·머티리얼은 앱 수명 모듈 캐시 — 씬 전환(은하↔별계)마다 컴포넌트가
 * 리마운트되므로 재베이크·GPU 재업로드를 막는다 (useGalaxyStars 캐시와 같은 트레이드오프).
 * 지연 초기화: import 시점엔 document가 보장되지 않는다.
 */
let cachedMaterials: readonly MeshBasicMaterial[] | null = null

function getDistantGalaxyMaterials(): readonly MeshBasicMaterial[] {
  if (cachedMaterials != null) return cachedMaterials

  const texture = buildGalaxySmudgeTexture()
  cachedMaterials = DISTANT_GALAXIES.map(
    (config) =>
      new MeshBasicMaterial({
        map: texture,
        color: config.tint,
        transparent: true,
        opacity: config.opacity,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
  )
  return cachedMaterials
}

export function DistantGalaxies() {
  const groupRefs = useRef<(Group | null)[]>([])
  const materials = getDistantGalaxyMaterials()

  // 빌보드 — 그룹이 카메라를 바라보고, 자식 메시가 면내 회전·타원 스케일을 가진다
  useFrame((state) => {
    for (const group of groupRefs.current) {
      if (group != null) group.quaternion.copy(state.camera.quaternion)
    }
  })

  return (
    <>
      {DISTANT_GALAXIES.map((config, index) => (
        <group
          key={config.id}
          ref={(element) => {
            groupRefs.current[index] = element
          }}
          position={shellPosition(config)}
        >
          <mesh
            material={materials[index]}
            rotation={[0, 0, config.spin]}
            scale={[config.size, config.size * config.aspect, 1]}
          >
            <planeGeometry args={[1, 1]} />
          </mesh>
        </group>
      ))}
    </>
  )
}
