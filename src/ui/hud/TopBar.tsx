import { useEffect, useRef, useState } from 'react'

import { useGameStore } from '@/store'
import { QualitySelect } from '@/ui/hud/QualitySelect'

/**
 * 텔레메트리 스트립 (결정 42) — 좌상단 읽기 전용 데이터 행. pointer-events 차단으로
 * "계기"임을 구조로 못박는다. 메모리 폴백은 별도 배너 대신 이 스트립의 코션 모드로
 * 흡수 (결정 42-d, 항공기 Master Caution 문법 — 새 레이어 없음).
 */
function TelemetryStrip() {
  const seed = useGameStore((state) => state.seed)
  const isMemoryMode = useGameStore((state) => state.storageMode === 'memory')

  return (
    <div className="telemetry-strip" data-caution={isMemoryMode || undefined}>
      <h1 className="top-bar-title">Voyager</h1>
      <span className="telemetry-seed">· 시드 {seed}</span>
      {isMemoryMode ? (
        // 모바일에선 시각적으로 압축되지만(visually-hidden) status 안내는 유지된다
        <span className="telemetry-caution" role="status">
          기록 미저장 — 메모리 모드
          <span className="visually-hidden">
            : 이 환경에서는 기록이 저장되지 않아요 — 세션이 끝나면 탐사 기록이
            사라집니다
          </span>
        </span>
      ) : null}
    </div>
  )
}

/** 설정 포브 (결정 42) — 저빈도 설정(품질)을 팝오버 뒤로 격납해 위계를 낮춘다. */
function SystemFob() {
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (isOpen === false) return

    // 닫힐 때 포커스가 팝오버 안에 있었다면 트리거로 복귀 — body 유실 방지
    const closeAndRestoreFocus = () => {
      const hadFocusInside = rootRef.current?.contains(document.activeElement) === true
      setIsOpen(false)
      if (hadFocusInside) triggerRef.current?.focus()
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return
      closeAndRestoreFocus()
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeAndRestoreFocus()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  return (
    <div className="system-fob" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="hud-button hud-button-compact system-fob-key"
        aria-label="시스템 설정"
        aria-expanded={isOpen}
        aria-controls="system-fob-popover"
        onClick={() => setIsOpen((wasOpen) => !wasOpen)}
      >
        ⚙
      </button>
      {isOpen ? (
        <div id="system-fob-popover" className="system-fob-popover">
          <QualitySelect />
        </div>
      ) : null}
    </div>
  )
}

export function TopBar() {
  const openOverlay = useGameStore((state) => state.openOverlay)

  return (
    <header className="top-bar">
      <TelemetryStrip />
      <div className="top-bar-actions">
        <div className="records-module" role="group" aria-label="함내 기록">
          <button
            type="button"
            className="hud-button hud-button-compact records-key"
            onClick={() => openOverlay('codex')}
          >
            도감
          </button>
          <button
            type="button"
            className="hud-button hud-button-compact records-key"
            onClick={() => openOverlay('journal')}
          >
            일지
          </button>
        </div>
        <SystemFob />
      </div>
    </header>
  )
}
