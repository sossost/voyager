import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  DoubleSide,
  type Group,
  type Mesh,
  MeshBasicMaterial,
  RingGeometry,
} from 'three'

import { fract } from '@/scenes/shared/fract'

/**
 * 생명체 행성 통신 파동 (백로그 G-a-3) — hasLife 행성 주변으로 주기적으로
 * 퍼져나가는 원형 링. "전파를 내보내는 생태계"를 함교 센서가 수신하는 그림.
 * CurrentStarBeacon의 소나 링 패턴 재사용: 빌보드 + 위상 스태거 + 가산 페이드.
 * 행성 그룹의 자식으로 마운트되어 공전을 그대로 따라간다. 렌더 전용.
 */

/** 신호 색 — HUD 홀로그램과 같은 청록 (생명 반응 = 콘솔이 수신하는 신호). */
const SIGNAL_COLOR = '#5eead4'
/** 링 발생 반경 = 행성 시각 반경 × 배수 — 표면 살짝 바깥에서 시작해 행성을 가리지 않는다. */
const WAVE_BASE_SCALE = 1.4
/** 파동 주기 — 비콘 소나(2.4s)보다 느긋하게: 경보가 아니라 방송이다. */
const WAVE_PERIOD_SECONDS = 3.4
const WAVE_MAX_SCALE = 3.6
const WAVE_MAX_OPACITY = 0.55
const RING_SEGMENTS = 48

interface LifeSignalWavesProps {
  /** 행성 시각 반경 — 파동 크기의 기준. */
  readonly planetRadius: number
}

export function LifeSignalWaves({ planetRadius }: LifeSignalWavesProps) {
  const groupRef = useRef<Group>(null)
  const waveARef = useRef<Mesh>(null)
  const waveBRef = useRef<Mesh>(null)

  const geometry = useMemo(() => new RingGeometry(0.92, 1.0, RING_SEGMENTS), [])
  const materialA = useMemo(() => buildWaveMaterial(), [])
  const materialB = useMemo(() => buildWaveMaterial(), [])

  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => materialA.dispose(), [materialA])
  useEffect(() => () => materialB.dispose(), [materialB])

  useFrame((state) => {
    // 빌보드 — 부모(행성 그룹)는 위치만 가지므로 카메라 쿼터니언을 그대로 써도 된다
    groupRef.current?.quaternion.copy(state.camera.quaternion)

    const elapsed = state.clock.elapsedTime
    updateWaveRing(waveARef.current, materialA, fract(elapsed / WAVE_PERIOD_SECONDS))
    updateWaveRing(waveBRef.current, materialB, fract(elapsed / WAVE_PERIOD_SECONDS + 0.5))
  })

  return (
    <group ref={groupRef} scale={planetRadius * WAVE_BASE_SCALE}>
      <mesh ref={waveARef} geometry={geometry} material={materialA} />
      <mesh ref={waveBRef} geometry={geometry} material={materialB} />
    </group>
  )
}

function buildWaveMaterial(): MeshBasicMaterial {
  return new MeshBasicMaterial({
    color: SIGNAL_COLOR,
    transparent: true,
    opacity: 0,
    side: DoubleSide,
    depthWrite: false,
    blending: AdditiveBlending,
  })
}

/** 파동 위상(0~1) → 퍼지는 스케일 + 잦아드는 불투명도 (소나 패턴). */
function updateWaveRing(ring: Mesh | null, material: MeshBasicMaterial, phase: number): void {
  if (ring == null) return
  ring.scale.setScalar(1 + phase * (WAVE_MAX_SCALE - 1))
  const remaining = 1 - phase
  material.opacity = remaining * remaining * WAVE_MAX_OPACITY
}
