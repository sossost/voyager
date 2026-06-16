import { PerformanceMonitor } from '@react-three/drei'

import { blackHoleLens } from '@/scenes/system/blackHoleLens'
import { useGameStore } from '@/store'
import type { QualityTier } from '@/store/types'

const DOWNGRADE_ORDER: Readonly<Record<QualityTier, QualityTier>> = {
  high: 'medium',
  medium: 'low',
  low: 'low',
}

/**
 * 런타임 품질 적응 (Canvas 내부) — 프레임이 지속 하락하면 한 단계 하향한다.
 * 수동 모드에서는 개입하지 않는다 (결정: 품질 자동 하향 + 수동 오버라이드).
 */
export function QualityAdapter() {
  const handleDecline = () => {
    const { qualityTier, qualityMode, setQuality, pushToast } = useGameStore.getState()
    if (qualityMode !== 'auto') return

    // 블랙홀 근접 중에는 하향하지 않는다 — 블랙홀은 자동 모드에서 항상 high로 고정되는(결정 5
    // 사치) 본질적으로 무거운 패스라 프레임을 거의 항상 끌어내린다. 이 구간의 하락으로 전체 씬을
    // 낮추면 토스트만 반복되고, 단방향 하향이라 블랙홀을 벗어나도 품질이 회복되지 않는다.
    if (blackHoleLens.active) return

    const next = DOWNGRADE_ORDER[qualityTier]
    if (next === qualityTier) return

    setQuality(next, 'auto')
    pushToast('원활한 탐험을 위해 그래픽 품질을 낮췄어요')
  }

  return <PerformanceMonitor onDecline={handleDecline} />
}
