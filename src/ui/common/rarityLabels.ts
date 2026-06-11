import type { Rarity } from '@/engine'

export const RARITY_LABELS: Readonly<Record<Rarity, string>> = {
  common: '커먼',
  rare: '레어',
  epic: '에픽',
  legendary: '레전더리',
}

/** 스캔 빌드업 길이 — 희귀할수록 기대감이 길다 (결정 9·연출 차등). */
export const SCAN_DURATIONS_MS: Readonly<Record<Rarity, number>> = {
  common: 1_600,
  rare: 2_200,
  epic: 2_800,
  legendary: 3_600,
}

/** 스캔 마지막 — 희귀도 색 버스트로 전환되는 구간. */
export const SCAN_BURST_MS = 500
