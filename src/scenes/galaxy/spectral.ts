import type { SpectralClass } from '@/engine'

/** 분광형별 렌더 속성 — 실제 항성 색온도를 단순화한 팔레트. */
export const SPECTRAL_RENDER: Readonly<Record<SpectralClass, { color: string; size: number }>> = {
  O: { color: '#9bb0ff', size: 3.2 },
  B: { color: '#aabfff', size: 2.8 },
  A: { color: '#cad7ff', size: 2.4 },
  F: { color: '#f8f7ff', size: 2.1 },
  G: { color: '#fff4ea', size: 1.9 },
  K: { color: '#ffd2a1', size: 1.7 },
  M: { color: '#ffcc6f', size: 1.4 },
}

export const SPECTRAL_LABELS: Readonly<Record<SpectralClass, string>> = {
  O: 'O형 (청색 초거성)',
  B: 'B형 (청백색)',
  A: 'A형 (백색)',
  F: 'F형 (황백색)',
  G: 'G형 (황색 — 태양형)',
  K: 'K형 (주황색)',
  M: 'M형 (적색 왜성)',
}
