import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, type Group, ShaderMaterial, Vector3 } from 'three'

import { setUniform } from '@/scenes/shared/starGlowMaterial'
import { StarSurface } from '@/scenes/system/StarSurface'
import { crossfadeProgress } from '@/scenes/system/starCrossfade'

/**
 * 펄서(중성자성) — 작고 강렬한 본체 + 자전축에 정렬된 좁은 가산 제트 콘 2개 + 등대 점멸 (결정 5).
 *
 * 제트는 좁은 핫코어에 에너지를 집중(결정 26/38 — 넓은 소프트 글로우 금지). 자기축이 자전축과
 * 어긋나(MAGNETIC_OFFSET) 자전 시 빔이 원뿔을 쓸고, 관측 점멸은 ≤3Hz로 제한(광과민성, 결정 5).
 */

const JET_LEN_FACTOR = 7 // 제트 길이 = 본체 반경 × 이 배수
const JET_BASE_FACTOR = 0.55 // 제트 밑동 반경(좁게)
const JET_SEGMENTS = 20
const SPIN_RATE = 2.2 // 자전 각속도 (rad/s) — 빔 스윕
const BLINK_HZ = 1.4 // 관측 점멸 주파수 (≤3Hz, 광과민성 상한)
const PULSE_MIN = 0.35 // 점멸 최저 강도 (완전 소등 아님 — 대비 상한)
const MAGNETIC_OFFSET = 0.5 // 자기축 ↔ 자전축 어긋남 (rad)
const TWO_PI = Math.PI * 2

const JET_VERTEX_SHADER = /* glsl */ `
  uniform float uJetLen;
  varying float vT;
  void main() {
    vT = position.y / uJetLen + 0.5;  // 0=밑동(별 쪽) ~ 1=끝
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const JET_FRAGMENT_SHADER = /* glsl */ `
  uniform float uPulse;
  uniform float uOpacity;
  varying float vT;
  void main() {
    // 밑동(별 쪽)이 밝고 끝으로 갈수록 식는 좁은 핫코어
    float core = pow(clamp(1.0 - vT, 0.0, 1.0), 1.6);
    vec3 col = vec3(0.72, 0.9, 1.25);  // 전기 청백
    float intensity = core * uPulse;
    gl_FragColor = vec4(col * intensity, intensity * uOpacity);
  }
`

interface PulsarProps {
  readonly radius: number
  /** 본체·코로나 색 (EXOTIC_RENDER pulsar). */
  readonly color: string
}

export function Pulsar({ radius, color }: PulsarProps) {
  const rootRef = useRef<Group>(null)
  const spinRef = useRef<Group>(null)
  const worldScratch = useMemo(() => new Vector3(), [])

  const jetLen = radius * JET_LEN_FACTOR
  const jetBase = radius * JET_BASE_FACTOR
  const jetCenter = radius + jetLen / 2

  const jetMaterial = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: JET_VERTEX_SHADER,
        fragmentShader: JET_FRAGMENT_SHADER,
        uniforms: { uJetLen: { value: jetLen }, uPulse: { value: 1 }, uOpacity: { value: 1 } },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [jetLen],
  )

  useEffect(() => () => jetMaterial.dispose(), [jetMaterial])

  useFrame((state, delta) => {
    // 자전 — 자기축이 어긋나 빔이 원뿔을 쓴다 (등대).
    if (spinRef.current != null) spinRef.current.rotation.y += SPIN_RATE * delta
    // 관측 점멸 — ≤3Hz, 완전 소등하지 않음(대비 상한, 광과민성).
    const pulse = PULSE_MIN + (1 - PULSE_MIN) * (0.5 + 0.5 * Math.sin(TWO_PI * BLINK_HZ * state.clock.elapsedTime))
    setUniform(jetMaterial, 'uPulse', pulse)
    // 워프 도착 크로스페이드 (StarSurface 본체와 동일 계약).
    if (rootRef.current != null) {
      const distance = state.camera.position.distanceTo(rootRef.current.getWorldPosition(worldScratch))
      setUniform(jetMaterial, 'uOpacity', 1 - crossfadeProgress(distance))
    }
  })

  return (
    <group ref={rootRef} rotation={[0.3, 0, 0.2]}>
      {/* 중성자성 본체 — 작고 강렬한 청백 */}
      <StarSurface radius={radius} color={color} emissiveBoost={1.8} coronaScale={0.6} />
      <group ref={spinRef}>
        <group rotation={[0, 0, MAGNETIC_OFFSET]}>
          <mesh material={jetMaterial} position={[0, jetCenter, 0]}>
            <coneGeometry args={[jetBase, jetLen, JET_SEGMENTS, 1, true]} />
          </mesh>
          <mesh material={jetMaterial} position={[0, -jetCenter, 0]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[jetBase, jetLen, JET_SEGMENTS, 1, true]} />
          </mesh>
        </group>
      </group>
    </group>
  )
}
