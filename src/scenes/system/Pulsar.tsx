import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  DoubleSide,
  Euler,
  type Group,
  Matrix4,
  type Mesh,
  RingGeometry,
  ShaderMaterial,
  Vector3,
} from 'three'

import { QUALITY_PRESETS } from '@/quality/presets'
import { setUniform } from '@/scenes/shared/starGlowMaterial'
import { usePrefersReducedMotion } from '@/scenes/shared/useReducedMotion'
import {
  PULSAR_BASE_TILT,
  PULSAR_DISK_OUTER_FACTOR,
  PULSAR_JET_LEN_FACTOR,
  PULSAR_JET_WIDTH_FACTOR,
  pulsarPulse,
  PULSAR_PULSE_MIN,
} from '@/scenes/system/exotic'
import { crossfadeProgress } from '@/scenes/system/starCrossfade'
import { StarSurface } from '@/scenes/system/StarSurface'
import { useGameStore } from '@/store'

/**
 * 펄서(중성자성) — 스텔라리스형 고품질 인씬 렌더 (펄서 결정 1~5 개정 2026-06-17).
 *
 * ① 파란 발광 본체(StarSurface) ② 자전축 정렬 **상대론적 쌍제트**(밑동이 밝게 불룩, 끝으로
 * 가늘어지는 가산 빔) ③ **적도 자기권 소용돌이**(AccretionDisk를 청색으로 각색, 차등 회전).
 * 전체가 은은히 맥동(pulsarPulse, ≤3Hz·완전 소등 없음, 광과민성 결정 5). 포스트이펙트 없음.
 *
 * 제트는 콘 셸 대신 **교차 빌보드 쿼드**(XY+YZ 십자) — 어느 각도서도 한 면이 카메라를 향해
 * 판때기로 보이지 않는다(이전 콘 셸이 회색 판으로 보인 피드백 해소).
 *
 * 셰이더 안전(블랙홀 교훈): 각도는 normalize(position.xy)로(atan 회피), 제곱은 d*d,
 * 위험 pow 금지, 출력 clamp. reduced-motion 시 회전·맥동 정지(AccretionDisk와 동일 a11y 계약).
 */

const SWIRL_DISK_INNER = 1.2
const SWIRL_THETA_SEGMENTS = 160
const SWIRL_RADIAL_SEGMENTS = 10
/** 중앙 글로우 코어 빌보드 한 변 = 본체 반경 × 이 배수. */
const CORE_GLOW_FACTOR = 7
/** 맥동 wave wrap — 장시간 세션 fp 정밀도 보호(pulsarPulse는 sin 1주기). */
const TIME_WRAP = 2 * Math.PI

/** 상대론적 제트 — 십자 빌보드 쿼드. 세로(축) 코어 밝고 밑동 불룩, 끝으로 가늘게 식는다. */
const JET_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const JET_FRAGMENT_SHADER = /* glsl */ `
  uniform float uOpacity;
  uniform float uPulse;
  varying vec2 vUv;
  void main() {
    float ax = abs(vUv.x - 0.5) * 2.0;   // 0=세로 중심축 ~ 1=폭 가장자리
    float ay = abs(vUv.y - 0.5) * 2.0;   // 0=별(중앙) ~ 1=제트 끝
    // 좁은 세로 코어(폭 방향으로 빠르게 감쇠) — clamp된 양수 밑 → pow NaN 안전
    float core = pow(clamp(1.0 - ax, 0.0, 1.0), 3.0);
    float along = pow(clamp(1.0 - ay, 0.0, 1.0), 0.7);          // 끝으로 가늘게 식음
    float bulge = pow(clamp(1.0 - ay, 0.0, 1.0), 7.0) * 1.6;    // 밑동(별 쪽) 밝은 불룩함
    float intensity = core * (along + bulge) * uPulse;
    vec3 col = vec3(0.70, 0.90, 1.30);   // 전기 청백
    gl_FragColor = vec4(col * intensity, clamp(intensity, 0.0, 1.0) * uOpacity);
  }
`

