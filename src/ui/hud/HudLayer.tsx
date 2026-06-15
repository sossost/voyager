import { ConsoleDeck } from '@/ui/hud/ConsoleDeck'
import { CurrentStarArrow } from '@/ui/hud/CurrentStarArrow'
import { HintLayer } from '@/ui/hud/HintLayer'
import { PlanetPanel } from '@/ui/hud/PlanetPanel'
import { ShipFrame } from '@/ui/hud/ShipFrame'
import { StarInfoPanel } from '@/ui/hud/StarInfoPanel'
import { SystemReadout } from '@/ui/hud/SystemReadout'
import { TopBar } from '@/ui/hud/TopBar'
import { WarpReadout } from '@/ui/hud/WarpReadout'
import { useGameStore } from '@/store'

/** 뷰 3상태 → data-view 루트 규약 (결정 42-a) — CSS 분기의 단일 진입점. */
function useHudView(): 'ship' | 'perspective' | 'warping' {
  return useGameStore((state) =>
    state.scene.kind === 'warping' ? 'warping' : state.scene.view,
  )
}

export function HudLayer() {
  const view = useHudView()

  return (
    <div className="layer-hud" data-layer="hud" data-view={view}>
      {/* 캐노피 프레임은 맨 아래 — 패널·버튼이 항상 그 위에 그려진다 */}
      <ShipFrame />
      <TopBar />
      <SystemReadout />
      <WarpReadout />
      <StarInfoPanel />
      <PlanetPanel />
      <ConsoleDeck />
      <CurrentStarArrow />
      <HintLayer />
    </div>
  )
}
