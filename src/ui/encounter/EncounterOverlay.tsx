import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

import type { Rarity } from '@/engine'
import { useGameStore } from '@/store'
import { RARITY_LABELS, SCAN_BURST_MS, SCAN_DURATIONS_MS } from '@/ui/common/rarityLabels'
import { AlienCard } from '@/ui/encounter/AlienCard'

interface ScanSequenceProps {
  readonly rarity: Rarity
}

/** 스캔 빌드업 — 희귀도별 길이 차등, 마지막에 희귀도 색 버스트 (결정 9). */
function ScanSequence({ rarity }: ScanSequenceProps) {
  const revealEncounter = useGameStore((state) => state.revealEncounter)
  const [isBursting, setIsBursting] = useState(false)

  useEffect(() => {
    const duration = SCAN_DURATIONS_MS[rarity]
    const burstTimer = setTimeout(() => setIsBursting(true), duration - SCAN_BURST_MS)
    const revealTimer = setTimeout(revealEncounter, duration)
    return () => {
      clearTimeout(burstTimer)
      clearTimeout(revealTimer)
    }
  }, [rarity, revealEncounter])

  return (
    <div className={isBursting ? `scan-sequence scan-burst-${rarity}` : 'scan-sequence'}>
      <div className="scan-ring" />
      <div className="scan-ring scan-ring-delayed" />
      <p className="scan-label">생체 신호 스캔 중…</p>
    </div>
  )
}

/** 조우 오버레이 (z-20) — 씬은 'system'을 유지한 채 DOM이 덮는다 (결정 15). */
export function EncounterOverlay() {
  const encounter = useGameStore((state) => state.encounter)
  const closeEncounter = useGameStore((state) => state.closeEncounter)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (encounter == null) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeEncounter()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [encounter, closeEncounter])

  useEffect(() => {
    if (encounter?.phase === 'reveal') closeButtonRef.current?.focus()
  }, [encounter?.phase])

  if (encounter == null) return null

  return (
    <div className="encounter-overlay" role="dialog" aria-modal="true" aria-label="외계 생명체 조우">
      {encounter.phase === 'scanning' ? (
        <ScanSequence rarity={encounter.alien.rarity} />
      ) : (
        <AnimatePresence>
          <motion.div
            className="encounter-reveal"
            initial={{ rotateY: 90, scale: 0.8, opacity: 0 }}
            animate={{ rotateY: 0, scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 230, damping: 22 }}
          >
            {encounter.isFirstOfSpecies ? (
              <p className="encounter-badge encounter-badge-first">✨ 최초 발견한 종족!</p>
            ) : null}
            {encounter.alreadyCollected ? (
              <p className="encounter-badge encounter-badge-known">이미 조우한 개체입니다</p>
            ) : null}

            <AlienCard alien={encounter.alien} />

            <p className="encounter-summary">
              {RARITY_LABELS[encounter.alien.rarity]} 등급 생명체를{' '}
              {encounter.alreadyCollected ? '다시 만났습니다' : '수집했습니다'}
            </p>

            <button
              ref={closeButtonRef}
              type="button"
              className="hud-button hud-button-primary"
              onClick={closeEncounter}
            >
              확인
            </button>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  )
}
