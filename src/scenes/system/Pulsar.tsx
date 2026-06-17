import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  Color,
  type Group,
  type Mesh,
  Quaternion,
  ShaderMaterial,
  Vector3,
} from 'three'

import { QUALITY_PRESETS } from '@/quality/presets'
import { setUniform } from '@/scenes/shared/starGlowMaterial'
import {
  PULSAR_BASE_TILT,
  PULSAR_BEAM_CONE_FACTOR,
  PULSAR_BEAM_LEN_FACTOR,
  PULSAR_JET_BASE_FACTOR,
  PULSAR_JET_LEN_FACTOR,
  PULSAR_MAGNETIC_OFFSET,
  PULSAR_POLAR_CAP_FACTOR,
  PULSAR_PULSE_MIN,
  PULSAR_SPIN_RATE,
} from '@/scenes/system/exotic'
import { crossfadeProgress } from '@/scenes/system/starCrossfade'
import { StarSurface } from '@/scenes/system/StarSurface'
import { useGameStore } from '@/store'

/**
 * 펄서(중성자성) — 고품질 인씬 렌더 (펄서 결정 1~5). 포스트이펙트 없음(결정 3).
 *
 * 히어로 = 자전축에서 기울어진(MAGNETIC_OFFSET) 자기축을 따라 뻗는 **등대 쌍극 빔 2개**.
 * 자전(SPIN_RATE)과 함께 빔이 원뿔을 쓸고, 빔이 카메라를 향할 때 중앙 플레어가 부드럽게
 * 차오른다(글로우 펄스 — 완전 소등 없음·통과 ≤3Hz, 광과민성 안전, 결정 4·5).
 *
 * 받침 = 자전축(Y) 정렬 **상대론적 쌍제트**(좁고 긴 충격파 제트) + 초고온 청백 **본체**
 * (StarSurface 재사용) + 자기극 **폴라캡 핫스팟**.
 *
 * 셰이더 안전(블랙홀 교훈): 각도 normalize·제곱은 d*d·위험 pow 금지·출력 clamp.
 * crossfade·LOD·워프 가시성은 StarSurface/CurrentSystem 계약을 그대로 따른다.
 */

const CONE_SEGMENTS = 24
/** 글로우 펄스가 켜지기 시작하는 빔·시선 정렬 임계 (|dot|). 이 값↑일수록 좁은 섬광. */
const PULSE_ALIGN_THRESHOLD = 0.55
/** 중앙 글로우 플레어 빌보드 한 변 = 본체 반경 × 이 배수. */
const FLARE_QUAD_FACTOR = 11

/** 등대 빔 — 자기축을 따라 뻗는 좁은 가산 콘. 별 쪽이 밝고 끝으로 갈수록 식는다. */
const BEAM_VERTEX_SHADER = /* glsl */ `
  uniform float uLen;
  varying float vT;
  varying vec2 vCone;
  void main() {
    vT = position.y / uLen + 0.5;   // 0=별 쪽(밑동) ~ 1=끝
    vCone = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const BEAM_FRAGMENT_SHADER = /* glsl */ `
  uniform float uPulse;
  uniform float uOpacity;
  uniform float uTime;
  uniform float uHigh;
  varying float vT;
  varying vec2 vCone;
  void main() {
    // 밑동(별 쪽) 밝고 끝으로 식는 좁은 핫코어 (clamp된 양수 밑 → pow NaN 안전)
    float taper = pow(clamp(1.0 - vT, 0.0, 1.0), 1.3);
    float root = smoothstep(0.0, 0.12, vT);  // 별 표면 접합부 솔기 완화
    vec3 col = vec3(0.62, 0.84, 1.25);       // 전기 청백
    float intensity = taper * root;
    // high 티어 — 빔 내부를 흐르는 에너지 줄무늬(가산 디테일)
    if (uHigh > 0.5) {
      float flow = 0.5 + 0.5 * sin(vT * 26.0 - uTime * 5.0 + vCone.x * 12.566);
      intensity *= 0.72 + 0.5 * flow;
    }
    intensity *= uPulse;
    gl_FragColor = vec4(col * intensity, clamp(intensity, 0.0, 1.0) * uOpacity);
  }
`

/** 상대론적 제트 — 자전축 정렬 좁고 긴 콘. high에서 바깥으로 흐르는 충격파 노트. */
const JET_FRAGMENT_SHADER = /* glsl */ `
  uniform float uOpacity;
  uniform float uTime;
  uniform float uHigh;
  varying float vT;
  varying vec2 vCone;
  void main() {
    float taper = pow(clamp(1.0 - vT, 0.0, 1.0), 0.85);  // 긴 제트 — 천천히 식는다
    vec3 col = vec3(0.70, 0.95, 1.12);                   // 청록빛 백색
    float knots = 1.0;
    if (uHigh > 0.5) {
      // 바깥으로 이동하는 밝은 충격파 띠 ([0,1] 밑 → pow 안전)
      float band = 0.5 + 0.5 * sin(vT * 15.0 - uTime * 3.2);
      knots = 0.55 + 0.85 * pow(band, 4.0);
    }
    float intensity = taper * knots;
    gl_FragColor = vec4(col * intensity, clamp(intensity, 0.0, 1.0) * uOpacity);
  }
