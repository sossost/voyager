import type { Multiplicity, SpectralClass, StarKind } from '@/engine'

/** 이색 천체 종류 — 주계열성은 SPECTRAL_RENDER가 담당하므로 제외. 현재 블랙홀뿐. */
type ExoticKind = Exclude<StarKind, 'main_sequence'>

/**
 * 분광형별 렌더 속성 — 실제 항성 색온도를 단순화한 팔레트.
 * 채도·크기 격차를 실제보다 과장한다: 희귀한 O/B(4%)가 등대처럼 박히고
 * 흔한 M/K가 어두운 주황 배경이 되어야 별밭이 단조롭지 않다.
 */
export const SPECTRAL_RENDER: Readonly<Record<SpectralClass, { color: string; size: number }>> = {
  O: { color: '#7fa3ff', size: 4.6 },
  B: { color: '#95b5ff', size: 3.6 },
  A: { color: '#c2d2ff', size: 2.8 },
  F: { color: '#f4f2ff', size: 2.3 },
  G: { color: '#ffe9a8', size: 2.0 },
  K: { color: '#ffbe7d', size: 1.7 },
  M: { color: '#ff9c5e', size: 1.5 },
}

/**
 * 이색 천체 맵 노드 색/크기 (결정 10) — SPECTRAL_RENDER 미러.
 * 블랙홀=거의 안 보이는 점(가산 링 빌보드가 주역 — BlackHoleMapRings).
 */
export const EXOTIC_RENDER: Readonly<Record<ExoticKind, { color: string; size: number }>> = {
  black_hole: { color: '#1a1420', size: 1.8 },
}

export const STAR_KIND_LABELS: Readonly<Record<StarKind, string>> = {
  main_sequence: '주계열성',
  black_hole: '블랙홀',
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

/** 항성계 다중도 라벨 (binary-stars) — 단일성은 콜아웃에서 별도 표기하지 않는다. */
export const MULTIPLICITY_LABELS: Readonly<Record<Multiplicity, string>> = {
  single: '단일성',
  binary: '쌍성계',
  triple: '삼중성계',
}
