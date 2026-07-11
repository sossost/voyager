import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  type Group,
  ShaderMaterial,
  Vector3,
} from 'three'

import type { Star } from '@/engine'
import { QUALITY_PRESETS } from '@/quality/presets'
import { usePrefersReducedMotion } from '@/scenes/shared/useReducedMotion'
import { useGameStore } from '@/store'
import { bodyPositions } from '@/scenes/system/multiplicity'
import { simClock } from '@/scenes/system/simClock'
import { crossfadeProgress } from '@/scenes/system/starCrossfade'

/**
 * 로슈엽 물질 스트림 (exotic-codex) — 카리브디스(feeding_bh) 전용.
 *
 * 근접 반성의 바깥층이 로슈엽을 넘어 블랙홀 강착원반으로 흘러드는 3겹 적층:
 *  ① 리본 — 흐름의 바닥 글로우(나선 경로 자체).
 *  ② 유입 파티클 — 반성 표면에서 떨어져 나와 나선을 타고 흘러가는 물질 덩어리.
 *     케플러 자유낙하처럼 안쪽일수록 빨라지고(t 비선형 가속) 달궈져 밝아진다 — "빨려드는" 독법의 핵심.
 *  ③ 합류 핫스팟 — 스트림이 원반 가장자리를 때리는 충돌 광점(실제 LMXB의 hot spot), 명멸.
 *
 * 지오메트리는 파라미터(t·side·위상)만 담고 실제 반경·감김은 셰이더 유니폼으로 준다 —
 * 반성 궤도가 케플러(e=0 원)라 별-BH 거리가 일정하므로 그룹 회전만 매 프레임 갱신한다
 * (bodyPositions 동일 수식·simClock 동일 시계 → 별 위치와 항상 정합, 철칙 6 ref+useFrame).
 * 파티클 위상은 인덱스 해시(전역 난수 금지 — 마운트 간 결정론). 렌더 전용 — GEN_VERSION 무관.
 */

/** 리본 세그먼트 수 — 나선이 매끈하게 보이는 최소한. */
const SEGMENTS = 64
/** 나선 감김 각(라디안) — 반성에서 원반 가장자리까지 ~140° 뒤처지며 감긴다. */
const SWEEP_RAD = 2.45
/** 스트림 폭(월드) — 시작(반성 쪽) 좁고 원반 합류부에서 살짝 퍼진다. */
const WIDTH_START = 0.5
const WIDTH_END = 1.4
/** 유입 파티클 수 — 가산 블렌딩이라 과하면 블룸이 하얗게 뭉갠다. */
const PARTICLE_COUNT = 220
/** 파티클 한 사이클(반성→원반) 시간(초, simClock 기준) — 배속 시 함께 빨라진다. */
const PARTICLE_CYCLE_SEC = 4.2
/** 파티클 가속 지수 — s^EXP로 재매핑해 안쪽(t→1)에서 이동 속도가 치솟는다 (자유낙하 독법). */
const PARTICLE_ACCEL_EXP = 0.55

/** 나선 중심선 GLSL — 리본·파티클 셰이더 공용 (동일 경로 보장). */
const STREAM_CENTER_GLSL = /* glsl */ `
  uniform float uStartR;   // 반성 표면 근방 반경(월드)
  uniform float uEndR;     // 원반 합류 반경(월드)

  // t∈[0,1]: 반성(각 0, r=uStartR) → 원반(각 +SWEEP, r=uEndR).
  // 감김 방향은 궤도 진행(+각, CCW)과 같은 쪽 — 각운동량 보존으로 안쪽 물질이 공전보다
  // 빨라져 반성 "앞쪽"으로 감긴다 (뒤처짐(-각)은 물리 반대 — 고증 수정 2026-07-11).
  vec2 streamCenter(float t) {
    float r = mix(uStartR, uEndR, t);
    float angle = ${SWEEP_RAD.toFixed(2)} * t;
    return vec2(cos(angle), sin(angle)) * r;
  }
`

const VERTEX_SHADER = /* glsl */ `
  attribute float aT;
  attribute float aSide;
  uniform float uWidthScale;
  varying float vT;
  varying float vSide;
  ${STREAM_CENTER_GLSL}

  void main() {
    vT = aT;
    vSide = aSide;
    vec2 center = streamCenter(aT);
    // 접선의 수직 방향으로 리본 폭 전개 — 수치 미분(NaN 안전, 분모 하한).
    vec2 ahead = streamCenter(min(aT + 0.02, 1.0));
    vec2 tangent = ahead - center;
    float len = max(length(tangent), 1e-4);
    vec2 normal = vec2(-tangent.y, tangent.x) / len;
    float halfWidth = mix(${WIDTH_START.toFixed(2)}, ${WIDTH_END.toFixed(2)}, aT) * 0.5 * uWidthScale;
    vec2 p = center + normal * aSide * halfWidth;
    // 궤도면(XZ)에 눕힌다 — 별·원반과 같은 평면.
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p.x, 0.0, p.y, 1.0);
  }
`

const FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  varying float vT;
  varying float vSide;

  void main() {
    // 온도 — 반성 표면(주황, K형 광구가 뜯겨 나옴) → 원반 합류부(달궈진 백황).
    vec3 cool = vec3(1.05, 0.55, 0.28);
    vec3 hot = vec3(1.0, 0.9, 0.72);
    vec3 col = mix(cool, hot, smoothstep(0.25, 1.0, vT));

    // 흐름 줄무늬 — BH 쪽(+t 방향)으로 흘러가는 덩어리들. sin 합성이라 NaN 안전.
    float flow = 0.6 + 0.4 * sin(vT * 26.0 - uTime * 3.2);
    float clump = 0.75 + 0.25 * sin(vT * 61.0 - uTime * 5.1 + vSide * 2.0);

    // 가장자리·양 끝 페이드 — 리본 티 안 나게. 파티클이 주인공이라 바닥 글로우는 절제(0.45).
    float across = 1.0 - vSide * vSide;
    float along = smoothstep(0.0, 0.12, vT) * (1.0 - smoothstep(0.82, 1.0, vT) * 0.35);

    float intensity = flow * clump * across * along * 0.45;
    gl_FragColor = vec4(col * intensity * 1.6, clamp(intensity, 0.0, 1.0) * uOpacity);
  }
`

const PARTICLE_VERTEX_SHADER = /* glsl */ `
  attribute float aPhase;    // 사이클 시작 위상 [0,1)
  attribute float aLateral;  // 경로 수직 오프셋 [-1,1]
  attribute float aSize;     // 크기 배율 [0.6,1.6]
  uniform float uTime;
  uniform float uCycle;
  uniform float uWidthScale;
  varying float vT;
  varying float vSeed;
  ${STREAM_CENTER_GLSL}

  void main() {
    // 진행도 — 등속 s를 s^EXP로 재매핑: 안쪽(t→1)에서 dt/ds가 커져 눈에 띄게 가속한다.
    float s = fract(aPhase + uTime / uCycle);
    float t = pow(s, ${PARTICLE_ACCEL_EXP.toFixed(2)});
    vT = t;
    vSeed = aPhase;

    vec2 center = streamCenter(t);
    vec2 ahead = streamCenter(min(t + 0.02, 1.0));
    vec2 tangent = ahead - center;
    float len = max(length(tangent), 1e-4);
    vec2 normal = vec2(-tangent.y, tangent.x) / len;
    // 스트림 폭 안에서 각자 자기 유선(streamline)을 탄다 — 폭은 리본과 동일 테이퍼.
    float halfWidth = mix(${WIDTH_START.toFixed(2)}, ${WIDTH_END.toFixed(2)}, t) * 0.5 * uWidthScale;
    vec2 p = center + normal * aLateral * halfWidth * 0.8;

    vec4 mv = modelViewMatrix * vec4(p.x, 0.0, p.y, 1.0);
    // 안쪽일수록 조석으로 길게 찢기는 대신(포인트라 불가) 살짝 커지고 밝아진다.
    float grow = 1.0 + 0.7 * t;
    gl_PointSize = aSize * grow * 130.0 / max(-mv.z, 1.0);
    gl_Position = projectionMatrix * mv;
  }
`

const PARTICLE_FRAGMENT_SHADER = /* glsl */ `
  uniform float uOpacity;
  varying float vT;
  varying float vSeed;

  void main() {
    // 원형 소프트 스프라이트 — 중심 코어 + 부드러운 헤일로.
    vec2 d = gl_PointCoord - 0.5;
    float r2 = dot(d, d) * 4.0;
    float core = exp(-r2 * 6.0);
    float halo = exp(-r2 * 1.8) * 0.35;

    // 온도 상승 — 떨어질수록(마찰 가열) 주황 → 백황.
    vec3 cool = vec3(1.0, 0.55, 0.3);
    vec3 hot = vec3(1.0, 0.93, 0.78);
    vec3 col = mix(cool, hot, smoothstep(0.3, 1.0, vT));

    // 출발 직후 페이드인(별 표면에서 스며 나오듯) + 밝기는 안쪽으로 상승(가열).
    float birth = smoothstep(0.0, 0.08, vT);
    float heat = 0.35 + 0.85 * vT * vT;

    float intensity = (core + halo) * birth * heat;
    gl_FragColor = vec4(col * intensity * 1.7, clamp(intensity, 0.0, 1.0) * uOpacity);
  }
