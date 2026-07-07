import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { DoubleSide, Euler, type Mesh, RingGeometry, ShaderMaterial, Vector3 } from 'three'

import { currentBodies } from '@/scenes/system/currentBodies'
import { getRingTexture } from '@/scenes/system/ringTexture'

/**
 * 토성형 행성 고리 — 방사형 텍스처(ringTexture)를 적도면에 두른다.
 * 단일 평면 단색 대신 띠·간극·밝기 그라데이션이 드러나도록,
 * 고리 지오메트리의 UV를 "안쪽=0, 바깥쪽=1"의 반경 좌표로 다시 매핑한다.
 *
 * 조명 (O-3): unlit meshBasicMaterial 대신 커스텀 셰이더로 별빛에 반응한다 —
 * 램버트 음영(양면) + 행성 본체가 고리에 드리우는 그림자(umbra)를 해석적으로 판정한다
 * (그림자맵 불필요). 광원은 주성 1개만 반영한다(동반성 광원 생략, AtmosphereLimb와 동일).
 *
 * 연속 값(공전·자전)은 부모 그룹이 useFrame으로 돌리므로 위치는 정적이고,
 * 광원·행성 월드 좌표 유니폼만 매 프레임 갱신한다.
 */

/** 행성 반경 대비 고리 안/바깥 모서리 — 실제 토성 고리 비율(약 1.2~2.3R). */
export const RING_INNER = 1.2
export const RING_OUTER = 2.3
const RING_THETA_SEGMENTS = 160
/** 적도면을 향한 기울기 — 토성 자전축 경사(약 26.7°)를 흉내 낸다. */
const RING_TILT_X = -Math.PI / 2 + 0.46
const RING_TILT_Z = 0.08

/**
 * 고리면 월드 노멀 — 부모(행성 그룹·시스템 그룹)에 회전이 없으므로 메시 틸트만으로 결정되는
 * 상수다. RingGeometry는 XY 평면(노멀 +Z)이라 틸트 오일러를 +Z에 적용한다.
 * 행성 표면의 고리 그림자 판정(ringShadow.ts)이 공유한다.
 */
export const RING_PLANE_NORMAL = new Vector3(0, 0, 1).applyEuler(
  new Euler(RING_TILT_X, 0, RING_TILT_Z),
)

/** 별빛이 닿지 않는 면·그림자 속 고리의 바닥 밝기 — 주변광(O-2)과 같은 잔광 수준. */
const RING_AMBIENT_FLOOR = 0.2
/** 행성 umbra 속 고리에 남는 밝기 비율 — 0이면 완전 소등, 잔광을 조금 남긴다. */
const RING_UMBRA_FLOOR = 0.12
/** umbra 경계 반그림자(penumbra) 폭 — 행성 반경 대비 안/바깥 비율. */
const PENUMBRA_INNER = 0.88
const PENUMBRA_OUTER = 1.12

