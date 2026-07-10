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
import { setUniform } from '@/scenes/shared/starGlowMaterial'
import { usePrefersReducedMotion } from '@/scenes/shared/useReducedMotion'
import { bodyPositions } from '@/scenes/system/multiplicity'
import { simClock } from '@/scenes/system/simClock'
import { crossfadeProgress } from '@/scenes/system/starCrossfade'

/**
 * 로슈엽 물질 스트림 (exotic-codex) — 카리브디스(feeding_bh) 전용.
 *
 * 근접 반성의 바깥층이 로슈엽을 넘어 블랙홀 강착원반으로 흘러드는 나선 리본.
 * 실제 저질량 X선 쌍성처럼 물질은 반성 표면에서 출발해 궤도 운동에 뒤처지며(코리올리)
 * 나선으로 감겨 원반 *외곽 가장자리*에 합류한다 — 원반 위로 떨어지지 않는다.
 *
 * 지오메트리는 (t, side) 파라미터만 담고 실제 반경·감김은 셰이더 유니폼으로 준다 —
 * 반성 궤도가 케플러(e=0 원)라 별-BH 거리가 일정하므로 그룹 회전만 매 프레임 갱신한다
 * (bodyPositions 동일 수식·simClock 동일 시계 → 별 위치와 항상 정합, 철칙 6 ref+useFrame).
 * 렌더 전용 — GEN_VERSION·저장 포맷 무관.
 */

/** 리본 세그먼트 수 — 나선이 매끈하게 보이는 최소한. */
const SEGMENTS = 64
/** 나선 감김 각(라디안) — 반성에서 원반 가장자리까지 ~140° 뒤처지며 감긴다. */
const SWEEP_RAD = 2.45
/** 스트림 폭(월드) — 시작(반성 쪽) 좁고 원반 합류부에서 살짝 퍼진다. */
const WIDTH_START = 0.5
const WIDTH_END = 1.4

const VERTEX_SHADER = /* glsl */ `
  attribute float aT;
  attribute float aSide;
  uniform float uStartR;   // 반성 표면 근방 반경(월드)
  uniform float uEndR;     // 원반 합류 반경(월드)
  uniform float uWidthScale;
  varying float vT;
  varying float vSide;

  // 나선 중심선 — t∈[0,1]: 반성(각 0, r=uStartR) → 원반(각 -SWEEP, r=uEndR).
  vec2 streamCenter(float t) {
    float r = mix(uStartR, uEndR, t);
    float angle = -${SWEEP_RAD.toFixed(2)} * t;
    return vec2(cos(angle), sin(angle)) * r;
  }

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

    // 가장자리·양 끝 페이드 — 리본 티 안 나게.
    float across = 1.0 - vSide * vSide;
    float along = smoothstep(0.0, 0.12, vT) * (1.0 - smoothstep(0.82, 1.0, vT) * 0.35);

    float intensity = flow * clump * across * along;
    gl_FragColor = vec4(col * intensity * 1.6, clamp(intensity, 0.0, 1.0) * uOpacity);
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
  const geometry = useMemo(() => buildStreamGeometry(), [])
  const bodyScratch = useMemo(() => [new Vector3(), new Vector3(), new Vector3()], [])
  const worldScratch = useMemo(() => new Vector3(), [])

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        uniforms: {
          uTime: { value: 0 },
          uOpacity: { value: 1 },
          uStartR: { value: 1 },
          uEndR: { value: 1 },
          uWidthScale: { value: 1 },
        },
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        blending: AdditiveBlending,
      }),
    [],
  )

  useEffect(() => {
    return () => {
      material.dispose()
      geometry.dispose()
    }
  }, [material, geometry])

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
    setUniform(material, 'uStartR', distance - companionRadius * 0.35)
    setUniform(material, 'uEndR', bhRadius * diskOuterFactor * 0.8)

    // reduced-motion: 흐름 줄무늬 정지 — 형태는 유지 (AccretionDisk와 동일 배려).
    setUniform(material, 'uTime', reducedMotion ? 0 : simClock.now)

    // 워프 도착 크로스페이드 — StarSurface·AccretionDisk와 동일 계약 (도착 팝인 방지).
    const cameraDistance = state.camera.position.distanceTo(group.getWorldPosition(worldScratch))
    setUniform(material, 'uOpacity', 1 - crossfadeProgress(cameraDistance))
  })

  return (
    <group ref={groupRef}>
      <mesh geometry={geometry} material={material} frustumCulled={false} />
    </group>
  )
}
