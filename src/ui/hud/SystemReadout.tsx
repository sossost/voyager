import { useEffect, useMemo, useRef, useState } from 'react'

import { starById } from '@/engine/galaxy/position'
import { MULTIPLICITY_LABELS, SPECTRAL_LABELS, STAR_KIND_LABELS } from '@/scenes/galaxy/spectral'
import { useGameStore } from '@/store'

/**
 * 항성계 진입 함교 리드아웃 (백로그 G-a-4) — 어느 항성계에 들어왔는지 이름·분광형을
 * 진입 직후 잠깐 띄웠다 거둔다. 클릭 응답(콜아웃)과 달리 무조작 안내라 자동 소멸.
 * 표시 수명은 JS 타이머가 결정하고 CSS 애니메이션은 페이드만 맡는다 —
 * reduced-motion으로 애니메이션이 꺼져도 사라짐이 보장된다.
 *
 * 통합 후(결정 41) "항성계 진입" = 우주선 뷰로 새 별에 도착한 순간. 별도 system kind가
 * 없으므로 우주선 뷰의 currentStarId가 *바뀔* 때만 발화한다 — 퍼스펙티브↔우주선 토글
 * 같은 같은 별 재진입에는 다시 뜨지 않는다 (lastAnnounced로 새 별만 통과).
 */

/** 표시 수명 — CSS 페이드 사이클(5s)이 끝난 직후 언마운트한다. */
const READOUT_LIFETIME_MS = 5_200

export function SystemReadout() {
  const seed = useGameStore((state) => state.seed)
  // 우주선 뷰일 때만 현재 별 — 워프 중·퍼스펙티브에선 null (도착 = 우주선 뷰 전이)
  const arrivedStarId = useGameStore((state) =>
    state.scene.kind === 'galaxy' && state.scene.view === 'ship' ? state.currentStarId : null,
  )

  const [isVisible, setIsVisible] = useState(false)
  const lastAnnouncedRef = useRef<typeof arrivedStarId>(null)

  useEffect(() => {
    if (arrivedStarId == null) {
      setIsVisible(false) // 우주선 뷰를 벗어남 — 즉시 거둔다 (이전 타이머는 cleanup이 정리)
      return
    }
    if (arrivedStarId === lastAnnouncedRef.current) return // 같은 별 재진입 — 다시 띄우지 않음

    lastAnnouncedRef.current = arrivedStarId
    setIsVisible(true)
    const timer = setTimeout(() => setIsVisible(false), READOUT_LIFETIME_MS)
    return () => clearTimeout(timer)
  }, [arrivedStarId])

  const star = useMemo(
    () => (arrivedStarId == null ? null : starById(seed, arrivedStarId)),
    [seed, arrivedStarId],
  )

  if (!isVisible || star == null) return null

  return (
    <p className="system-readout" role="status">
      <span className="system-readout-name">{star.name}</span>
      <span className="system-readout-spectral">
        {/* 블랙홀 등 이색 천체는 분광형(전신성 클래스) 대신 종류 라벨을 보여준다. */}
        {star.kind !== 'main_sequence'
          ? STAR_KIND_LABELS[star.kind]
          : SPECTRAL_LABELS[star.spectral]}
        {star.multiplicity !== 'single' ? ` · ${MULTIPLICITY_LABELS[star.multiplicity]}` : ''}
      </span>
    </p>
  )
}
