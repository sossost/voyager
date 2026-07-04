import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, BackSide, type Mesh, ShaderMaterial, Vector3 } from 'three'

import type { AtmosphereProfile } from '@/scenes/system/atmosphere'
import { currentBodies } from '@/scenes/system/currentBodies'

/**
 * 행성 대기 산란 림 — 행성보다 약간 큰 백페이스 셸에 프레넬 산란 호를 그린다 (atmospheric-limb).
 *
 * 백페이스 + depthTest: 행성 앞면(불투명)이 셸의 앞 절반을 가려, 실루엣 밖으로 삐져나온 고리만
 * 보인다 → 앞면 디스크에 헤이즈가 끼지 않고 가장자리에만 호가 뜬다. 가산 블렌딩으로 우주 배경 위에
 * 빛을 더한다. 표면 재질(meshStandardMaterial 베이크 텍스처)은 전혀 건드리지 않는다.
 *
 * 낮면 게이팅·박명 적색화는 프래그먼트에서: 광원 방향은 매 프레임 currentBodies.positions[0]
 * (게시된 주성 월드좌표)와 셸 월드좌표로 산출하고, 시점 방향은 three 빌트인 cameraPosition을 쓴다.
 */

/** 산란 호는 부드러운 방사형이라 저폴리 셸로 충분하다. */
const ATMOSPHERE_SEGMENTS = 48
/** 낮/밤 경계 폭 — 클수록 터미네이터가 부드럽다. */
const TERMINATOR_SOFTNESS = 0.18
/** 박명 적색화가 미치는 낮면 각 폭 — 터미네이터(0)에서 이 값까지 warmColor가 감쇠한다. */
const WARM_WIDTH = 0.4

const VERTEX_SHADER = /* glsl */ `
  varying vec3 vWorldPos;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`

const FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uPlanetCenter;
  uniform vec3 uStarDir;
  uniform vec3 uBaseColor;
  uniform vec3 uWarmColor;
  uniform float uIntensity;
  uniform float uRimPower;
  uniform float uWarmAmount;
  varying vec3 vWorldPos;

  void main() {
    // 셸 중심에서 프래그먼트로의 방사 노멀 — 면 방향(백/프론트)과 무관하게 안정적.
    vec3 normal = normalize(vWorldPos - uPlanetCenter);
    vec3 viewDir = normalize(cameraPosition - vWorldPos);

    // 프레넬 — 가장자리(그레이징)에서 1, 정면에서 0. 대기 통과 경로가 길어지는 림에 집중.
    float facing = clamp(dot(normal, viewDir), 0.0, 1.0);
    float rim = pow(1.0 - facing, uRimPower);

    // 낮면 게이팅 — 별빛 받는 쪽만. 터미네이터에서 부드럽게 0.
    float lit = dot(normal, uStarDir);
    float day = smoothstep(-${TERMINATOR_SOFTNESS.toFixed(2)}, ${TERMINATOR_SOFTNESS.toFixed(2)}, lit);

    // 박명 적색화 — 터미네이터(lit≈0)에서 warmColor, 높은각에서 baseColor.
    float warmT = (1.0 - smoothstep(0.0, ${WARM_WIDTH.toFixed(2)}, lit)) * uWarmAmount;
    vec3 color = mix(uBaseColor, uWarmColor, clamp(warmT, 0.0, 1.0));

    float alpha = rim * day * uIntensity;
    gl_FragColor = vec4(color, alpha);
  }
`

interface LimbMaterial {
  readonly material: ShaderMaterial
  /** 매 프레임 갱신하는 유니폼 벡터 — 인덱스 조회 없이 직접 참조한다. */
  readonly planetCenter: Vector3
  readonly starDir: Vector3
}

function createLimbMaterial(profile: AtmosphereProfile): LimbMaterial {
  const planetCenter = new Vector3()
  const starDir = new Vector3(1, 0, 0)
  const material = new ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    uniforms: {
      uPlanetCenter: { value: planetCenter },
      uStarDir: { value: starDir },
      uBaseColor: { value: new Vector3(...profile.baseColor) },
      uWarmColor: { value: new Vector3(...profile.warmColor) },
      uIntensity: { value: profile.intensity },
      uRimPower: { value: profile.rimPower },
      uWarmAmount: { value: profile.warmAmount },
    },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: BackSide,
  })
  return { material, planetCenter, starDir }
}

interface AtmosphereLimbProps {
  /** 행성 시각 반경 — 셸은 profile.shellScale 배로 살짝 크게. */
  readonly radius: number
  readonly profile: AtmosphereProfile
}

export function AtmosphereLimb({ radius, profile }: AtmosphereLimbProps) {
  const meshRef = useRef<Mesh>(null)
  const { material, planetCenter, starDir } = useMemo(() => createLimbMaterial(profile), [profile])

  // 머티리얼은 수동 생성이라 프로파일 변경·언마운트 시 명시적으로 해제한다.
  useEffect(() => () => material.dispose(), [material])

  useFrame(() => {
    const mesh = meshRef.current
    if (mesh == null) return
    mesh.getWorldPosition(planetCenter)

    // 광원 방향 = 주성 월드좌표 − 행성 중심. 별 본체 미게시(워프 등)면 이전 방향 유지.
    if (currentBodies.count > 0) {
      starDir.copy(currentBodies.positions[0] as Vector3).sub(planetCenter)
      if (starDir.lengthSq() > 0) starDir.normalize()
    }
  })

  return (
    <mesh ref={meshRef} material={material}>
      <sphereGeometry args={[radius * profile.shellScale, ATMOSPHERE_SEGMENTS, ATMOSPHERE_SEGMENTS]} />
    </mesh>
  )
}
