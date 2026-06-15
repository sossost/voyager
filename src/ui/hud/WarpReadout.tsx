import { useEffect, useMemo, useState } from 'react'

import { starById } from '@/engine/galaxy/position'
import {
  WARP_AIM_PROGRESS,
  WARP_IGNITION_PROGRESS,
  WARP_STAGE_A_MS,
} from '@/scenes/warp/warpTimeline'
import { useGameStore } from '@/store'

/**
 * 워프 함교 리드아웃 (DOM HUD) — 워프 동안 목적지와 드라이브 단계를 중계한다.
 * 도착 리드아웃(SystemReadout)의 출발 대칭. WarpCameraRig의 카메라 4박자와 같은
 * 타임라인 상수를 공유해 화면 표시가 카메라 연출과 같은 리듬으로 진행한다.
 *
 * 규약: 짧은 자기완결 연출이라 프레임당 React 상태를 쓰지 않는다(철칙 6 정신).
 * 단계 라벨은 JS 타이머로 3번만 전이하고, 충전 바 채움은 CSS 애니메이션이 맡는다
 * (WarpFlashOverlay·ConsoleDeck 진행 라인과 동일 패턴).
 */

/** 드라이브 단계 — 카메라 예열 박자에 매핑(정렬·대기·반동·돌진). */
type WarpPhase = 'aligning' | 'spooling' | 'jump'

const PHASE_LABEL: Readonly<Record<WarpPhase, string>> = {
  aligning: '목표 정렬',
  spooling: '드라이브 충전',
  jump: '점프',
}

/** 정렬(회전)이 끝나고 충전(대기+반동)으로 넘어가는 시점. */
const SPOOL_START_MS = WARP_AIM_PROGRESS * WARP_STAGE_A_MS
/** 점화(돌진) 시점 = 충전 완료 — 충전 바도 여기서 가득 찬다. */
const JUMP_START_MS = WARP_IGNITION_PROGRESS * WARP_STAGE_A_MS

export function WarpReadout() {
  const seed = useGameStore((state) => state.seed)
  const targetStarId = useGameStore((state) =>
    state.scene.kind === 'warping' ? state.scene.to : null,
  )

  const [phase, setPhase] = useState<WarpPhase>('aligning')

  useEffect(() => {
    if (targetStarId == null) return

    setPhase('aligning')
    const spoolTimer = setTimeout(() => setPhase('spooling'), SPOOL_START_MS)
    const jumpTimer = setTimeout(() => setPhase('jump'), JUMP_START_MS)
    return () => {
      clearTimeout(spoolTimer)
      clearTimeout(jumpTimer)
    }
  }, [targetStarId])

  const targetStar = useMemo(
    () => (targetStarId == null ? null : starById(seed, targetStarId)),
    [seed, targetStarId],
  )

  if (targetStar == null) return null

  return (
    <section className="warp-readout" data-phase={phase} role="status" aria-live="polite">
      <span className="warp-readout-target">WARP → {targetStar.name}</span>
      <span className="warp-readout-phase">{PHASE_LABEL[phase]}</span>
      <span className="warp-readout-bar" aria-hidden="true">
        <span
          className="warp-readout-bar-fill"
          style={{ animationDuration: `${JUMP_START_MS}ms` }}
        />
      </span>
    </section>
  )
}
