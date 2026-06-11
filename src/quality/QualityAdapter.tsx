import { PerformanceMonitor } from '@react-three/drei'

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

    const next = DOWNGRADE_ORDER[qualityTier]
    if (next === qualityTier) return

    setQuality(next, 'auto')
    pushToast('원활한 탐험을 위해 그래픽 품질을 낮췄어요')
  }

  return <PerformanceMonitor onDecline={handleDecline} />
}