`

/** 중앙 글로우 플레어 — 빔이 카메라를 향할 때 부드럽게 차오르는 라디얼 빌보드. */
const FLARE_FRAGMENT_SHADER = /* glsl */ `
  uniform float uIntensity;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;        // 0=중심 ~ 1=가장자리
    float glow = pow(clamp(1.0 - d, 0.0, 1.0), 2.4);
    vec3 col = vec3(0.72, 0.9, 1.3);          // 전기 청백
    float a = glow * uIntensity;
    gl_FragColor = vec4(col * a, clamp(a, 0.0, 1.0) * uOpacity);
  }
`

const FLARE_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

interface PulsarProps {
  /** 중성자성 본체 반경 (= STAR_VISUAL_RADIUS × kindRadiusFactor('pulsar')). */
  readonly radius: number
  /** 본체·코로나 색 (EXOTIC_RENDER.pulsar — 전기 청백). */
  readonly color: string
}

export function Pulsar({ radius, color }: PulsarProps) {
  const rootRef = useRef<Group>(null) // 회전 없음 — 플레어/코로나 빌보드 기준계
  const spinRef = useRef<Group>(null) // 자전축(Y) 회전
  const magneticRef = useRef<Group>(null) // 자기축 틸트 — 빔 방향 산출 기준
  const flareRef = useRef<Group>(null) // 카메라 향 글로우 플레어 빌보드
  const flareMeshRef = useRef<Mesh>(null)

  const worldScratch = useMemo(() => new Vector3(), [])
  const beamDirScratch = useMemo(() => new Vector3(), [])
  const toCamScratch = useMemo(() => new Vector3(), [])
  const quatScratch = useMemo(() => new Quaternion(), [])

  // 펄서 인씬 셰이더는 콘+빌보드라 저비용 → 블랙홀처럼 high 고정하지 않고 티어에 자연 대응
  // (결정 3 open question 4). bloom=high 프리셋 프록시.
  const isHigh = useGameStore((state) => QUALITY_PRESETS[state.qualityTier].bloom)
  const highFlag = isHigh ? 1 : 0

  const beamLen = radius * PULSAR_BEAM_LEN_FACTOR
  const beamBase = radius * PULSAR_BEAM_CONE_FACTOR
  const beamCenter = radius + beamLen / 2
  const jetLen = radius * PULSAR_JET_LEN_FACTOR
  const jetBase = radius * PULSAR_JET_BASE_FACTOR
  const jetCenter = radius + jetLen / 2
  const capRadius = radius * PULSAR_POLAR_CAP_FACTOR
  const flareSize = radius * FLARE_QUAD_FACTOR

  // 두 빔은 동일 머티리얼 공유(같은 pulse·opacity·time) — 드로콜만 2.
  const beamMaterial = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: BEAM_VERTEX_SHADER,
        fragmentShader: BEAM_FRAGMENT_SHADER,
        uniforms: {
          uLen: { value: beamLen },
          uPulse: { value: 1 },
          uOpacity: { value: 1 },
          uTime: { value: 0 },
          uHigh: { value: highFlag },
        },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [beamLen, highFlag],
  )

  const jetMaterial = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: BEAM_VERTEX_SHADER, // vT/vCone 동일 — 콘 길이만 다르다
        fragmentShader: JET_FRAGMENT_SHADER,
        uniforms: {
          uLen: { value: jetLen },
          uPulse: { value: 1 },
          uOpacity: { value: 1 },
          uTime: { value: 0 },
          uHigh: { value: highFlag },
        },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [jetLen, highFlag],
  )

  const flareMaterial = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: FLARE_VERTEX_SHADER,
        fragmentShader: FLARE_FRAGMENT_SHADER,
        uniforms: { uIntensity: { value: 0 }, uOpacity: { value: 1 } },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [],
  )

  // 폴라캡 — 자기극 고온 핫스팟(가산 구). Bloom이 high에서 글로우로 증폭.
  const capColor = useMemo(() => new Color(color), [color])

  useEffect(() => () => beamMaterial.dispose(), [beamMaterial])
  useEffect(() => () => jetMaterial.dispose(), [jetMaterial])
  useEffect(() => () => flareMaterial.dispose(), [flareMaterial])

  useFrame((state, delta) => {
    const elapsed = state.clock.elapsedTime
    // 자전 — 자기축이 어긋나 빔이 원뿔을 쓴다(등대). 순수 Y축 회전(틸트는 부모 그룹).
    if (spinRef.current != null) spinRef.current.rotation.y += PULSAR_SPIN_RATE * delta
    setUniform(beamMaterial, 'uTime', elapsed)
    setUniform(jetMaterial, 'uTime', elapsed)

    // 등대 글로우 펄스 — 자기축 빔이 카메라를 향할 때만 중앙 플레어가 차오른다.
    // 빔 방향(자기축 그룹의 월드 Y) · 카메라 시선 정렬도 |dot|로 산출 → 쌍극이라 통과당 2회.
    let pulse = PULSAR_PULSE_MIN
    if (magneticRef.current != null && rootRef.current != null) {
      magneticRef.current.getWorldQuaternion(quatScratch)
      beamDirScratch.set(0, 1, 0).applyQuaternion(quatScratch).normalize()
      rootRef.current.getWorldPosition(worldScratch)
      toCamScratch.copy(state.camera.position).sub(worldScratch)
      const len = toCamScratch.length()
      if (len > 1e-4) {
        toCamScratch.multiplyScalar(1 / len)
        const align = Math.abs(beamDirScratch.dot(toCamScratch)) // [0,1]
        const t = Math.min(
          1,
          Math.max(0, (align - PULSE_ALIGN_THRESHOLD) / (1 - PULSE_ALIGN_THRESHOLD)),
        )
        const smooth = t * t * (3 - 2 * t) // smoothstep — 부드러운 펄스
        pulse = PULSAR_PULSE_MIN + (1 - PULSAR_PULSE_MIN) * smooth // 완전 소등 없음(대비 상한)
      }
    }
    // 빔도 카메라 향할 때 살짝 더 밝게(정면 단축 보정), 제트는 일정.
    setUniform(beamMaterial, 'uPulse', 0.7 + 0.6 * pulse)
    setUniform(flareMaterial, 'uIntensity', pulse)

    // 플레어 빌보드 — rootRef(무회전) 자식이라 camera.quaternion 복사로 정면 정렬.
    flareRef.current?.quaternion.copy(state.camera.quaternion)

    // crossfade — 멀어지면(퍼스펙티브 줌아웃) 포인트로 핸드오프. StarSurface와 동일 계약.
    if (flareMeshRef.current != null) {
      const distance = state.camera.position.distanceTo(
        flareMeshRef.current.getWorldPosition(worldScratch),
      )
      const opacity = 1 - crossfadeProgress(distance)
      setUniform(beamMaterial, 'uOpacity', opacity)
      setUniform(jetMaterial, 'uOpacity', opacity)
      setUniform(flareMaterial, 'uOpacity', opacity)
    }
  })

  return (
    <group ref={rootRef}>
      {/* 초고온 청백 본체 — StarSurface 재사용(코로나는 자체 빌보드, rootRef 무회전이라 정상) */}
      <StarSurface radius={radius} color={color} emissiveBoost={2.0} coronaScale={0.7} />

      {/* 자전축 틸트 그룹 — 제트·자전 전체를 3/4 시점으로 기울인다(자전은 순수 Y로 유지) */}
      <group rotation={PULSAR_BASE_TILT}>
        {/* 상대론적 쌍제트 — 자전축(Y) 정렬, 축 위라 자전과 무관하게 정적으로 보인다 */}
        <mesh material={jetMaterial} position={[0, jetCenter, 0]}>
          <coneGeometry args={[jetBase, jetLen, CONE_SEGMENTS, 1, true]} />
        </mesh>
        <mesh material={jetMaterial} position={[0, -jetCenter, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[jetBase, jetLen, CONE_SEGMENTS, 1, true]} />
        </mesh>

        {/* 자전 그룹 → 자기축 틸트 그룹: 폴라캡 + 등대 쌍극 빔이 회전과 함께 원뿔을 쓴다 */}
        <group ref={spinRef}>
          <group ref={magneticRef} rotation={[0, 0, PULSAR_MAGNETIC_OFFSET]}>
            {/* 자기극 폴라캡 핫스팟 */}
            <mesh position={[0, radius * 0.92, 0]}>
              <sphereGeometry args={[capRadius, 16, 16]} />
              <meshBasicMaterial color={capColor} blending={AdditiveBlending} depthWrite={false} />
            </mesh>
            <mesh position={[0, -radius * 0.92, 0]}>
              <sphereGeometry args={[capRadius, 16, 16]} />
              <meshBasicMaterial color={capColor} blending={AdditiveBlending} depthWrite={false} />
            </mesh>

            {/* 등대 쌍극 빔 */}
            <mesh material={beamMaterial} position={[0, beamCenter, 0]}>
              <coneGeometry args={[beamBase, beamLen, CONE_SEGMENTS, 1, true]} />
            </mesh>
            <mesh material={beamMaterial} position={[0, -beamCenter, 0]} rotation={[Math.PI, 0, 0]}>
              <coneGeometry args={[beamBase, beamLen, CONE_SEGMENTS, 1, true]} />
            </mesh>
          </group>
        </group>
      </group>

      {/* 중앙 글로우 플레어 — 빔 통과 시 부드럽게 차오름(빌보드) */}
      <group ref={flareRef}>
        <mesh ref={flareMeshRef} material={flareMaterial}>
          <planeGeometry args={[flareSize, flareSize]} />
        </mesh>
      </group>
    </group>
  )
}
