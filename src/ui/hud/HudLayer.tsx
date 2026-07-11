import { ConsoleDeck } from '@/ui/hud/ConsoleDeck'
import { CurrentStarArrow } from '@/ui/hud/CurrentStarArrow'
import { FullscreenExitKey } from '@/ui/hud/FullscreenButton'
import { GuestModeBanner } from '@/ui/hud/GuestModeBanner'
import { HintLayer } from '@/ui/hud/HintLayer'
import { PlanetPanel } from '@/ui/hud/PlanetPanel'
import { ScanPulseOverlay } from '@/ui/hud/ScanPulseOverlay'
import { ShipFrame } from '@/ui/hud/ShipFrame'
import { StarInfoPanel } from '@/ui/hud/StarInfoPanel'
import { SystemReadout } from '@/ui/hud/SystemReadout'
import { TopBar } from '@/ui/hud/TopBar'
import { WarpReadout } from '@/ui/hud/WarpReadout'
import { useFullscreen } from '@/ui/hud/useFullscreen'
import { useGameStore } from '@/store'

/** 뷰 3상태 → data-view 루트 규약 (결정 42-a) — CSS 분기의 단일 진입점. */
function useHudView(): 'ship' | 'perspective' | 'warping' {
  return useGameStore((state) =>
    state.scene.kind === 'warping' ? 'warping' : state.scene.view,
  )
}

export function HudLayer() {
  const view = useHudView()
  const { isFullscreen } = useFullscreen()

  // 전체화면 = 관찰 모드 (misc-ux) — HUD를 통째로 걷어 우주만 남긴다. 캔버스 조작
  // (드래그 시선·휠 줌)은 HUD와 무관하게 살아 있고, 해제 키와 ESC로 언제든 복귀한다.
  if (isFullscreen) {
    return (
      <div className="layer-hud" data-layer="hud" data-view={view}>
        <FullscreenExitKey />
      </div>
    )
  }

  return (
    <div className="layer-hud" data-layer="hud" data-view={view}>
      {/* 캐노피 프레임은 맨 아래 — 패널·버튼이 항상 그 위에 그려진다 */}
      <ShipFrame />
      <ScanPulseOverlay />
      <TopBar />
      <SystemReadout />
      <WarpReadout />
      <StarInfoPanel />
      <PlanetPanel />
      <ConsoleDeck />
      <CurrentStarArrow />
      <HintLayer />
      <GuestModeBanner />
    </div>
  )
}