/** 적도 자기권 소용돌이 — AccretionDisk 청색 각색. 차등 회전 나선(NaN 안전 회전행렬). */
const SWIRL_VERTEX_SHADER = /* glsl */ `
  varying float vRadial;
  varying vec2 vDir;
  void main() {
    float r = length(position.xy);
    vRadial = clamp((r - ${SWIRL_DISK_INNER.toFixed(2)}) / ${(PULSAR_DISK_OUTER_FACTOR - SWIRL_DISK_INNER).toFixed(2)}, 0.0, 1.0);
    vDir = position.xy / r;   // r ≥ DISK_INNER > 0 → atan(0,0) NaN 회피
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const SWIRL_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform float uPulse;
  varying float vRadial;
  varying vec2 vDir;

  // 2D value noise + fbm (StarSurface 패턴 차용) — 부채꼴 sin 대신 유기적 난류 구름을 만든다.
  float hash2(vec2 p) {
    p = fract(p * vec2(0.3183099, 0.3678794) + vec2(0.71, 0.113));
    p *= 17.0;
    return fract(p.x * p.y * (p.x + p.y));
  }
  float noise2(vec2 x) {
    vec2 i = floor(x);
    vec2 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash2(i);
    float b = hash2(i + vec2(1.0, 0.0));
    float c = hash2(i + vec2(0.0, 1.0));
    float d = hash2(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  float fbm(vec2 p) {
    // 옥타브마다 도메인을 회전(M) + 비정수 lacunarity(2.13)로 격자 정렬을 어긋낸다.
    mat2 M = mat2(0.80, 0.60, -0.60, 0.80);
    float s = 0.0;
    float amp = 0.6;
    for (int i = 0; i < 3; i++) {
      s += amp * noise2(p);
      p = M * p * 2.13 + vec2(13.1, 7.7);
      amp *= 0.5;
    }
    return s;
  }

  void main() {
    vec3 hot = vec3(0.80, 0.93, 1.30);   // 안쪽 청백(뜨겁게)
    vec3 cool = vec3(0.24, 0.48, 0.95);  // 바깥 짙은 청
    vec3 col = mix(hot, cool, sqrt(vRadial));

    // 안쪽 밝고 바깥으로 감쇠하는 wispy 프로파일
    float body = smoothstep(0.0, 0.04, vRadial) * (1.0 - smoothstep(0.5, 1.0, vRadial));

    // 강체 회전(누적 winding 없음) — 좌표만 통째로 돌린다(atan 없이 NaN 안전).
    float a = uTime * 0.16;
    float cs = cos(a);
    float sn = sin(a);
    vec2 rd = vec2(cs * vDir.x - sn * vDir.y, sn * vDir.x + cs * vDir.y);
    vec2 tang = vec2(-rd.y, rd.x);   // 접선(궤도) 방향 단위벡터

    // 씨임 없는 2D 평면 좌표(반경 반영) — 안쪽 촘촘, 바깥 성김.
    vec2 p = rd * (0.6 + vRadial * 2.6);
    float flow = uTime * 0.18;

    // 도메인 워프 — 좌표 자체를 noise 벡터로 흩뜨려 value-noise 사각 격자(뱀비늘)를 유기적으로
    // 파괴한다(가장 강력한 anti-grid 기법). 접선 방향으로 더 크게 밀어 궤도 streak(회전감)도 만든다.
    vec2 wb = p * 1.9 + vec2(flow * 0.7, -flow * 0.5);
    float wx = fbm(wb) - 0.5;
    float wy = fbm(wb + vec2(7.3, 2.1)) - 0.5;
    vec2 warped = p + tang * (wx * 1.7) + rd * (wy * 0.5);

    float gas = fbm(warped * 3.0 + vec2(flow, -0.5 * flow));
    gas = clamp(0.18 + 1.35 * gas, 0.0, 1.5);

    float intensity = body * gas * uPulse;
    intensity = clamp(intensity, 0.0, 2.5);
    gl_FragColor = vec4(min(col * intensity * 1.5, vec3(5.0)), clamp(intensity, 0.0, 1.0) * uOpacity);
  }
`

