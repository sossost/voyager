import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, CanvasTexture, type Group, MeshBasicMaterial } from 'three'

import { armRidgeAt, SECTOR_SIZE, sectorDensity } from '@/engine'
import { valueNoise3 } from '@/engine/noise/valueNoise'
import { ditherCanvas } from '@/scenes/shared/canvasDither'

/**
 * 성운 클러스터 (galaxy-realism-pass 최종안) — 성운을 실제 3D 위치에 배치하되(시차·
 * 원근 실물), 렌더는 점 구름이 아니라 **뿌연 연속 헤이즈**로 한다 (점 두드러기 기각).
 *
 * 형태 원칙: 원형 라디얼 그라디언트 금지 (인공 광원으로 읽혀 기각) — 노이즈 도메인
 * 워프로 실루엣 자체가 불규칙한 스프라이트를 굽고, 사이트마다 비등방 스케일(장축
 * 2~4배)·면내 회전을 다르게 준다. 발광(로즈)/반사(청) 2계열. 해시 결정론 — 시드 무관.
 */

const SITE_COUNT = 36
const SITE_TRIALS = 4_000
const SITE_RADIUS_MIN = 8
const SITE_RADIUS_MAX = 44
const SITE_ACCEPT_THRESHOLD = 0.22

/** 스프라이트 변형 수 — 같은 성운이 반복돼 보이지 않는 최소선 (텍스처 4장 캐시). */
const SPRITE_VARIANTS = 4
const SPRITE_SIZE_PX = 160

/** 비등방 월드 크기 — 장축/단축. 하늘 한 켠의 얼룩이지 하늘을 덮는 커튼이 아니다. */
const WIDTH_MIN = 180
const WIDTH_SPAN = 240
const ASPECT_MIN = 0.35
const ASPECT_SPAN = 0.35

const ROSE_TINT = '#ff8a9b'
const BLUE_TINT = '#9fbcff'
const OPACITY_MIN = 0.05
const OPACITY_SPAN = 0.08

function hash01(n: number): number {
  const value = Math.sin(n) * 43758.5453
  return value - Math.floor(value)
}

function gaussianish(seed: number): number {
  return (hash01(seed) + hash01(seed + 0.37) + hash01(seed + 0.71) + hash01(seed + 1.13) - 2) / 2
}

function clamp01(value: number): number {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

/** 2옥타브 fbm — 스프라이트 내부 구조·실루엣용. */
function fbm2(x: number, y: number, salt: number): number {
  return valueNoise3(x, y, 0.5, salt) * 0.65 + valueNoise3(x * 2.3, y * 2.3, 1.7, salt + 1) * 0.35
}

/**
 * 불규칙 성운 스프라이트 — 도메인 워프(좌표를 노이즈로 비틀기)로 실루엣이 원이 아니라
 * 찢긴 구름 조각이 된다. 그레이스케일 발광 × 알파 — 색은 머티리얼 틴트가 입힌다.
 */
function bakeNebulaSprite(variant: number): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = SPRITE_SIZE_PX
  canvas.height = SPRITE_SIZE_PX
  const context = canvas.getContext('2d')
  if (context == null) throw new Error('성운 스프라이트용 2D 컨텍스트를 만들 수 없습니다')

  const image = context.createImageData(SPRITE_SIZE_PX, SPRITE_SIZE_PX)
  const salt = 31 + variant * 7
  for (let py = 0; py < SPRITE_SIZE_PX; py++) {
    for (let px = 0; px < SPRITE_SIZE_PX; px++) {
      const nx = (px / SPRITE_SIZE_PX) * 2 - 1
      const ny = (py / SPRITE_SIZE_PX) * 2 - 1

      // 도메인 워프 — 반경 판정 좌표 자체를 비틀어 원형 실루엣을 깬다
      const warpX = nx + (valueNoise3(nx * 1.9, ny * 1.9, 3.1, salt + 2) - 0.5) * 1.1
      const warpY = ny + (valueNoise3(nx * 1.9, ny * 1.9, 7.4, salt + 3) - 0.5) * 1.1
      const radial = Math.sqrt(warpX * warpX + warpY * warpY)

      const body = fbm2(nx * 2.6, ny * 2.6, salt)
      // 노이즈 문턱 × 워프 반경 감쇠 — 가장자리가 찢기고 내부에 농담이 생긴다.
      // 쿼드 경계 강제 0 — 워프 좌표는 모서리에서 알파를 남길 수 있어 비워프 좌표로 잘라낸다.
      const edgeGuard = clamp01((1 - Math.max(Math.abs(nx), Math.abs(ny))) * 3.5)
      const alpha = clamp01((body * 1.5 - 0.42) * clamp01(1.15 - radial) * 1.6) * edgeGuard
      const glow = 165 + 90 * fbm2(nx * 4.1 + 9, ny * 4.1 - 5, salt + 4)

      const offset = (py * SPRITE_SIZE_PX + px) * 4
      image.data[offset] = glow
      image.data[offset + 1] = glow
      image.data[offset + 2] = glow
      image.data[offset + 3] = Math.round(alpha * 255)
    }
  }
  context.putImageData(image, 0, 0)
  ditherCanvas(context)

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = 'srgb'
  return texture
}

