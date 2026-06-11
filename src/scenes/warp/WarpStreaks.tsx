import { ScreenQuad } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { damp } from 'maath/easing'
import { useEffect, useMemo, useRef } from 'react'
import { PerspectiveCamera, ShaderMaterial } from 'three'

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

/** 방사형 하이퍼스페이스 스트리크 — 시각 연출 전용 셰이더. */
const FRAGMENT_SHADER = /* glsl */ `
  uniform float uProgress;
  uniform float uAspect;
  varying vec2 vUv;

  float hash(float n) {
    return fract(sin(n) * 43758.5453123);
  }

  void main() {
    vec2 centered = (vUv - 0.5) * vec2(uAspect, 1.0);
    float radius = length(centered);
    float angle = atan(centered.y, centered.x);

    float rayCount = 110.0;
    float rayId = floor((angle / 6.2831853 + 0.5) * rayCount);
    float raySeed = hash(rayId);
    float raySpeed = 2.5 + raySeed * 4.0;
    float rayOffset = hash(rayId * 1.73) * 8.0;

    float streakPhase = fract(radius * 2.2 - uProgress * raySpeed - rayOffset);
    float streak = smoothstep(0.78, 1.0, streakPhase);
    float radialMask = smoothstep(0.04, 0.45, radius);
    float intensity = streak * radialMask * uProgress;

    vec3 color = mix(vec3(0.55, 0.66, 1.0), vec3(1.0), intensity * 0.8);
    gl_FragColor = vec4(color, intensity * 0.9);
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
      const targetFov = WARP_FOV_REST + (WARP_FOV_PEAK - WARP_FOV_REST) * progress
      damp(state.camera, 'fov', targetFov, 0.15, delta)
      state.camera.updateProjectionMatrix()
    }
  })

  return (
    <ScreenQuad renderOrder={999}>
      <primitive object={material} attach="material" />
    </ScreenQuad>
  )
}
