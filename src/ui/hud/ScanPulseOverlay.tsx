import { useGameStore } from '@/store'

/**
 * 스캔 소나 연출 (exotic-scan) — 탐사를 발동하면 화면 중앙에서 바깥으로 퍼지는 청록 링.
 *
 * 연속 값이 아닌 이산 이벤트(scanPulseToken)에 반응한다: 토큰을 React key로 써서 **토큰이 바뀔
 * 때만**(=탐사 발동) 엘리먼트를 재마운트해 CSS 키프레임을 1회 재생한다. 뷰 게이트(항법일 때만
 * 렌더)를 두지 않는 이유 — 그러면 항법뷰 진입마다 null→마운트가 일어나 CSS 애니메이션이 매번
 * 재생되기 때문이다(뷰 전환 시 소나가 터지는 버그). 대신 항상 마운트해 두면 토큰 변화로만
 * 재생된다. `scanSurroundings`가 항법뷰에서만 토큰을 올리므로 소나도 항법에서만 나타난다.
 *
 * DOM 레이어 전용이라 GEN_VERSION 무관. reduced-motion은 CSS 미디어쿼리로 정적 처리.
 */
export function ScanPulseOverlay() {
  const scanPulseToken = useGameStore((state) => state.scanPulseToken)

  // 아직 탐사한 적 없으면(토큰 0) 렌더하지 않는다. 이후엔 계속 마운트 — 재생은 토큰 변화로만.
  if (scanPulseToken === 0) return null

  return (
    <div key={scanPulseToken} className="scan-pulse" aria-hidden="true">
      <span className="scan-pulse-ring" />
      <span className="scan-pulse-ring scan-pulse-ring-delayed" />
    </div>
  )
}
