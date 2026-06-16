import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, type Group, type Mesh, ShaderMaterial, Vector3 } from 'three'

import { setUniform } from '@/scenes/shared/starGlowMaterial'
import { AccretionDisk } from '@/scenes/system/AccretionDisk'
import { crossfadeProgress } from '@/scenes/system/starCrossfade'
import { useGameStore } from '@/store'

/**
 * 블랙홀 — 페이크 적층(결정 5): ① 깨끗한 검은 사건지평선 구(결정 31) ② 월드 고정 차등 회전
 * 강착원반(AccretionDisk) ③ 카메라 향하는 EHT식 비대칭 포톤 링(사건지평선을 두르는 밝은 고리).
 *
 * 포톤 링은 *얇고 대칭(원형)* 이라 시점을 돌려도 기울어진 원반처럼 "따라 도는" 어색함이 없다 —
 * EHT M87 사진처럼 검은 원을 두른 비대칭 밝은 고리(도플러로 한쪽이 밝음)로 "블랙홀"로 또렷이
 * 읽힌다. 풀스크린 중력렌즈 없음(모바일 안전). 진짜 렌즈는 high 티어 후순위.
 */

const SPHERE_SEGMENTS = 48
/** 포톤 링 빌보드 한 변 = 본체 반경 × 이 배수. */
const RING_QUAD_FACTOR = 2.3

const RING_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

// 사건지평선 바로 바깥(정규화 r ≈ 0.45)을 두르는 얇은 밝은 링. 도플러로 한쪽이 더 밝고
// 상단도 약간 밝다(렌즈 룩). 대칭 원형이라 빌보드여도 어색하지 않다 (결정 31 — 감싸는 막 아님).
const RING_FRAGMENT_SHADER = /* glsl */ `
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float r = length(p);
    vec2 dir = r > 0.0001 ? p / r : vec2(0.0, 1.0);   // NaN 안전

    float d = (r - 0.45) / 0.035;
    float ring = exp(-d * d);

    // 비대칭 — 도플러(가로) + 상단(세로) 약간 더 밝게 (EHT/렌즈 룩)
    float asym = 0.5 + 0.5 * (0.72 * dir.x + 0.28 * dir.y);
    float intensity = ring * (0.32 + 0.95 * asym);

    vec3 col = vec3(1.0, 0.93, 0.8);  // 뜨거운 백황
    gl_FragColor = vec4(col * intensity, intensity * uOpacity);
  }
`

interface BlackHoleProps {
  /** 사건지평선 반경 (= STAR_VISUAL_RADIUS × kindRadiusFactor('black_hole')). */
  readonly radius: number
}

export function BlackHole({ radius }: BlackHoleProps) {
  const ringGroupRef = useRef<Group>(null)
  const ringMeshRef = useRef<Mesh>(null)
  const worldScratch = useMemo(() => new Vector3(), [])
  // high 티어에선 측지선 레이마칭(포스트 패스)이 블랙홀 전체를 그린다 → 렌더 본체는 그리지 않는다
  // (입력 버퍼를 깨끗한 배경으로 유지해 렌즈가 샘플). medium/low는 페이크(구·원반·EHT 링)를 그린다.
  const renderFake = useGameStore((state) => state.qualityTier !== 'high')

  const ringMaterial = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: RING_VERTEX_SHADER,
        fragmentShader: RING_FRAGMENT_SHADER,
        uniforms: { uOpacity: { value: 1 } },
        transparent: true,
        depthWrite: false,
        depthTest: false, // 사건지평선 구 위에 항상 그려 silhouette을 두른다
        blending: AdditiveBlending,
      }),
    [],
  )

  useEffect(() => () => ringMaterial.dispose(), [ringMaterial])

  useFrame((state) => {
    // 포톤 링 빌보드 — 카메라를 향하지만 대칭 원형이라 자연스럽다.
    ringGroupRef.current?.quaternion.copy(state.camera.quaternion)
    if (ringMeshRef.current != null) {
      const distance = state.camera.position.distanceTo(
        ringMeshRef.current.getWorldPosition(worldScratch),
      )
      setUniform(ringMaterial, 'uOpacity', 1 - crossfadeProgress(distance))
    }
  })

  const ringSize = radius * RING_QUAD_FACTOR

  // high 티어는 레이마칭 포스트 패스가 전담 — 본체 렌더 생략.
  if (!renderFake) return null

  return (
    <>
      {/* 사건지평선 — 깨끗한 불투명 검은 구. renderOrder=-1로 디스크보다 먼저 그려 far side를 가린다. */}
      <mesh renderOrder={-1}>
        <sphereGeometry args={[radius, SPHERE_SEGMENTS, SPHERE_SEGMENTS]} />
        <meshBasicMaterial color="#000000" />
      </mesh>

      <AccretionDisk radius={radius} />

      {/* EHT 포톤 링 — 사건지평선을 두르는 밝은 비대칭 고리. depthTest off로 구 위에. */}
      <group ref={ringGroupRef}>
        <mesh ref={ringMeshRef} material={ringMaterial} renderOrder={1}>
          <planeGeometry args={[ringSize, ringSize]} />
        </mesh>
      </group>
    </>
  )
}
