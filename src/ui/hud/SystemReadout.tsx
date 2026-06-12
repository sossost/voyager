import { useEffect, useMemo, useState } from 'react'

import { starById } from '@/engine/galaxy/position'
import { SPECTRAL_LABELS } from '@/scenes/galaxy/spectral'
import { useGameStore } from '@/store'

/**
 * 항성계 진입 함교 리드아웃 (백로그 G-a-4) — 어느 항성계에 들어왔는지 이름·분광형을
 * 진입 직후 잠깐 띄웠다 거둔다. 클릭 응답(콜아웃)과 달리 무조작 안내라 자동 소멸.
 * 표시 수명은 JS 타이머가 결정하고 CSS 애니메이션은 페이드만 맡는다 —
 * reduced-motion으로 애니메이션이 꺼져도 사라짐이 보장된다.
 */

/** 표시 수명 — CSS 페이드 사이클(5s)이 끝난 직후 언마운트한다. */
const READOUT_LIFETIME_MS = 5_200

export function SystemReadout() {
  const seed = useGameStore((state) => state.seed)
  const starId = useGameStore((state) =>
    state.scene.kind === 'system' ? state.scene.starId : null,
  )

  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (starId == null) {
      setIsVisible(false)
      return
    }
    setIsVisible(true)
    const timer = setTimeout(() => setIsVisible(false), READOUT_LIFETIME_MS)
    return () => clearTimeout(timer)
  }, [starId])

  const star = useMemo(() => (starId == null ? null : starById(seed, starId)), [seed, starId])

  if (!isVisible || star == null) return null

  return (
    <p className="system-readout" role="status">
      <span className="system-readout-name">{star.name}</span>
      <span className="system-readout-spectral">{SPECTRAL_LABELS[star.spectral]}</span>
    </p>
  )
}
