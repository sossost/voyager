import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, DoubleSide, type Mesh, RingGeometry, ShaderMaterial, Vector3 } from 'three'

import { setUniform } from '@/scenes/shared/starGlowMaterial'
import { usePrefersReducedMotion } from '@/scenes/shared/useReducedMotion'
import { crossfadeProgress } from '@/scenes/system/starCrossfade'

/**
 * 블랙홀 강착원반 — 사건지평선을 감싸는 밝은 비대칭 고리 + 안쪽 포톤 링 (결정 5).
 *
 * EHT/가르강튀아 룩: 검은 원반 둘레를 뜨거운 고리가 두르고, 도플러 효과로 한쪽이 더 밝다.
 * **NaN 안전 셰이더** — 각도는 atan 대신 normalize(position.xy)로 구하고, 제곱은 d*d로,
 * pow(0,·)/pow(음수,·) 같은 GPU NaN 유발 연산을 쓰지 않는다. (이전 spiral 셰이더의 NaN이
 * high 티어 Bloom mipmap blur에 번져 전체 화면이 검게 되는 버그가 있었다.)
 * 카메라 향하는 빌보드 + 로컬 기울기라 어느 각도에서도 비스듬한 타원 고리로 또렷이 보인다.
 */

/** 본체(사건지평선) 반경 배수 — 고리는 본체에 바짝 붙어 시작한다. */
const DISK_INNER = 1.06
const DISK_OUTER = 2.4
const THETA_SEGMENTS = 160
const RADIAL_SEGMENTS = 8
/**
 * 월드 고정 기울기 — 공전 궤도면(수평)에 가깝게 살짝 기울인다. 빌보드(카메라 추종)가
 * 아니라 한 자리에 고정이라 시점을 돌려도 원반이 따라 돌지 않는다(자연스러움). 위에서 보면
 * 타원 고리, 옆에서 보면 가르강튀아처럼 거의 옆모습으로 읽힌다.
 */
const DISK_TILT_X = -Math.PI / 2 + 0.32
const DISK_TILT_Z = 0.06

const VERTEX_SHADER = /* glsl */ `
  varying float vRadial;
  varying vec2 vDir;
  void main() {
    float r = length(position.xy);
    vRadial = clamp((r - ${DISK_INNER.toFixed(2)}) / ${(DISK_OUTER - DISK_INNER).toFixed(2)}, 0.0, 1.0);
    // 각도 대신 정규화 방향 — atan(0,0) NaN 회피 (r은 항상 ≥ DISK_INNER > 0이라 안전)
    vDir = position.xy / r;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  varying float vRadial;
  varying vec2 vDir;

  void main() {
    // 온도 그라데이션 — 안쪽 청백(뜨겁게) → 바깥 주황(식음)
    vec3 hot = vec3(0.92, 0.96, 1.12);
    vec3 cool = vec3(1.12, 0.52, 0.18);
    vec3 col = mix(hot, cool, sqrt(vRadial));

    // 도플러 비밍 — 접근 쪽(vDir.x>0) 크게 증광 (상대론적 비대칭의 핵심 시그니처)
    float doppler = 0.3 + 1.1 * (0.5 + 0.5 * vDir.x);

    // 라디얼 프로파일 — 안쪽 가장자리 밝고 바깥으로 감쇠
    float body = smoothstep(0.0, 0.07, vRadial) * (1.0 - smoothstep(0.4, 1.0, vRadial));

    // 안쪽 포톤 링 — 사건지평선 바로 바깥의 얇고 밝은 띠
    float pd = (vRadial - 0.05) / 0.05;
    float photon = exp(-pd * pd) * 0.9;

    // 부드러운 회전 셔머 (atan 없이 vDir·시간으로) — 약하게, 스포크 느낌 방지
    float shimmer = 0.85 + 0.15 * sin(vDir.x * 7.0 + vDir.y * 4.0 + vRadial * 6.0 + uTime * 1.6);

    float intensity = (body + photon) * doppler * shimmer;
    intensity = clamp(intensity, 0.0, 4.0);
    gl_FragColor = vec4(min(col * intensity * 1.5, vec3(6.0)), clamp(intensity, 0.0, 1.0) * uOpacity);
  }
`

let cachedGeometry: RingGeometry | null = null
function diskGeometry(): RingGeometry {
  if (cachedGeometry == null) {
    cachedGeometry = new RingGeometry(DISK_INNER, DISK_OUTER, THETA_SEGMENTS, RADIAL_SEGMENTS)
  }
  return cachedGeometry
}

interface AccretionDiskProps {
  /** 사건지평선(본체) 반경 — 디스크는 이 배수로 스케일된다. */
  readonly radius: number
}

export function AccretionDisk({ radius }: AccretionDiskProps) {
  const meshRef = useRef<Mesh>(null)
  const worldScratch = useMemo(() => new Vector3(), [])
  const geometry = useMemo(() => diskGeometry(), [])
  const reducedMotion = usePrefersReducedMotion()

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        uniforms: { uTime: { value: 0 }, uOpacity: { value: 1 } },
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        blending: AdditiveBlending,
      }),
    [],
  )

  useEffect(() => () => material.dispose(), [material])

  useFrame((state) => {
    // reduced-motion: 회전 셔머 정지(uTime 고정) — 전정 민감성 배려. 형태는 그대로.
    setUniform(material, 'uTime', reducedMotion ? 0 : state.clock.elapsedTime)
    // 워프 도착 크로스페이드 — StarSurface와 동일 계약 (결정 41-c, 도착 팝인 방지).
    if (meshRef.current != null) {
      const distance = state.camera.position.distanceTo(meshRef.current.getWorldPosition(worldScratch))
      setUniform(material, 'uOpacity', 1 - crossfadeProgress(distance))
    }
  })

  // 월드 고정 — 빌보드가 아니라 한 자리에 고정된 기울어진 원반.
  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      scale={radius}
      rotation={[DISK_TILT_X, 0, DISK_TILT_Z]}
    />
  )
}
