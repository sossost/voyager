import { ScreenQuad } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { damp } from 'maath/easing'
import { useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, PerspectiveCamera, ShaderMaterial } from 'three'

import { setUniform } from '@/scenes/shared/starGlowMaterial'
import {
  WARP_FOV_PEAK,
  WARP_FOV_REST,
  WARP_STAGE_A_MS,
} from '@/scenes/warp/warpTimeline'

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 1.0, 1.0);
  }
`

/** 주층(가늘고 빠른 빛줄기) 레이 수. */
const PRIMARY_RAY_COUNT = 75
/** 보조층(굵고 느린 보랏빛 줄기) 레이 수 — 층이 어긋나야 깊이감이 생긴다. */
const SECONDARY_RAY_COUNT = 36

/**
 * 방사형 하이퍼스페이스 스트리크 — 시각 연출 전용 셰이더.
 * 빛은 가산으로 그린다: 머티리얼이 AdditiveBlending이라 줄기가 배경 위에
 * 덧칠되는 면(색종이)이 아니라 누적되는 광량으로 렌더되고, 겹치는 곳은
 * 자연히 백색으로 타오른다. 단면은 "가는 코어 + 넓은 헤일로" 2성분 —
 * 실제 빛줄기의 단면 구조다. 점화 시차로 듬성듬성 시작해 점점 빽빽해지고,
 * 막판에 중앙 글로우가 차올라 플래시(스테이지 B)로 튀지 않고 이어진다.
 */
const FRAGMENT_SHADER = /* glsl */ `
  uniform float uProgress;
  uniform float uAspect;
  varying vec2 vUv;

  const float TAU = 6.2831853;
  // 방사 마스크 시작 반경 — 이 안쪽은 스트리크 기여 0 (중앙은 글로우 전용)
  const float RADIAL_MASK_INNER = 0.04;

  float hash(float n) {
    return fract(sin(n) * 43758.5453123);
  }

  // 한 층의 스트리크 — 레이마다 점화 시점·속도·두께·꼬리 길이가 다르다
  float streakLayer(vec2 centered, float rayCount, float seedOffset, float speedBase) {
    float radius = length(centered);
    // 마스크 사각지대 조기 탈출 — atan(0,0)은 GLSL 스펙상 undefined라 NaN을 낼 수 있고,
    // NaN은 radialMask 0 곱셈으로도 지워지지 않는다 (NaN * 0 == NaN)
    if (radius < RADIAL_MASK_INNER) return 0.0;
    float rayPosition = (atan(centered.y, centered.x) / TAU + 0.5) * rayCount;
    float rayId = floor(rayPosition);
    float raySeed = hash(rayId + seedOffset);
    float rayTrait = hash(rayId * 1.73 + seedOffset + 11.0);

    // 단면 = 가는 코어 + 넓고 옅은 헤일로 — 단일 가우시안은 면처럼 읽힌다.
    // 계수는 레이 수 절반(버킷 폭 2배) 보정으로 4배 — 절대 굵기는 동일하다
    float acrossRay = abs(fract(rayPosition) - 0.5) * 2.0;
    float thinness = mix(24.0, 56.0, rayTrait);
    float core = exp(-acrossRay * acrossRay * thinness * 5.0);
    float halo = exp(-acrossRay * acrossRay * thinness) * 0.45;
    float rayShape = core + halo;

    // 점화 시차 — 진행도에 따라 레이가 하나둘 켜져 가속감이 쌓인다
    float ignition = smoothstep(raySeed * 0.55, raySeed * 0.55 + 0.3, uProgress);

    // 혜성형 트레일 — 위상 1.0 직전이 머리, pow 꼬리가 주기 전체에 끌린다.
    // 머리는 랩 경계에서 뭉툭하게 잘리지 않도록 둥근 캡으로 마감한다.
    float raySpeed = speedBase + raySeed * 2.5;
    float phase = fract(radius * (1.1 + rayTrait * 0.7) - uProgress * raySpeed - raySeed * 8.0);
    float trail = pow(phase, mix(3.0, 6.0, rayTrait)) * smoothstep(1.0, 0.96, phase);

    return trail * rayShape * ignition * (0.55 + 0.45 * raySeed);
  }

  void main() {
    vec2 centered = (vUv - 0.5) * vec2(uAspect, 1.0);
    float radius = length(centered);
    float radialMask = smoothstep(RADIAL_MASK_INNER, 0.4, radius);

    float primary = streakLayer(centered, ${PRIMARY_RAY_COUNT.toFixed(1)}, 0.0, 2.4);
    float secondary = streakLayer(centered, ${SECONDARY_RAY_COUNT.toFixed(1)}, 37.0, 1.3);
    // 바깥쪽일수록 빠르게 스치는 느낌 — 가장자리 가산
    float edgeBoost = 0.55 + 0.45 * smoothstep(0.15, 0.85, radius);
    float energy = (primary + secondary * 0.5) * radialMask * edgeBoost * uProgress;

    // 플래시로 이어지는 중앙 코어 플레어 — uProgress가 JS에서 이미 제곱 업로드되므로
    // 실효 곡선은 원시 진행도의 16제곱: 마지막 순간에만 점화된다.
    // 반경이 점화도를 따라 자란다 — 작게 맺혔다가 부풀어 오르며 플래시로 넘어간다
    float surge = uProgress * uProgress;
    float ignite = surge * surge * surge * surge;
    float flareRadius = mix(0.03, 0.3, ignite);
    float centerGlow = (1.0 - smoothstep(0.0, flareRadius, radius)) * ignite * 1.2;

    // 주층은 한색 청백, 보조층이 섞이는 곳은 보랏빛 — 고광량부는 살짝 백색으로
    // (나머지 백색화는 가산 누적이 알아서 한다)
    vec3 streakColor = mix(vec3(0.38, 0.52, 1.0), vec3(0.58, 0.4, 1.0),
      clamp(secondary * 1.5, 0.0, 1.0));
    streakColor = mix(streakColor, vec3(1.0), clamp(energy * 0.45, 0.0, 1.0));

    // 가산 블렌딩(SrcAlpha, One): rgb에 광량을 싣고 alpha는 1 — 빛은 더해진다
    vec3 glowColor = vec3(0.88, 0.92, 1.0);
    vec3 light = streakColor * energy * 0.85 + glowColor * centerGlow;
    gl_FragColor = vec4(light, 1.0);
  }
