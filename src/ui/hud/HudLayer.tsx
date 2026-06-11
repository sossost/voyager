import { NavigationControls } from '@/ui/hud/NavigationControls'
import { StarInfoPanel } from '@/ui/hud/StarInfoPanel'
import { TopBar } from '@/ui/hud/TopBar'

export function HudLayer() {
  return (
    <div className="layer-hud" data-layer="hud">
      <TopBar />
      <StarInfoPanel />
      <NavigationControls />
    </div>
  )
}