/** 중앙 코어 글로우 — 본체를 감싸는 부드러운 청백 헤일로(빌보드). 맥동에 맞춰 호흡. */
const CORE_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const CORE_FRAGMENT_SHADER = /* glsl */ `
  uniform float uPulse;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float glow = pow(clamp(1.0 - d, 0.0, 1.0), 2.6);
    vec3 col = vec3(0.70, 0.88, 1.30);
    float a = glow * uPulse;
    gl_FragColor = vec4(col * a, clamp(a, 0.0, 1.0) * uOpacity);
  }
`

interface PulsarProps {
  /**
   * 중성자성 본체 반경 (= STAR_VISUAL_RADIUS × kindRadiusFactor('pulsar')).
   * **불변식: radius > 0** — 제트/디스크 셰이더가 반경 파생 길이를 쓴다(현재 호출 경로는 항상 양수).
   */
  readonly radius: number
  /** 본체·코로나 색 (EXOTIC_RENDER.pulsar — 전기 청백). */
  readonly color: string
}

export function Pulsar({ radius, color }: PulsarProps) {
  const rootRef = useRef<Group>(null) // 무회전 — 코어 글로우/코로나 빌보드·crossfade 기준계
  const coreRef = useRef<Group>(null) // 카메라 향 코어 글로우 빌보드
  const coreMeshRef = useRef<Mesh>(null)
  const jetRef = useRef<Group>(null) // 제트 실린더형 빌보드 — 축 고정, 축 둘레로 카메라 향해 회전

  const worldScratch = useMemo(() => new Vector3(), [])
  const viewScratch = useMemo(() => new Vector3(), [])
  const rightScratch = useMemo(() => new Vector3(), [])
  const normalScratch = useMemo(() => new Vector3(), [])
  const basisScratch = useMemo(() => new Matrix4(), [])
  // 제트 축(월드) — 자전축(Y)에 PULSAR_BASE_TILT를 적용. rootRef는 무회전이라 로컬=월드 방향.
  const jetAxis = useMemo(
    () => new Vector3(0, 1, 0).applyEuler(new Euler(...PULSAR_BASE_TILT)).normalize(),
    [],
  )

  // 펄서 인씬 셰이더는 쿼드+디스크라 저비용 → high 고정 않고 티어에 자연 대응. bloom=high 프록시.
  const isHigh = useGameStore((state) => QUALITY_PRESETS[state.qualityTier].bloom)
  const reducedMotion = usePrefersReducedMotion()

  const jetLen = radius * PULSAR_JET_LEN_FACTOR
  const jetWidth = radius * PULSAR_JET_WIDTH_FACTOR
  const coreSize = radius * CORE_GLOW_FACTOR
  // 본체가 더 또렷한 high에선 코로나를 약간 키운다(저티어는 Bloom 없으니 보수적).
  const coronaScale = isHigh ? 1.15 : 1.0

  const jetMaterial = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: JET_VERTEX_SHADER,
        fragmentShader: JET_FRAGMENT_SHADER,
        uniforms: { uOpacity: { value: 1 }, uPulse: { value: 1 } },
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        blending: AdditiveBlending,
      }),
    [],
  )

  const swirlMaterial = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: SWIRL_VERTEX_SHADER,
        fragmentShader: SWIRL_FRAGMENT_SHADER,
        uniforms: { uTime: { value: 0 }, uOpacity: { value: 1 }, uPulse: { value: 1 } },
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        blending: AdditiveBlending,
      }),
    [],
  )

  const coreMaterial = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: CORE_VERTEX_SHADER,
        fragmentShader: CORE_FRAGMENT_SHADER,
        uniforms: { uPulse: { value: 1 }, uOpacity: { value: 1 } },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [],
  )

  const swirlGeometry = useMemo(
    () =>
      new RingGeometry(
        SWIRL_DISK_INNER,
        PULSAR_DISK_OUTER_FACTOR,
        SWIRL_THETA_SEGMENTS,
        SWIRL_RADIAL_SEGMENTS,
      ),
    [],
  )

  useEffect(() => () => jetMaterial.dispose(), [jetMaterial])
  useEffect(() => () => swirlMaterial.dispose(), [swirlMaterial])
  useEffect(() => () => coreMaterial.dispose(), [coreMaterial])
  useEffect(() => () => swirlGeometry.dispose(), [swirlGeometry])

  useFrame((state) => {
    const elapsed = state.clock.elapsedTime
    // 은은한 맥동 — reduced면 중간값으로 고정(맥동 제거, 전정 민감성 배려).
    const pulse = reducedMotion ? (PULSAR_PULSE_MIN + 1) / 2 : pulsarPulse(elapsed % TIME_WRAP)
    setUniform(jetMaterial, 'uPulse', pulse)
    setUniform(coreMaterial, 'uPulse', pulse)
    // 소용돌이는 자체 차등 회전 — reduced면 uTime 정지(형태 유지). 맥동은 별도.
    setUniform(swirlMaterial, 'uTime', reducedMotion ? 0 : elapsed)
    setUniform(swirlMaterial, 'uPulse', 0.55 + 0.45 * pulse)

    // 코어 글로우 빌보드 — rootRef(무회전) 자식이라 camera.quaternion 복사로 정면 정렬.
    coreRef.current?.quaternion.copy(state.camera.quaternion)

    // 제트 실린더형 빌보드 — 축(jetAxis)은 고정하고 그 축 둘레로만 회전해 면이 카메라를 향한다.
    // 교차 쿼드의 십자 아티팩트(한 쿼드가 edge-on일 때 선으로 보임)를 없앤다.
    if (jetRef.current != null && rootRef.current != null) {
      rootRef.current.getWorldPosition(worldScratch)
      viewScratch.copy(state.camera.position).sub(worldScratch)
      rightScratch.crossVectors(jetAxis, viewScratch)
      if (rightScratch.lengthSq() > 1e-6) {
        // 축에 수직이고 카메라를 향하는 법선으로 직교기저 구성 (right, axis, normal)
        rightScratch.normalize()
        normalScratch.crossVectors(rightScratch, jetAxis).normalize()
        basisScratch.makeBasis(rightScratch, jetAxis, normalScratch)
        jetRef.current.quaternion.setFromRotationMatrix(basisScratch)
      }
      // 카메라가 축과 거의 평행(제트를 정면으로 내려다봄)이면 직전 방향 유지 — 갱신 생략.
    }

    // crossfade — 멀어지면 포인트로 핸드오프(StarSurface와 동일 계약).
    if (coreMeshRef.current != null) {
      const distance = state.camera.position.distanceTo(
        coreMeshRef.current.getWorldPosition(worldScratch),
      )
      const opacity = 1 - crossfadeProgress(distance)
      setUniform(jetMaterial, 'uOpacity', opacity)
      setUniform(swirlMaterial, 'uOpacity', opacity)
      setUniform(coreMaterial, 'uOpacity', opacity)
    }
  })

  return (
    <group ref={rootRef}>
      {/* 파란 발광 본체 — StarSurface 재사용(코로나는 자체 빌보드, rootRef 무회전이라 정상).
          emissiveBoost를 낮춰 입상반이 백색으로 워시아웃되지 않고 청색 질감이 드러나게 한다. */}
      <StarSurface radius={radius} color={color} emissiveBoost={1.55} coronaScale={coronaScale} />

      {/* 상대론적 쌍제트 — 실린더형 빌보드(축 둘레로만 회전, useFrame이 quaternion 설정).
          단일 쿼드라 십자 아티팩트 없음. 세로(축) 코어 + 밑동 불룩. */}
      <group ref={jetRef}>
        <mesh material={jetMaterial}>
          <planeGeometry args={[jetWidth, jetLen]} />
        </mesh>
      </group>

      {/* 적도 자기권 소용돌이 — XY 링을 자전축에 수직인 적도면으로 눕히고 3/4 틸트 */}
      <group rotation={PULSAR_BASE_TILT}>
        <mesh
          geometry={swirlGeometry}
          material={swirlMaterial}
          scale={radius}
          rotation={[-Math.PI / 2, 0, 0]}
        />
      </group>

      {/* 중앙 코어 글로우 — 본체를 감싸는 청백 헤일로(빌보드), 맥동에 맞춰 호흡 */}
      <group ref={coreRef}>
        <mesh ref={coreMeshRef} material={coreMaterial}>
          <planeGeometry args={[coreSize, coreSize]} />
        </mesh>
      </group>
    </group>
  )
}
