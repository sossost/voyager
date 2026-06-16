import { useGameStore } from '@/store'

/**
 * 게스트(공유 우주 둘러보기) 세션 배너 (백로그 L-1) — 기록이 저장되지 않음을 상시 알리고,
 * 내 우주로 돌아가는 출구를 제공한다. 돌아가기는 쿼리 없는 주소로 새로고침해 본 프로필을
 * 다시 로드한다 (BootGate가 저장된 우주를 복원). 게스트가 아니면 렌더하지 않는다.
 */
export function GuestModeBanner() {
  const isGuestMode = useGameStore((state) => state.isGuestMode)
  const seed = useGameStore((state) => state.seed)

  if (!isGuestMode) return null

  const handleReturn = () => {
    // 딥링크 쿼리를 떼고 새로고침 — 저장된 내 우주로 부트 복귀.
    window.location.assign(window.location.pathname)
  }

  return (
    <div className="guest-banner" role="status">
      <span className="guest-banner-label">
        둘러보기 중 · 우주 {seed} · <strong>기록이 저장되지 않습니다</strong>
      </span>
      <button type="button" className="hud-button hud-button-compact" onClick={handleReturn}>
        내 우주로 돌아가기
      </button>
    </div>
  )
}
