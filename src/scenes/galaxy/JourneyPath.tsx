import { useEffect, useMemo } from 'react'
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Line,
  LineBasicMaterial,
} from 'three'

import { starWorldPosition } from '@/engine/galaxy/position'
import { useGameStore } from '@/store'

/**
 * 여정 경로선 — 방문 타임라인을 잇는 폴리라인 (백로그 F-2, HUD 토글·기본 off).
 * visitedStars Set의 순회 순서가 곧 시간순이다 (createGameStore가 visitedAt
 * 오름차순으로 구성). 오래된 구간일수록 흐려져 최신 항로가 또렷한 꼬리가 된다.
 */

const PATH_COLOR = '#4fd8b8'
/** 가장 오래된 구간의 밝기 비율 — 0이면 시작점이 완전히 사라져 끊겨 보인다. */
const OLDEST_SEGMENT_FADE = 0.12

export function JourneyPath() {
  const isVisible = useGameStore((state) => state.isJourneyPathVisible)
  if (isVisible === false) return null
  return <JourneyPathLine />
}

function JourneyPathLine() {
  const seed = useGameStore((state) => state.seed)
  const visitedStars = useGameStore((state) => state.visitedStars)

  const line = useMemo(() => {
    const stops: (readonly [number, number, number])[] = []
    for (const starId of visitedStars) {
      const position = starWorldPosition(seed, starId)
      if (position != null) stops.push(position)
    }
    if (stops.length < 2) return null

    const positions = new Float32Array(stops.length * 3)
    const colors = new Float32Array(stops.length * 3)
    const base = new Color(PATH_COLOR)
    const lastIndex = stops.length - 1

    stops.forEach((stop, index) => {
      positions[index * 3] = stop[0]
      positions[index * 3 + 1] = stop[1]
      positions[index * 3 + 2] = stop[2]

      const progress = index / lastIndex
      const fade = OLDEST_SEGMENT_FADE + (1 - OLDEST_SEGMENT_FADE) * progress * progress
      colors[index * 3] = base.r * fade
      colors[index * 3 + 1] = base.g * fade
      colors[index * 3 + 2] = base.b * fade
    })

    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))

    const material = new LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: AdditiveBlending,
      depthWrite: false,
    })
    return new Line(geometry, material)
  }, [seed, visitedStars])

  useEffect(() => {
    if (line == null) return
    return () => {
      line.geometry.dispose()
      line.material.dispose()
    }
  }, [line])

  if (line == null) return null
  return <primitive object={line} />
}
