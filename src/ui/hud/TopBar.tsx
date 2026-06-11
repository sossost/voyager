import { useGameStore } from '@/store'
import { QualitySelect } from '@/ui/hud/QualitySelect'

export function TopBar() {
  const seed = useGameStore((state) => state.seed)
  const openOverlay = useGameStore((state) => state.openOverlay)

  return (
    <header className="top-bar">
      <h1 className="top-bar-title">Stellar Voyage</h1>
      <div className="top-bar-actions">
        <button type="button" className="hud-button hud-button-compact" onClick={() => openOverlay('codex')}>
          도감
        </button>
        <button type="button" className="hud-button hud-button-compact" onClick={() => openOverlay('journal')}>
          일지
        </button>
        <QualitySelect />
        <span className="top-bar-seed" title="우주 시드 — 같은 시드는 같은 우주">
          시드 {seed}
        </span>
      </div>
    </header>
  )
}
