import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  DoubleSide,
  type Group,
  type Mesh,
  RingGeometry,
  ShaderMaterial,
  Vector3,
} from 'three'

import { setUniform } from '@/scenes/shared/starGlowMaterial'
import { crossfadeProgress } from '@/scenes/system/starCrossfade'

/**
 * 블랙홀 강착원반 — 기울인 평면 라디얼 디스크 + 도플러 비대칭 발광 + 차등 회전 줄무늬 (결정 5).
 *
 * PlanetRings의 RingGeometry 패턴만 빌리고(머티리얼/텍스처는 토성 전용이라 재사용 불가),
 * 가산 블렌딩·고온 온도 그라데이션·도플러 빔잉·회전은 전부 신규 셰이더다. 풀스크린 포스트 없음
 * — 평면 디스크 1개라 모바일 안전. 도플러 비밍(접근 쪽 증광)이 "상대론적"으로 읽히는 핵심 시그니처.
 */

/** 본체(사건지평선) 반경 배수 — 디스크 안/바깥 모서리. */
const DISK_INNER = 1.4
const DISK_OUTER = 3.2
const THETA_SEGMENTS = 180
const RADIAL_SEGMENTS = 6
/**
 * 디스크는 카메라를 향하는 빌보드 그룹 안에서 로컬로 기울인다 (가르강튀아 룩).
 * 빌보드라 카메라 어느 각도에서도 항상 비스듬한 타원 고리로 또렷이 보인다 — 평면 고리가
 * 월드 고정이면 적도면 시점에서 edge-on이라 사라지는 문제를 막는다. 기울기로 위/아래
 * 절반이 검은 구에 가려져 "원반이 구 뒤로 돌아가는" 페이크 가르강튀아가 된다.
 */
const DISK_TILT_X = 1.12
const DISK_TILT_Z = 0.16

const VERTEX_SHADER = /* glsl */ `
  varying float vRadial;
  varying float vAngle;

  void main() {
    float r = length(position.xy);
    vRadial = clamp((r - ${DISK_INNER.toFixed(2)}) / ${(DISK_OUTER - DISK_INNER).toFixed(2)}, 0.0, 1.0);
    vAngle = atan(position.y, position.x);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  varying float vRadial;
  varying float vAngle;

  void main() {
    // 온도 그라데이션 — 안쪽 청백(뜨겁게) → 바깥 주황(식음)
    vec3 hot = vec3(0.78, 0.88, 1.05);
    vec3 cool = vec3(1.05, 0.45, 0.16);
    vec3 base = mix(hot, cool, pow(vRadial, 0.65));

    // 차등 회전 나선 띠 — 각도+반경에 의존해 휘감기는 나선팔(곧은 스포크가 아니라 소용돌이).
    // 안쪽이 더 빠르게 흐른다 (케플러 근사).
    float speed = mix(2.6, 0.9, vRadial);
    float spiral = 0.72 + 0.28 * sin(vAngle * 5.0 + vRadial * 9.0 - uTime * speed);
    float fine = 0.88 + 0.12 * sin(vAngle * 23.0 + vRadial * 17.0 + uTime * speed * 0.5);
    float bands = spiral * fine;

    // 도플러 비밍 — 접근 쪽(cos>0) 증광, 후퇴 쪽 감광. 상대론적 비대칭의 핵심.
    float doppler = 0.4 + 1.0 * (0.5 + 0.5 * cos(vAngle));

    // 안/바깥 가장자리 소프트 페이드
    float edge = smoothstep(0.0, 0.14, vRadial) * (1.0 - smoothstep(0.78, 1.0, vRadial));

    float intensity = edge * bands * doppler;
    gl_FragColor = vec4(base * intensity * 1.5, intensity * uOpacity);
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
  const billboardRef = useRef<Group>(null)
  const meshRef = useRef<Mesh>(null)
  const worldScratch = useMemo(() => new Vector3(), [])
  const geometry = useMemo(() => diskGeometry(), [])

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
    setUniform(material, 'uTime', state.clock.elapsedTime)
    // 디스크 평면을 카메라 향하게(빌보드) — 어느 각도에서도 비스듬한 타원으로 보인다.
    billboardRef.current?.quaternion.copy(state.camera.quaternion)
    // 워프 도착 크로스페이드 — StarSurface와 동일 계약 (결정 41-c, 도착 팝인 방지).
    if (meshRef.current != null) {
      const distance = state.camera.position.distanceTo(meshRef.current.getWorldPosition(worldScratch))
      setUniform(material, 'uOpacity', 1 - crossfadeProgress(distance))
    }
  })

  return (
    <group ref={billboardRef}>
      <mesh
        ref={meshRef}
        geometry={geometry}
        material={material}
        scale={radius}
        rotation={[DISK_TILT_X, 0, DISK_TILT_Z]}
      />
    </group>
  )
}
