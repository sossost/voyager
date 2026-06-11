interface GenVersionNoticeProps {
  readonly savedVersion: number
  readonly currentVersion: number
  onContinue(): void
  onReset(): void
}

/**
 * 생성 로직 버전 불일치 안내 — 마이그레이션은 v2 비범위 (결정 13).
 * 계속하면 기존 기록의 좌표가 새 생성 로직과 어긋날 수 있음을 알린다.
 */
export function GenVersionNotice({
  savedVersion,
  currentVersion,
  onContinue,
  onReset,
}: GenVersionNoticeProps) {
  return (
    <main className="boot-screen" role="alertdialog" aria-label="우주 생성 버전 안내">
      <h1 className="boot-title">우주 생성 규칙이 바뀌었어요</h1>
      <p className="boot-subtitle">
        저장된 기록은 생성 버전 v{savedVersion}에서 만들어졌지만, 현재 게임은 v
        {currentVersion}입니다. 계속 진행하면 일부 방문 기록·수집 기록이 실제 우주와 어긋나
        보일 수 있어요.
      </p>
      <div className="boot-actions">
        <button type="button" className="hud-button hud-button-primary" onClick={onContinue}>
          그래도 계속하기
        </button>
        <button type="button" className="hud-button" onClick={onReset}>
          기록을 지우고 새로 시작
        </button>
      </div>
    </main>
  )
}
