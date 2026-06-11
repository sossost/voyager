import { useGameStore } from '@/store'

export function TopBar() {
  const seed = useGameStore((state) => state.seed)

  return (
    <header className="top-bar">
      <h1 className="top-bar-title">Stellar Voyage</h1>
      <span className="top-bar-seed" title="우주 시드 — 같은 시드는 같은 우주">
        시드 {seed}
      </span>
    </header>
  )
}
