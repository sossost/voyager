import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { getStorageDriver, useGameStore } from '@/store'
import { useFocusTrap } from '@/ui/common/useFocusTrap'

interface UniverseResetDialogProps {
  onClose(): void
}

/**
 * 우주 초기화 확인 모달 — 화면 중앙(alertdialog), body 포털.
 *
 * 설정 팝오버 서브트리 밖(TopBar)에서 렌더된다: 팝오버는 "바깥 클릭 시 닫힘" 핸들러를 갖는데,
 * 모달은 body로 포털돼 그 기준 '바깥'이라 팝오버 안에 두면 모달을 누르는 순간 팝오버가 닫히며
 * 모달째 언마운트된다. 트리거가 팝오버를 먼저 닫고 이 모달을 띄우는 구조로 그 충돌을 끊는다.
 *
 * 파괴적·비가역 동작이라 기본 포커스를 안전한 '취소'에 두고, ESC·백드롭 클릭으로 취소한다
 * (포커스 트랩은 useFocusTrap 재사용).
 */
export function UniverseResetDialog({ onClose }: UniverseResetDialogProps) {
  const [isResetting, setIsResetting] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const cancelButtonRef = useRef<HTMLButtonElement>(null)
  const pushToast = useGameStore((state) => state.pushToast)

  useFocusTrap(dialogRef, true)

  useEffect(() => {
    cancelButtonRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleReset = async () => {
    setIsResetting(true)
    try {
      await getStorageDriver().reset()
      // 딥링크(?seed·?star)를 떼고 새로고침 → 부트가 프로필 없음을 보고 시드 선택으로 진입한다.
      // replace로 히스토리에 초기화 전 URL을 남기지 않는다 (뒤로가기로 되돌아올 수 없음).
      window.location.replace(window.location.pathname)
    } catch {
      // reset 실패 시 페이지가 그대로 남으므로 모달을 닫고 안내만 한다 (진행 비차단).
      setIsResetting(false)
      onClose()
      pushToast('우주를 초기화하지 못했어요 — 잠시 후 다시 시도해 주세요')
    }
  }

  return createPortal(
    <div
      className="confirm-backdrop"
      onPointerDown={(event) => {
        // 다이얼로그 바깥(백드롭)을 직접 누른 경우에만 취소 — 내부 클릭은 통과시킨다.
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="reset-confirm-title"
        aria-describedby="reset-confirm-desc"
      >
        <h2 id="reset-confirm-title" className="confirm-title">
          우주를 초기화할까요?
        </h2>
        <p id="reset-confirm-desc" className="confirm-message">
          탐사 기록·도감·방문 기록이 모두 사라지고 새 시드 선택 화면으로 돌아가요. 이 동작은
          되돌릴 수 없어요.
        </p>
        <div className="confirm-actions">
          <button
            ref={cancelButtonRef}
            type="button"
            className="hud-button"
            onClick={onClose}
            disabled={isResetting}
          >
            취소
          </button>
          <button
            type="button"
            className="hud-button confirm-danger"
            onClick={() => void handleReset()}
            disabled={isResetting}
          >
            {isResetting ? '초기화 중…' : '초기화'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
