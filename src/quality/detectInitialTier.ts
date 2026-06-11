import { getGPUTier } from 'detect-gpu'

import type { QualityTier } from '@/store/types'

/**
 * 부트 시 GPU 벤치마크 기반 초기 품질 티어 — 첫 프레임부터 기기에 맞는
 * 별 예산으로 시작해 '처음부터 버벅임'을 방지한다 (결정 12).
 * PerformanceMonitor는 사후 적응만 가능하므로 이 사전 판정이 필요하다.
 */
export async function detectInitialQualityTier(): Promise<QualityTier> {
  try {
    const result = await getGPUTier()
    if (result.tier >= 3) return 'high'
    if (result.tier === 2) return 'medium'
    return 'low'
  } catch {
    // 벤치마크 데이터 로드 실패(오프라인 등) — 중간값으로 시작, 런타임 적응에 맡긴다
    return 'medium'
  }
}
