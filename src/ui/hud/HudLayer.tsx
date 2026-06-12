import { CurrentStarArrow } from '@/ui/hud/CurrentStarArrow'
import { HintLayer } from '@/ui/hud/HintLayer'
import { NavigationControls } from '@/ui/hud/NavigationControls'
import { PlanetPanel } from '@/ui/hud/PlanetPanel'
import { ShipFrame } from '@/ui/hud/ShipFrame'
import { StarInfoPanel } from '@/ui/hud/StarInfoPanel'
import { SystemReadout } from '@/ui/hud/SystemReadout'
import { TopBar } from '@/ui/hud/TopBar'

export function HudLayer() {
  return (
    <div className="layer-hud" data-layer="hud">
      {/* 캐노피 프레임은 맨 아래 — 패널·버튼이 항상 그 위에 그려진다 */}
      <ShipFrame />
      <TopBar />
      <SystemReadout />
      <StarInfoPanel />
      <PlanetPanel />
      <NavigationControls />
      <CurrentStarArrow />
      <HintLayer />
    </div>
  )
}
