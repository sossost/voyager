import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, Color, type Group, type Mesh, ShaderMaterial, Vector3 } from 'three'

import { setUniform } from '@/scenes/shared/starGlowMaterial'
import { companionTide } from '@/scenes/system/companionTide'
import { crossfadeProgress } from '@/scenes/system/starCrossfade'

/**
 * 항성 표면 — 절차 셰이더 구 + 가산 빌보드 코로나 (백로그 F-1, 결정 29).
 *
 * 표면은 시간 애니메이션 value noise 입상반(끓는 표면)과 림 다크닝으로 셰이딩하고,
 * 입상반 진폭과 림 저온층 색은 분광형에서 파생한다(O-6, SPECTRAL_SURFACE) —
 * 복사 외피(O/B)는 매끈하고 저온 대류별일수록 림이 붉게 식는다.
 * 뜨거운 입상반 꼭대기는 1을 넘는 백색으로 — high 티어 Bloom(임계 0.3)이 증폭한다.
 * 코로나는 텍스처 없는 라디얼 셰이더 쿼드라 Bloom 없는 티어에서도 빛무리가 보인다.
 * 렌더 전용 — 분광형 색(SPECTRAL_RENDER)만 소비하며 GEN_VERSION 무관.
 */

const SPHERE_SEGMENTS = 48
/** 코로나 쿼드 한 변 = 항성 반경 × 이 배수. */
const CORONA_SIZE_FACTOR = 5.6

const SURFACE_VERTEX_SHADER = /* glsl */ `
  uniform float uTidal;
  uniform vec3 uTidalDir;
  varying vec3 vUnit;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying float vToward;

  void main() {
    vUnit = normalize(position);
    // 조석 티어드롭 변형 (exotic-codex) — 로슈엽을 채운 반성은 L1(블랙홀 방향)로 뾰족하게
    // 늘어나고 반대편도 완만히 부푼다 (로슈 등퍼텐셜 근사). uTidal=0이면 항등 — 기존 렌더 불변.
    vToward = dot(vUnit, uTidalDir);
    float nearLobe = pow(max(vToward, 0.0), 3.0);
    float farLobe = pow(max(-vToward, 0.0), 2.0) * 0.35;
    vec3 displaced = position * (1.0 + uTidal * (nearLobe + farLobe));
    vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vViewDir = normalize(-mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
  }
`

const SURFACE_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uRimColor;
  uniform float uTime;
  uniform float uOpacity;
  uniform float uEmissiveBoost;
  uniform float uGranulation;
  uniform float uTidal;
  varying vec3 vUnit;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying float vToward;

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
    // 끓는 표면: 위상이 다른 두 노이즈 장을 교차 — 입상반이 일렁인다.
    // uGranulation은 대류 외피 진폭(O-6) — 0이면 fbm 평균(0.5)으로 붕괴해 복사 외피가
    // 매끈해지고, 평균이 보존되므로 전체 밝기는 진폭과 무관하게 일정하다.
    vec3 p = vUnit * 8.0;
    float fieldA = fbm(p + vec3(0.0, uTime * 0.055, 0.0));
    float fieldB = fbm(p * 1.7 + vec3(uTime * 0.04, 0.0, -uTime * 0.047));
    float granulation = mix(0.5, 0.6 * fieldA + 0.4 * fieldB, uGranulation);

    // 림 다크닝 — 실제 항성처럼 가장자리가 어둡고 중심이 또렷하다.
    // 림은 광학 깊이가 얕아 저온 상층이 노출되므로 uRimColor(붉은 쪽)로 색도 함께 식는다(O-6).
    float facing = clamp(dot(normalize(vNormal), normalize(vViewDir)), 0.0, 1.0);
    float limbProfile = pow(facing, 0.55);
    float darkening = 0.42 + 0.58 * limbProfile;
    vec3 photosphere = mix(uRimColor, uColor, limbProfile);

    // 조석 중력감광 (von Zeipel) — 늘어난 L1 팁은 표면중력이 낮아 식는다: 저온층 색으로
    // 물들고 살짝 어두워진다. uTidal=0이면 0 — 기존 렌더 불변.
    float tipCool = uTidal > 0.001 ? smoothstep(0.55, 0.95, vToward) * 0.55 : 0.0;
    photosphere = mix(photosphere, uRimColor, tipCool);
    darkening *= 1.0 - tipCool * 0.25;

    vec3 surface = photosphere * (0.68 + 0.55 * granulation) * darkening;

    // 뜨거운 입상반 꼭대기는 1을 넘는 백색(1.45 = Bloom 임계 0.3 대비 증폭 목표)으로.
    // uEmissiveBoost: 백색왜성(>1, 강렬) / 적색거성(<1, 은은). 기본 1이면 기존과 동일.
    // 진폭 0(복사 외피)이면 granulation=0.5로 고정되어 핫스팟도 자연히 사라진다.
    float hotness = smoothstep(0.72, 0.95, granulation) * facing;
    surface = mix(surface, vec3(1.45), clamp(hotness * 0.5 * uEmissiveBoost, 0.0, 1.0));

    gl_FragColor = vec4(surface, uOpacity);
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
  uniform float uOpacity;
  uniform float uEmissiveBoost;
  varying vec2 vUv;

  void main() {
    float distanceFromCenter = length(vUv - vec2(0.5)) * 2.0;
    // 느린 호흡 — 코로나가 미세하게 맥동한다
    float breath = 1.0 + 0.06 * sin(uTime * 0.7);
    float falloff = clamp(1.0 - distanceFromCenter / breath, 0.0, 1.0);
    float glow = pow(falloff, 2.6);
    // 중심은 백색으로 뜨겁고 가장자리는 분광색으로 식는다. uEmissiveBoost로 강도 변조(기본 1).
    vec3 color = mix(uColor, vec3(1.0), clamp(glow * 0.55 * uEmissiveBoost, 0.0, 1.0));
    gl_FragColor = vec4(color * glow * uEmissiveBoost, glow * uOpacity);
  }
