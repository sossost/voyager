interface SharedUniversePromptProps {
  /** 친구가 공유한 우주의 시드. */
  readonly seed: string
  /** 딥링크가 가리키는 항성계 이름 (없으면 시작 항성계). */
  readonly systemName: string | null
  onEnterGuest(): void
  onKeepOwn(): void
}

/**
 * 다른 시드의 공유 딥링크를 연 기존 플레이어에게 선택을 묻는다 (백로그 L-1 게스트 모드).
 *
 * 브라우저당 우주는 하나뿐이라, 공유 우주를 그대로 열면 내 우주와 충돌한다. "둘러보기"는
 * 기록을 저장하지 않는 게스트 세션으로 공유 우주를 보여주고(내 기록 보존), "내 우주로 계속"은
 * 링크를 무시하고 내 우주를 연다. 무음 실패(링크가 조용히 무시됨)를 없애는 게 핵심.
 */
export function SharedUniversePrompt({
  seed,
  systemName,
  onEnterGuest,
  onKeepOwn,
}: SharedUniversePromptProps) {
  return (
    <main className="boot-screen" role="alertdialog" aria-label="공유 우주 안내">
      <h1 className="boot-title">친구가 다른 우주를 공유했어요</h1>
      <p className="boot-subtitle">
        이 링크는 우주 <strong>{seed}</strong>
        {systemName != null ? <> 의 {systemName} 항성계</> : null}로 안내합니다 — 지금 저장된 내
        우주와는 다른 우주예요. 둘러보는 동안에는 <strong>기록이 저장되지 않으며</strong>, 내
        우주는 그대로 보존됩니다.
      </p>
      <div className="boot-actions">
        <button type="button" className="hud-button hud-button-primary" onClick={onEnterGuest}>
          공유 우주 둘러보기
        </button>
        <button type="button" className="hud-button" onClick={onKeepOwn}>
          내 우주로 계속
        </button>
      </div>
    </main>
  )
}
