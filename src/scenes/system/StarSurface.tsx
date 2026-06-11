import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, Color, type Group, ShaderMaterial } from 'three'

import { setUniform } from '@/scenes/shared/starGlowMaterial'

/**
 * 항성 표면 — 절차 셰이더 구 + 가산 빌보드 코로나 (백로그 F-1, 결정 29).
 *
 * 표면은 시간 애니메이션 value noise 입상반(끓는 표면)과 림 다크닝으로 셰이딩하고,
 * 뜨거운 입상반 꼭대기는 1을 넘는 백색으로 — high 티어 Bloom(임계 0.3)이 증폭한다.
 * 코로나는 텍스처 없는 라디얼 셰이더 쿼드라 Bloom 없는 티어에서도 빛무리가 보인다.
 * 렌더 전용 — 분광형 색(SPECTRAL_RENDER)만 소비하며 GEN_VERSION 무관.
 */

const SPHERE_SEGMENTS = 48
/** 코로나 쿼드 한 변 = 항성 반경 × 이 배수. */
const CORONA_SIZE_FACTOR = 5.6

const SURFACE_VERTEX_SHADER = /* glsl */ `
  varying vec3 vUnit;
  varying vec3 vNormal;
  varying vec3 vViewDir;

  void main() {
    vUnit = normalize(position);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vViewDir = normalize(-mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
  }
`

const SURFACE_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  varying vec3 vUnit;
  varying vec3 vNormal;
  varying vec3 vViewDir;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise3(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    float n000 = hash(i);
    float n100 = hash(i + vec3(1.0, 0.0, 0.0));
    float n010 = hash(i + vec3(0.0, 1.0, 0.0));
    float n110 = hash(i + vec3(1.0, 1.0, 0.0));
    float n001 = hash(i + vec3(0.0, 0.0, 1.0));
    float n101 = hash(i + vec3(1.0, 0.0, 1.0));
    float n011 = hash(i + vec3(0.0, 1.0, 1.0));
    float n111 = hash(i + vec3(1.0, 1.0, 1.0));
    float bottom = mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y);
    float top = mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y);
    return mix(bottom, top, f.z);
  }

  // 4옥타브 fbm — 가중치 합 = 1, 주파수 배율은 격자 정렬 아티팩트를 피해 2/4/8에서 살짝 비튼 값
  float fbm(vec3 p) {
    float sum = 0.48 * noise3(p);
    sum += 0.26 * noise3(p * 2.13 + vec3(31.7));
    sum += 0.16 * noise3(p * 4.41 + vec3(11.3));
    sum += 0.10 * noise3(p * 8.93 + vec3(57.2));
    return sum;
  }

  void main() {
    // 끓는 표면: 위상이 다른 두 노이즈 장을 교차 — 입상반이 일렁인다
    vec3 p = vUnit * 8.0;
    float fieldA = fbm(p + vec3(0.0, uTime * 0.055, 0.0));
    float fieldB = fbm(p * 1.7 + vec3(uTime * 0.04, 0.0, -uTime * 0.047));
    float granulation = 0.6 * fieldA + 0.4 * fieldB;

    // 림 다크닝 — 실제 항성처럼 가장자리가 어둡고 중심이 또렷하다
    float facing = clamp(dot(normalize(vNormal), normalize(vViewDir)), 0.0, 1.0);
    float darkening = 0.42 + 0.58 * pow(facing, 0.55);

    vec3 surface = uColor * (0.68 + 0.55 * granulation) * darkening;

    // 뜨거운 입상반 꼭대기는 1을 넘는 백색(1.45 = Bloom 임계 0.3 대비 증폭 목표)으로
    float hotness = smoothstep(0.72, 0.95, granulation) * facing;
    surface = mix(surface, vec3(1.45), hotness * 0.5);

    gl_FragColor = vec4(surface, 1.0);
  }
`

const CORONA_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const CORONA_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  varying vec2 vUv;

  void main() {
    float distanceFromCenter = length(vUv - vec2(0.5)) * 2.0;
    // 느린 호흡 — 코로나가 미세하게 맥동한다
    float breath = 1.0 + 0.06 * sin(uTime * 0.7);
    float falloff = clamp(1.0 - distanceFromCenter / breath, 0.0, 1.0);
    float glow = pow(falloff, 2.6);
    // 중심은 백색으로 뜨겁고 가장자리는 분광색으로 식는다
    vec3 color = mix(uColor, vec3(1.0), glow * 0.55);
    gl_FragColor = vec4(color * glow, glow);
  }
`

interface StarSurfaceProps {
  readonly radius: number
  /** 분광형 렌더 색 (SPECTRAL_RENDER). */
  readonly color: string
}

export function StarSurface({ radius, color }: StarSurfaceProps) {
  const coronaRef = useRef<Group>(null)

  const surfaceMaterial = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: SURFACE_VERTEX_SHADER,
        fragmentShader: SURFACE_FRAGMENT_SHADER,
        uniforms: {
          uColor: { value: new Color(color) },
          uTime: { value: 0 },
        },
      }),
    [color],
  )

  const coronaMaterial = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: CORONA_VERTEX_SHADER,
        fragmentShader: CORONA_FRAGMENT_SHADER,
        uniforms: {
          uColor: { value: new Color(color) },
          uTime: { value: 0 },
        },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [color],
  )

  useEffect(() => () => surfaceMaterial.dispose(), [surfaceMaterial])
  useEffect(() => () => coronaMaterial.dispose(), [coronaMaterial])

  useFrame((state) => {
    const elapsed = state.clock.elapsedTime
    setUniform(surfaceMaterial, 'uTime', elapsed)
    setUniform(coronaMaterial, 'uTime', elapsed)
    // 코로나 빌보드 — 항상 카메라를 향한다 (구는 회전 불필요)
    coronaRef.current?.quaternion.copy(state.camera.quaternion)
  })

  const coronaSize = radius * CORONA_SIZE_FACTOR

  return (
    <>
      <mesh material={surfaceMaterial}>
        <sphereGeometry args={[radius, SPHERE_SEGMENTS, SPHERE_SEGMENTS]} />
      </mesh>
      <group ref={coronaRef}>
        <mesh material={coronaMaterial}>
          <planeGeometry args={[coronaSize, coronaSize]} />
        </mesh>
      </group>
    </>
  )
}