const RING_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;

  void main() {
    vUv = uv;
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPosition.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`

const RING_FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uStarPos;
  uniform vec3 uPlanetCenter;
  uniform float uPlanetRadius;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;

  // 행성 그림자 해석 판정 — 프래그먼트→별 광선이 행성 구를 지나면 그림자(1).
  // 광선 위 행성 중심의 최근접 거리로 판정하고, 반경 경계에 반그림자를 준다.
  float planetShadow(vec3 p) {
    vec3 toStar = uStarPos - p;
    float lenToStar = length(toStar);
    vec3 dir = toStar / lenToStar;
    float t = dot(uPlanetCenter - p, dir);
    if (t <= 0.0 || t >= lenToStar) return 0.0;
    float dist = length(uPlanetCenter - p - dir * t);
    return 1.0 - smoothstep(
      uPlanetRadius * ${PENUMBRA_INNER.toFixed(2)},
      uPlanetRadius * ${PENUMBRA_OUTER.toFixed(2)},
      dist
    );
  }

  void main() {
    vec4 tex = texture2D(uMap, vUv);
    // 얇은 고리는 양면이 모두 별빛을 받는다 — 램버트 절댓값 + 잔광 바닥.
    vec3 toStar = normalize(uStarPos - vWorldPos);
    float lit = abs(dot(normalize(vWorldNormal), toStar));
    float shade = ${RING_AMBIENT_FLOOR.toFixed(2)} + (1.0 - ${RING_AMBIENT_FLOOR.toFixed(2)}) * lit;
    float shadow = planetShadow(vWorldPos);
    vec3 color = tex.rgb * shade * mix(1.0, ${RING_UMBRA_FLOOR.toFixed(2)}, shadow);
    gl_FragColor = vec4(color, tex.a);
  }
`

/**
 * 단위 반경(1) 고리 지오메트리 — 반경 방향 UV로 재매핑한 싱글톤.
 * 행성별 크기는 메시 scale로 처리하므로 지오메트리는 한 번만 만든다.
 */
function makeRingGeometry(): RingGeometry {
  const geometry = new RingGeometry(RING_INNER, RING_OUTER, RING_THETA_SEGMENTS, 1)
  const position = geometry.attributes.position
  const uv = geometry.attributes.uv
  if (position == null || uv == null) return geometry
  for (let i = 0; i < position.count; i++) {
    const radius = Math.hypot(position.getX(i), position.getY(i))
    const radial = (radius - RING_INNER) / (RING_OUTER - RING_INNER)
    uv.setXY(i, radial, 0.5)
  }
  uv.needsUpdate = true
  return geometry
}

let cachedGeometry: RingGeometry | null = null

function ringGeometry(): RingGeometry {
  if (cachedGeometry == null) cachedGeometry = makeRingGeometry()
  return cachedGeometry
}

interface RingMaterial {
  readonly material: ShaderMaterial
  /** 매 프레임 갱신하는 유니폼 — 인덱스 조회 없이 직접 참조한다 (AtmosphereLimb 패턴). */
  readonly starPos: Vector3
  readonly planetCenter: Vector3
  readonly planetRadius: { value: number }
}

function createRingMaterial(): RingMaterial {
  const starPos = new Vector3(0, 0, 0)
  const planetCenter = new Vector3()
  const planetRadius = { value: 1 }
  const material = new ShaderMaterial({
    vertexShader: RING_VERTEX_SHADER,
    fragmentShader: RING_FRAGMENT_SHADER,
    uniforms: {
      uMap: { value: getRingTexture() },
      uStarPos: { value: starPos },
      uPlanetCenter: { value: planetCenter },
      uPlanetRadius: planetRadius,
    },
    transparent: true,
    side: DoubleSide,
    depthWrite: false,
  })
  return { material, starPos, planetCenter, planetRadius }
}

interface PlanetRingsProps {
  readonly planetVisualRadius: number
}

export function PlanetRings({ planetVisualRadius }: PlanetRingsProps) {
  const meshRef = useRef<Mesh>(null)
  const geometry = useMemo(() => ringGeometry(), [])
  const { material, starPos, planetCenter, planetRadius } = useMemo(
    () => createRingMaterial(),
    [],
  )
  const scaleScratch = useMemo(() => new Vector3(), [])

  // 머티리얼은 수동 생성이라 언마운트 시 명시적으로 해제한다 (텍스처는 공유 싱글톤이라 유지).
  useEffect(() => () => material.dispose(), [material])

  useFrame(() => {
    const mesh = meshRef.current
    if (mesh == null) return
    // 고리 중심 = 행성 중심. 행성 월드 반경 = 메시 월드 스케일(로컬 반경 1 = 행성 반경).
    mesh.getWorldPosition(planetCenter)
    planetRadius.value = mesh.getWorldScale(scaleScratch).x
    // 광원 = 게시된 주성 월드좌표. 미게시(워프 등)면 이전 값 유지 (AtmosphereLimb와 동일).
    if (currentBodies.count > 0) starPos.copy(currentBodies.positions[0] as Vector3)
  })

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      scale={planetVisualRadius}
      rotation={[RING_TILT_X, 0, RING_TILT_Z]}
    />
  )
}
