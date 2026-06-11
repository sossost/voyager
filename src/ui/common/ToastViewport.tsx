import { useGameStore } from '@/store'

/** 토스트 뷰포트 (z-30) — 저장 실패 등 비차단 알림. */
export function ToastViewport() {
  const toasts = useGameStore((state) => state.toasts)
  const dismissToast = useGameStore((state) => state.dismissToast)

  if (toasts.length === 0) return null

  return (
    <div className="toast-viewport" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className="toast">
          <span className="toast-message">{toast.message}</span>
          <button
            type="button"
            className="hud-icon-button"
            aria-label="알림 닫기"
            onClick={() => dismissToast(toast.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
