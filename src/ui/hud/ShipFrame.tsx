import { useGameStore } from '@/store'

/**
 * 우주선 캐노피 프레임 — "지금 함교에서 내다보고 있다"는 시점 표지 (결정 34 보완).
 * 우주선 뷰와 은하 전도가 같은 별밭을 그리므로 프레임이 두 뷰를 즉각 구분해 준다.
 * 워프 중에도 유지 — 워프는 우주선 시점에서 발동·진행되기 때문이다.
 * 장식 전용 오버레이라 포인터를 통과시키고 보조기기에서 숨긴다.
 */
export function ShipFrame() {
  const scene = useGameStore((state) => state.scene)
  const isViewTransitioning = useGameStore((state) => state.isViewTransitioning)
  const isOnShip = (scene.kind === 'galaxy' && scene.view === 'ship') || scene.kind === 'warping'
  if (isOnShip === false) return null

  const showGlow = isViewTransitioning && scene.kind === 'galaxy' && scene.view === 'ship'
  const cornerClass = showGlow
    ? 'ship-frame-corner ship-frame-corner--glow'
    : 'ship-frame-corner'

  return (
    <div className="ship-frame" aria-hidden="true">
      <span className={`${cornerClass} ship-frame-corner-tl`} />
      <span className={`${cornerClass} ship-frame-corner-tr`} />
      <span className={`${cornerClass} ship-frame-corner-bl`} />
      <span className={`${cornerClass} ship-frame-corner-br`} />
    </div>
  )
}
