import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Line,
  LineBasicMaterial,
  Vector3,
} from 'three'

import {
  currentPlanetOrbits,
  RECORD_STRIDE,
  TRAIL_POINTS,
} from '@/scenes/system/currentPlanetOrbits'
import { systemFadeOpacity } from '@/scenes/system/starCrossfade'

/**
 * 다중성계 행성 궤도 트레일 — 정적 원(OrbitRing) 대신 행성이 실제로 지나온 경로를 그린다
 * (multi-star-gravity N-1). 중력 세차·로제트가 그대로 드러나 "원과 안 맞는" 문제가 곧 볼거리가
 * 된다. 좌표는 planetCenter 로컬(질량중심 원점 상대) — Planet 위치·게시본과 같은 프레임.
 *
 * `<line>` intrinsic은 SVGLineElement와 충돌하므로 THREE.Line을 직접 만들어 primitive로 붙인다.
 * 시각 연출 전용이라 초월함수·three 사용 가능 (OrbitRing과 동일 규율). GEN_VERSION 무관.
 */

const TRAIL_BASE_OPACITY = 0.75
/** head(최신)=밝음 → tail(과거)=배경색으로 페이드 (혜성 꼬리). */
const HEAD_COLOR = new Color('#8899d0')
const TAIL_COLOR = new Color('#0a0b12')

interface OrbitTrailProps {
  readonly orbitIndex: number
}

export function OrbitTrail({ orbitIndex }: OrbitTrailProps) {
  const scratchWorld = useMemo(() => new Vector3(), [])
  const progress = useRef({ count: 0, sinceCommit: 0, generation: -1 })

  // THREE.Line 직접 구성 — 위치 버퍼(빈 값) + 색 그라디언트(index별 고정). 점이 index를 따라
  // 뒤로 밀리며 어두워진다(혜성 꼬리). vertexColors + 거리 페이드 opacity.
  const line = useMemo(() => {
    const positions = new Float32Array(TRAIL_POINTS * 3)
    const colors = new Float32Array(TRAIL_POINTS * 3)
    const color = new Color()
    for (let i = 0; i < TRAIL_POINTS; i++) {
      color.copy(HEAD_COLOR).lerp(TAIL_COLOR, i / (TRAIL_POINTS - 1))
      colors[i * 3] = color.r
      colors[i * 3 + 1] = color.g
      colors[i * 3 + 2] = color.b
    }
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
    geometry.setDrawRange(0, 0)
    const material = new LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0 })
    return new Line(geometry, material)
  }, [])

  useEffect(() => {
    return () => {
      line.geometry.dispose()
      ;(line.material as LineBasicMaterial).dispose()
    }
  }, [line])

  // 행성(궤도 인덱스) 변경 시 궤적 리셋 — 계 간 streak 방지.
  useEffect(() => {
    progress.current.count = 0
    progress.current.sinceCommit = 0
    progress.current.generation = -1
    line.geometry.setDrawRange(0, 0)
  }, [orbitIndex, line])

  useFrame((state) => {
    const isValid = currentPlanetOrbits.active && orbitIndex < currentPlanetOrbits.count
    if (isValid) {
      const position = currentPlanetOrbits.localPositions[orbitIndex] as Vector3
      const positionAttr = line.geometry.getAttribute('position') as Float32BufferAttribute
      const array = positionAttr.array as Float32Array
      const state0 = progress.current

      // (재)시드 세대가 바뀌면 프리롤된 과거 경로를 초기 트레일로 통째 로드 — 빈 시작 방지.
      if (state0.generation !== currentPlanetOrbits.trailGeneration) {
        state0.generation = currentPlanetOrbits.trailGeneration
        array.set(currentPlanetOrbits.trails[orbitIndex] as Float32Array)
        state0.count = TRAIL_POINTS
        state0.sinceCommit = 0
        line.geometry.setDrawRange(0, TRAIL_POINTS)
      }

      state0.sinceCommit++
      if (state0.sinceCommit >= RECORD_STRIDE) {
        state0.sinceCommit = 0
        // 기존 점들을 한 슬롯 뒤로 시프트(copyWithin은 겹침 안전) → index0에 새 head 자리 확보.
        const shiftPoints = Math.min(state0.count, TRAIL_POINTS - 1)
        array.copyWithin(3, 0, shiftPoints * 3)
        state0.count = Math.min(state0.count + 1, TRAIL_POINTS)
      }
      if (state0.count === 0) state0.count = 1
      // head(index0)는 매 프레임 현재 위치로 — 선두가 행성에 부드럽게 붙는다.
      array[0] = position.x
      array[1] = position.y
      array[2] = position.z
      line.geometry.setDrawRange(0, state0.count)
      positionAttr.needsUpdate = true
    }

    const material = line.material as LineBasicMaterial
    const dist = state.camera.position.distanceTo(line.getWorldPosition(scratchWorld))
    material.opacity = TRAIL_BASE_OPACITY * systemFadeOpacity(dist)
  })

  return <primitive object={line} />
}
