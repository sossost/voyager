import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  type Group,
  type Mesh,
  MeshBasicMaterial,
  ShaderMaterial,
  Vector3,
} from 'three'

import { setUniform } from '@/scenes/shared/starGlowMaterial'
import { AccretionDisk } from '@/scenes/system/AccretionDisk'
import { crossfadeProgress } from '@/scenes/system/starCrossfade'

/**
 * 블랙홀 — 페이크 적층(결정 5): ① 깨끗한 검은 사건지평선 구(결정 31 — 감싸는 막 없음)
 * ② 기울인 도플러 강착원반 ③ 비대칭 포톤 호(부분 호 — 구를 감싸는 풀-원형 헤일로 아님).
 *
 * 풀스크린 중력렌즈 없이도 도플러 비대칭 디스크 + 렌즈드 상단을 흉내내는 포톤 호로
 * "가르강튀아"로 읽힌다. 포스트프로세싱 0 — 모바일 안전. 진짜 렌즈는 high 티어 후순위(비범위).
 */

const SPHERE_SEGMENTS = 32
/** 포톤 호 빌보드 한 변 = 본체 반경 × 이 배수. */
const ARC_QUAD_FACTOR = 2.6

const ARC_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

// 사건지평선 둘레의 얇은 포톤 링을, 상단 반구 + 접근 쪽에서만 밝히는 부분 호(크레센트).
// 하단-후퇴 쪽은 0으로 사라져 "감싸는 막"이 아니라 디스크의 렌즈된 연장으로 읽힌다 (결정 31).
// 정적 형태라 uTime 없음 — 회전·점멸은 디스크가 담당한다.
const ARC_FRAGMENT_SHADER = /* glsl */ `
  uniform float uOpacity;
  varying vec2 vUv;

  void main() {
    vec2 p = (vUv - 0.5) * 2.0;       // [-1, 1]
    float r = length(p);
    float ang = atan(p.y, p.x);

    // 얇은 포톤 링 — 사건지평선 바로 바깥(정규화 r ≈ 0.5)
    float ring = exp(-pow((r - 0.5) / 0.07, 2.0));

    // 비대칭: 상단(p.y>0) + 접근 쪽(p.x>0)에서 밝고 하단-후퇴 쪽은 사라진다 → 크레센트
    float top = smoothstep(-0.25, 0.85, p.y);
    float doppler = 0.5 + 0.5 * cos(ang);
    float arc = top * (0.45 + 0.55 * doppler);

    float intensity = ring * arc;
    vec3 col = vec3(1.0, 0.93, 0.78);  // 뜨거운 백황
    gl_FragColor = vec4(col * intensity, intensity * uOpacity);
  }
`

interface BlackHoleProps {
  readonly radius: number
}

export function BlackHole({ radius }: BlackHoleProps) {
  const arcGroupRef = useRef<Group>(null)
  const arcMeshRef = useRef<Mesh>(null)
  const worldScratch = useMemo(() => new Vector3(), [])

  const arcMaterial = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: ARC_VERTEX_SHADER,
        fragmentShader: ARC_FRAGMENT_SHADER,
        uniforms: { uOpacity: { value: 1 } },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [],
  )

  // 사건지평선 — 검은 구. 도착 크로스페이드에 동참하도록 transparent + opacity 구동
  // (결정 41-c, StarSurface와 동일 계약). depthWrite는 유지해 디스크 far side를 가린다(렌즈 없는 룩).
  const sphereMaterial = useMemo(
    () => new MeshBasicMaterial({ color: '#000000', transparent: true, depthWrite: true }),
    [],
  )

  useEffect(() => () => arcMaterial.dispose(), [arcMaterial])
  useEffect(() => () => sphereMaterial.dispose(), [sphereMaterial])

  useFrame((state) => {
    // 포톤 호 빌보드 — 항상 카메라를 향한다 (상단 호가 화면 위로 휘어 보이게).
    arcGroupRef.current?.quaternion.copy(state.camera.quaternion)
    if (arcMeshRef.current != null) {
      const distance = state.camera.position.distanceTo(
        arcMeshRef.current.getWorldPosition(worldScratch),
      )
      const opacity = 1 - crossfadeProgress(distance)
      setUniform(arcMaterial, 'uOpacity', opacity)
      sphereMaterial.opacity = opacity
    }
  })

  const arcSize = radius * ARC_QUAD_FACTOR

  return (
    <>
      {/* 사건지평선 — 검은 구. renderOrder=-1로 디스크보다 먼저 그려 깊이를 써서 far side를 가린다. */}
      <mesh material={sphereMaterial} renderOrder={-1}>
        <sphereGeometry args={[radius, SPHERE_SEGMENTS, SPHERE_SEGMENTS]} />
      </mesh>

      <AccretionDisk radius={radius} />

      <group ref={arcGroupRef}>
        <mesh ref={arcMeshRef} material={arcMaterial}>
          <planeGeometry args={[arcSize, arcSize]} />
        </mesh>
      </group>
    </>
  )
}