interface NebulaSite {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly spin: number
  readonly width: number
  readonly height: number
  readonly variant: number
  readonly isRose: boolean
  readonly opacity: number
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

    const width = WIDTH_MIN + WIDTH_SPAN * hash01(seed + 5)
    sites.push({
      x: sx * SECTOR_SIZE,
      y: gaussianish(seed + 3) * 60,
      z: sz * SECTOR_SIZE,
      spin: hash01(seed + 4) * Math.PI * 2,
      width,
      height: width * (ASPECT_MIN + ASPECT_SPAN * hash01(seed + 6)),
      variant: Math.floor(hash01(seed + 8) * SPRITE_VARIANTS) % SPRITE_VARIANTS,
      isRose: hash01(seed + 7) < 0.55,
      opacity: OPACITY_MIN + OPACITY_SPAN * hash01(seed + 9),
    })
  }
  return sites
}

/** 텍스처·머티리얼 앱 수명 캐시 — 씬 전환 리마운트마다 재베이크하지 않는다. */
let cachedTextures: readonly CanvasTexture[] | null = null

function getSpriteTextures(): readonly CanvasTexture[] {
  if (cachedTextures != null) return cachedTextures
  cachedTextures = Array.from({ length: SPRITE_VARIANTS }, (_, variant) =>
    bakeNebulaSprite(variant),
  )
  return cachedTextures
}

export function NebulaClusters() {
  const groupRefs = useRef<(Group | null)[]>([])
  const sites = useMemo(() => sampleSites(), [])
  const textures = getSpriteTextures()

  const materials = useMemo(
    () =>
      sites.map(
        (site) =>
          new MeshBasicMaterial({
            map: textures[site.variant],
            color: site.isRose ? ROSE_TINT : BLUE_TINT,
            transparent: true,
            opacity: site.opacity,
            blending: AdditiveBlending,
            depthWrite: false,
          }),
      ),
    [sites, textures],
  )

  useEffect(
    () => () => {
      for (const material of materials) material.dispose()
    },
    [materials],
  )

  // 빌보드 — 그룹이 카메라를 바라보고, 자식 메시가 면내 회전·비등방 스케일을 가진다
  useFrame((state) => {
    for (const group of groupRefs.current) {
      if (group != null) group.quaternion.copy(state.camera.quaternion)
    }
  })

  return (
    <>
      {sites.map((site, index) => (
        <group
          key={index}
          position={[site.x, site.y, site.z]}
          ref={(node) => {
            groupRefs.current[index] = node
          }}
        >
          <mesh material={materials[index]} rotation={[0, 0, site.spin]} scale={[site.width, site.height, 1]}>
            <planeGeometry args={[1, 1]} />
          </mesh>
        </group>
      ))}
    </>
  )
}