`

interface StarSurfaceProps {
  readonly radius: number
  /** 분광형 렌더 색 (SPECTRAL_RENDER) 또는 이색 천체 색 (EXOTIC_RENDER). */
  readonly color: string
  /** 핫스팟·코로나 발광 강도 배수 (이색 천체용, 기본 1 = 기존 단일 항성 렌더 불변). */
  readonly emissiveBoost?: number
  /** 코로나 크기 배수 (이색 천체용, 기본 1). */
  readonly coronaScale?: number
  /**
   * 입상반 진폭 배수 (O-6, SPECTRAL_SURFACE 파생) — 0=복사 외피(매끈), 1=기존 렌더 불변.
   * 평균 밝기는 진폭과 무관하게 보존된다.
   */
  readonly granulation?: number
  /** 림 다크닝 저온층 색 (O-6, SPECTRAL_SURFACE 파생). 생략 시 color와 동일 = 기존 렌더 불변. */
  readonly rimColor?: string
  /**
   * 코로나 글로우 반폭 상한 (coronaMaxRadii 파생) — 가산 빌보드가 이웃 별 원반을 덮어
   * 초승달 위상 착시를 만들지 않게 클램프. 기본 Infinity = 단일성·기존 렌더 불변.
   */
  readonly maxCoronaRadius?: number
  /**
   * 조석 티어드롭 변형 강도 (exotic-codex, 카리브디스 반성 전용) — L1 쪽 최대 반경 증가율.
   * 방향은 companionTide 공유 상태에서 매 프레임 읽는다. 기본 0 = 기존 렌더 불변.
   */
  readonly tidalStretch?: number
}

export function StarSurface({
  radius,
  color,
  emissiveBoost = 1,
  coronaScale = 1,
  granulation = 1,
  rimColor,
  maxCoronaRadius = Infinity,
  tidalStretch = 0,
}: StarSurfaceProps) {
  const coronaRef = useRef<Group>(null)
  const surfaceRef = useRef<Mesh>(null)
  const worldScratch = useMemo(() => new Vector3(), [])

  const surfaceMaterial = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: SURFACE_VERTEX_SHADER,
        fragmentShader: SURFACE_FRAGMENT_SHADER,
        uniforms: {
          uColor: { value: new Color(color) },
          uRimColor: { value: new Color(rimColor ?? color) },
          uTime: { value: 0 },
          uOpacity: { value: 1 },
          uEmissiveBoost: { value: emissiveBoost },
          uGranulation: { value: granulation },
          uTidal: { value: tidalStretch },
          uTidalDir: { value: new Vector3(1, 0, 0) },
        },
        // 워프 도착 크로스페이드 동안 반투명으로 차오른다 — 정박(근거리)에선 불투명 (결정 41-c)
        transparent: true,
      }),
    [color, emissiveBoost, granulation, rimColor, tidalStretch],
  )

  const coronaMaterial = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: CORONA_VERTEX_SHADER,
        fragmentShader: CORONA_FRAGMENT_SHADER,
        uniforms: {
          uColor: { value: new Color(color) },
          uTime: { value: 0 },
          uOpacity: { value: 1 },
          uEmissiveBoost: { value: emissiveBoost },
        },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [color, emissiveBoost],
  )

  useEffect(() => () => surfaceMaterial.dispose(), [surfaceMaterial])
  useEffect(() => () => coronaMaterial.dispose(), [coronaMaterial])

  useFrame((state) => {
    const elapsed = state.clock.elapsedTime
    setUniform(surfaceMaterial, 'uTime', elapsed)
    setUniform(coronaMaterial, 'uTime', elapsed)
    // 조석 변형 방향 — CurrentSystem이 게시한 반성→BH 방향(시스템 로컬)을 따라간다.
    if (tidalStretch > 0) {
      const dir = surfaceMaterial.uniforms.uTidalDir?.value as Vector3 | undefined
      dir?.set(companionTide.dirX, 0, companionTide.dirZ)
    }
    // 코로나 빌보드 — 항상 카메라를 향한다 (구는 회전 불필요)
    coronaRef.current?.quaternion.copy(state.camera.quaternion)

    // 포인트 ↔ 구체 크로스페이드 — 가까우면 1(불투명), 멀면 0. 포인트 페이드와 상보 (결정 41-c).
    // 정박 거리(~138)는 NEAR 안쪽이라 우주선 뷰에선 항상 1 = 효과 없음.
    if (surfaceRef.current != null) {
      const distance = state.camera.position.distanceTo(
        surfaceRef.current.getWorldPosition(worldScratch),
      )
      const opacity = 1 - crossfadeProgress(distance)
      setUniform(surfaceMaterial, 'uOpacity', opacity)
      setUniform(coronaMaterial, 'uOpacity', opacity)
    }
  })

  // 쿼드 한 변 = 글로우 반폭 × 2 (셰이더 falloff가 uv 중심→모서리 절반 거리에서 1이 된다).
  const coronaSize = Math.min(radius * CORONA_SIZE_FACTOR * coronaScale, maxCoronaRadius * 2)

  return (
    <>
      <mesh ref={surfaceRef} material={surfaceMaterial}>
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
