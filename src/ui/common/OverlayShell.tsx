import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'

import { useFocusTrap } from '@/ui/common/useFocusTrap'

interface OverlayShellProps {
  readonly title: string
  onClose(): void
  readonly children: ReactNode
}

/** 풀스크린 오버레이 공통 셸 — ESC 닫기 + 포커스 트랩 + 열릴 때 닫기 버튼 포커스. */
export function OverlayShell({ title, onClose, children }: OverlayShellProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const shellRef = useRef<HTMLDivElement>(null)

  useFocusTrap(shellRef, true)

  useEffect(() => {
    closeButtonRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div ref={shellRef} className="overlay-shell" role="dialog" aria-modal="true" aria-label={title}>
      <header className="overlay-header">
        <h2 className="overlay-title">{title}</h2>
        <button
          ref={closeButtonRef}
          type="button"
          className="hud-icon-button"
          aria-label="닫기"
          onClick={onClose}
        >
          ×
        </button>
      </header>
      <div className="overlay-body">{children}</div>
    </div>
  )
}