`

const HOTSPOT_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    // 카메라 정면 빌보드 — 뷰공간에서 쿼드를 편다 (충돌 광점은 방향성 없는 발광).
    // 메시 scale은 modelViewMatrix 열벡터 길이로 복원한다 (중심점 변환은 스케일을 잃는다).
    vec4 mvCenter = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    float scale = length(vec3(modelViewMatrix[0]));
    mvCenter.xy += position.xy * 2.0 * scale;
    gl_Position = projectionMatrix * mvCenter;
  }
`

const HOTSPOT_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  varying vec2 vUv;

  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float r2 = dot(p, p);
    // 명멸 — 두 주파수 합성(불규칙한 충돌 광도 요동), 완전 소등 없음.
    float flicker = 0.72 + 0.2 * sin(uTime * 7.3) + 0.08 * sin(uTime * 17.1 + 1.7);
    float glow = exp(-r2 * 5.0) * flicker;
    vec3 col = vec3(1.0, 0.9, 0.7);
    gl_FragColor = vec4(col * glow * 2.2, clamp(glow, 0.0, 1.0) * uOpacity);
  }
`

/** (t, side) 리본 지오메트리 — 위치는 셰이더가 유니폼으로 계산하므로 파라미터만 담는다. */
function buildStreamGeometry(): BufferGeometry {
  const vertexCount = (SEGMENTS + 1) * 2
  const positions = new Float32Array(vertexCount * 3) // 셰이더가 덮어쓰지만 바운딩용 자리
  const ts = new Float32Array(vertexCount)
  const sides = new Float32Array(vertexCount)
  const indices: number[] = []

  for (let i = 0; i <= SEGMENTS; i++) {
    const t = i / SEGMENTS
    for (let s = 0; s < 2; s++) {
      const v = i * 2 + s
      ts[v] = t
      sides[v] = s === 0 ? -1 : 1
    }
    if (i < SEGMENTS) {
      const v = i * 2
      indices.push(v, v + 1, v + 2, v + 1, v + 3, v + 2)
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('aT', new BufferAttribute(ts, 1))
  geometry.setAttribute('aSide', new BufferAttribute(sides, 1))
  geometry.setIndex(indices)
  // 위치를 셰이더가 만들므로 절두체 컬링을 끈다 — 바운딩 구가 무의미.
  return geometry
}

/** 인덱스 해시 [0,1) — 전역 난수 없이 파티클 속성을 결정론적으로 분산한다. */
function hash01(index: number, salt: number): number {
  const x = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453
  return x - Math.floor(x)
}

/** 유입 파티클 지오메트리 — 위상·수직 오프셋·크기만 담는 Points. */
function buildParticleGeometry(): BufferGeometry {
  const positions = new Float32Array(PARTICLE_COUNT * 3)
  const phases = new Float32Array(PARTICLE_COUNT)
  const laterals = new Float32Array(PARTICLE_COUNT)
  const sizes = new Float32Array(PARTICLE_COUNT)

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    phases[i] = hash01(i, 1)
    laterals[i] = hash01(i, 2) * 2 - 1
    sizes[i] = 0.6 + hash01(i, 3)
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('aPhase', new BufferAttribute(phases, 1))
  geometry.setAttribute('aLateral', new BufferAttribute(laterals, 1))
  geometry.setAttribute('aSize', new BufferAttribute(sizes, 1))
  return geometry
}

interface MatterStreamProps {
  readonly star: Star
  /** 블랙홀 본체(사건지평선) 시각 반경 — 원반 합류 반경 산출용. */
  readonly bhRadius: number
  /** 반성 시각 반경 — 스트림 시작점을 별 표면 근방에 붙이는 용도. */
  readonly companionRadius: number
  /** 강착원반 외곽 = bhRadius × 이 배수 (CurrentSystem diskOuter와 동일 값). */
  readonly diskOuterFactor: number
}

export function MatterStream({
  star,
  bhRadius,
  companionRadius,
  diskOuterFactor,
}: MatterStreamProps) {
  const groupRef = useRef<Group>(null)
  const reducedMotion = usePrefersReducedMotion()
  // 레이마칭 티어에선 스트림도 포스트 패스가 그린다(BlackHoleRayMarchEffect streamSample) —
  // 씬 공간 버전은 레이마칭 전담 영역에 덮여 사라지므로 페이크 경로(steps=0)에서만 렌더.
  // BlackHole 본체와 동일 게이트.
  const renderFake = useGameStore(
    (state) => QUALITY_PRESETS[state.qualityTier].blackHoleSteps === 0,
  )
  const geometry = useMemo(() => buildStreamGeometry(), [])
  const particleGeometry = useMemo(() => buildParticleGeometry(), [])
  const bodyScratch = useMemo(() => [new Vector3(), new Vector3(), new Vector3()], [])
  const worldScratch = useMemo(() => new Vector3(), [])

  // 원반 합류 반경 — 리본·파티클 uEndR과 핫스팟 위치의 단일 소스.
  const endR = bhRadius * diskOuterFactor * 0.8
  // 핫스팟 = 나선 끝점(t=1): 각 +SWEEP_RAD, 반경 endR (그룹 로컬 — 그룹이 반성 방향으로 회전).
  const hotspotPos = useMemo(
    () => [Math.cos(SWEEP_RAD) * endR, 0, Math.sin(SWEEP_RAD) * endR] as const,
    [endR],
  )
  const hotspotScale = bhRadius * 2.6

  const sharedUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uOpacity: { value: 1 },
      uStartR: { value: 1 },
      uEndR: { value: endR },
      uWidthScale: { value: 1 },
      uCycle: { value: PARTICLE_CYCLE_SEC },
    }),
    // endR 변경은 유니크계 전환뿐 — 마운트 단위라 실질 1회.
    [endR],
  )

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        uniforms: sharedUniforms,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        blending: AdditiveBlending,
      }),
    [sharedUniforms],
  )

  const particleMaterial = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: PARTICLE_VERTEX_SHADER,
        fragmentShader: PARTICLE_FRAGMENT_SHADER,
        uniforms: sharedUniforms,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [sharedUniforms],
  )

  const hotspotMaterial = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: HOTSPOT_VERTEX_SHADER,
        fragmentShader: HOTSPOT_FRAGMENT_SHADER,
        uniforms: sharedUniforms,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: AdditiveBlending,
      }),
    [sharedUniforms],
  )

  useEffect(() => {
    return () => {
      material.dispose()
      particleMaterial.dispose()
      hotspotMaterial.dispose()
      geometry.dispose()
      particleGeometry.dispose()
    }
  }, [material, particleMaterial, hotspotMaterial, geometry, particleGeometry])

  useFrame((state) => {
    const group = groupRef.current
    if (group == null) return

    // 별 위치 — CurrentSystem과 같은 수식·같은 시계(simClock)라 항상 정합.
    const count = bodyPositions(star, simClock.now, bodyScratch)
    if (count < 2) {
      group.visible = false
      return
    }
    group.visible = true
    const bh = bodyScratch[0] as Vector3
    const companion = bodyScratch[1] as Vector3

    // 그룹 원점 = BH, +X가 반성을 향하도록 회전 (셰이더 나선의 각 0 기준).
    group.position.copy(bh)
    const dx = companion.x - bh.x
    const dz = companion.z - bh.z
    group.rotation.y = -Math.atan2(dz, dx)

    const distance = Math.sqrt(dx * dx + dz * dz)
    // 반성 표면 안쪽에서 출발해(뜯겨 나오는 인상) 원반 외곽 살짝 안에서 합류.
    sharedUniforms.uStartR.value = distance - companionRadius * 0.35

    // reduced-motion: 흐름·파티클·명멸 정지 — 형태는 유지 (AccretionDisk와 동일 배려).
    sharedUniforms.uTime.value = reducedMotion ? 0 : simClock.now

    // 워프 도착 크로스페이드 — StarSurface·AccretionDisk와 동일 계약 (도착 팝인 방지).
    const cameraDistance = state.camera.position.distanceTo(group.getWorldPosition(worldScratch))
    sharedUniforms.uOpacity.value = 1 - crossfadeProgress(cameraDistance)
  })

  if (!renderFake) return null

  return (
    <group ref={groupRef}>
      <mesh geometry={geometry} material={material} frustumCulled={false} />
      <points geometry={particleGeometry} material={particleMaterial} frustumCulled={false} />
      {/* 합류 핫스팟 — 스트림이 원반 가장자리를 때리는 충돌 광점 (LMXB hot spot). */}
      <mesh
        material={hotspotMaterial}
        position={[hotspotPos[0], hotspotPos[1], hotspotPos[2]]}
        scale={hotspotScale}
        renderOrder={1}
      >
        <planeGeometry args={[1, 1]} />
      </mesh>
    </group>
  )
}