`

/**
 * 워프 스테이지 A — 스트리크 가속 + FOV 펄스 (결정 16).
 * 'warping' 씬 동안만 마운트되며, 타임라인은 ref 기반 — React 상태를 쓰지 않는다.
 * 씬 스왑(플래시 피크) 타이밍은 WarpFlashOverlay(DOM)가 담당한다.
 */
export function WarpStreaks() {
  const camera = useThree((state) => state.camera)
  const startRef = useRef<number | null>(null)

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        uniforms: {
          uProgress: { value: 0 },
          uAspect: { value: 1 },
        },
        transparent: true,
        blending: AdditiveBlending,
        depthTest: false,
        depthWrite: false,
      }),
    [],
  )

  useEffect(() => () => material.dispose(), [material])

  // 언마운트(씬 스왑) 시 FOV 복원 — 플래시가 가리는 동안 일어나 보이지 않는다
  useEffect(
    () => () => {
      if (camera instanceof PerspectiveCamera) {
        camera.fov = WARP_FOV_REST
        camera.updateProjectionMatrix()
      }
    },
    [camera],
  )

  useFrame((state, delta) => {
    if (startRef.current == null) startRef.current = state.clock.elapsedTime
    const elapsed = state.clock.elapsedTime - startRef.current
    const progress = Math.min(1, elapsed / (WARP_STAGE_A_MS / 1_000))

    setUniform(material, 'uProgress', progress * progress) // ease-in
    setUniform(material, 'uAspect', state.size.width / state.size.height)

    if (state.camera instanceof PerspectiveCamera) {
      // 큐빅 서지 — FOV 펀치가 막판에 몰려 플래시 직전 가속감이 최대가 된다
      const fovSurge = progress * progress * progress
      const targetFov = WARP_FOV_REST + (WARP_FOV_PEAK - WARP_FOV_REST) * fovSurge
      damp(state.camera, 'fov', targetFov, 0.1, delta)
      state.camera.updateProjectionMatrix()
    }
  })

  return (
    <ScreenQuad renderOrder={999}>
      <primitive object={material} attach="material" />
    </ScreenQuad>
  )
}
