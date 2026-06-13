import { CanvasLayer } from '@/scenes/CanvasLayer'
import { ToastViewport } from '@/ui/common/ToastViewport'
import { WarpFlashOverlay } from '@/ui/common/WarpFlashOverlay'
import { CodexOverlay } from '@/ui/codex/CodexOverlay'
import { EncounterOverlay } from '@/ui/encounter/EncounterOverlay'
import { HudLayer } from '@/ui/hud/HudLayer'
import { JournalOverlay } from '@/ui/journal/JournalOverlay'

/**
 * z-레이어 계약 (02-decisions.md 결정 15):
 *   z-0  Canvas      — 3D 씬 (단일 영속 Canvas)
 *   z-10 HUD         — 별/행성 정보 패널, 상단 바
 *   z-20 Overlay     — 조우 카드, 도감, 일지
 *   z-30 System      — 토스트, 저장 모드 경고 배너
 *
 * 텍스트 UI는 모두 DOM 레이어에 — drei <Html> 금지 (키보드 접근성의 구조적 전제)
 */
export function App() {
  return (
    <div className="app-root">
      <CanvasLayer />
      <HudLayer />
      <div className="layer-overlay" data-layer="overlay">
        <EncounterOverlay />
        <CodexOverlay />
        <JournalOverlay />
        <WarpFlashOverlay />
      </div>
      <div className="layer-system" data-layer="system">
        {/* 저장 모드 경고는 텔레메트리 스트립 코션 모드로 흡수 (결정 42-d) */}
        <ToastViewport />
      </div>
    </div>
  )
}
