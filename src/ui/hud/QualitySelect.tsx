import { useGameStore } from '@/store'
import type { QualityTier } from '@/store/types'

const TIER_LABELS: Readonly<Record<QualityTier, string>> = {
  high: '높음',
  medium: '중간',
  low: '낮음',
}

/** 그래픽 품질 수동 오버라이드 — '자동'은 detect-gpu + PerformanceMonitor에 맡긴다. */
export function QualitySelect() {
  const qualityTier = useGameStore((state) => state.qualityTier)
  const qualityMode = useGameStore((state) => state.qualityMode)
  const setQuality = useGameStore((state) => state.setQuality)

  return (
    <label className="quality-select-label">
      <span className="visually-hidden">그래픽 품질</span>
      <select
        className="quality-select"
        value={qualityMode === 'auto' ? 'auto' : qualityTier}
        onChange={(event) => {
          const value = event.target.value
          if (value === 'auto') {
            setQuality(qualityTier, 'auto')
            return
          }
          setQuality(value as QualityTier, 'manual')
        }}
      >
        <option value="auto">품질: 자동{qualityMode === 'auto' ? ` (${TIER_LABELS[qualityTier]})` : ''}</option>
        <option value="high">품질: 높음</option>
        <option value="medium">품질: 중간</option>
        <option value="low">품질: 낮음</option>
      </select>
    </label>
  )
}
