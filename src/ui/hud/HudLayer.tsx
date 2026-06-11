import { NavigationControls } from '@/ui/hud/NavigationControls'
import { PlanetPanel } from '@/ui/hud/PlanetPanel'
import { StarInfoPanel } from '@/ui/hud/StarInfoPanel'
import { TopBar } from '@/ui/hud/TopBar'

export function HudLayer() {
  return (
    <div className="layer-hud" data-layer="hud">
      <TopBar />
      <StarInfoPanel />
      <PlanetPanel />
      <NavigationControls />
    </div>
  )
}
