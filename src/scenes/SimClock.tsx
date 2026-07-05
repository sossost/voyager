import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'

import { MAX_FRAME_DT } from '@/scenes/system/currentPlanetOrbits'
import { simClock } from '@/scenes/system/simClock'
import { useGameStore } from '@/store'

/**
 * 배속 시계 구동기 (simulation-speed) — 매 프레임 simClock.now를 clamp된 실시간 delta×timeScale
 * 만큼 전진시킨다. clamp(MAX_FRAME_DT)가 탭 복귀 등의 큰 시간 점프를 흡수하고, ×timeScale로 배속과
 * 일시정지(0)를 표현한다.
 *
 * 궤도 소비처(Planet·Moon·AsteroidBelt·CurrentSystem·OrbitTrail)보다 먼저 useFrame이 등록되도록
 * Canvas 상단에 마운트한다 — 소비처가 같은 프레임에서 읽어도 지연이 없다(등록 순서가 곧 실행 순서).
 * timeScale은 이산값이라 변경 시에만 리렌더되며, useFrame은 ref로 최신값을 읽어 재등록에 의존하지 않는다.
 */
export function SimClock() {
  const timeScale = useGameStore((state) => state.timeScale)
  const timeScaleRef = useRef(timeScale)
  timeScaleRef.current = timeScale

  useFrame((_, delta) => {
    simClock.now += Math.min(delta, MAX_FRAME_DT) * timeScaleRef.current
  })

  return null
}
