import type { Multiplicity, SpectralClass, StarKind } from '@/engine'

/** 이색 천체 종류 — 주계열성은 SPECTRAL_RENDER가 담당하므로 제외. 블랙홀·펄서·백색왜성·적색거성. */
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
 * 분광형별 광원 강도 계수 (O-4) — 주계열(V) 대표 광도의 로그 압축.
 * 실제 중간값 광도(O ~5×10⁴ · B ~10³ · A ~20 · F ~4 · G ~1 · K ~0.3 · M ~0.04 L☉,
 * Carroll & Ostlie "An Introduction to Modern Astrophysics" 부록 G)를 그대로 쓰면
 * 10⁶배 차이라 렌더 불가능하므로 1 + 0.4·log₁₀(L/L☉)로 압축 후 [0.5, 3.0] 클램프.
 * G형이 정확히 1.0이라 태양형 계 렌더는 픽셀 불변이다. 렌더 전용 — GEN_VERSION 무관.
 */
export const SPECTRAL_LIGHT_FACTOR: Readonly<Record<SpectralClass, number>> = {
  O: 2.9,
  B: 2.2,
  A: 1.5,
  F: 1.24,
  G: 1.0,
  K: 0.79,
  M: 0.5,
}

/**
 * 이색 천체 맵 노드 색/크기 (결정 10) — SPECTRAL_RENDER 미러.
 * 블랙홀=거의 안 보이는 점 — 함교 스캔으로 드러낸 것만 항법뷰 홀로 마커로 표시된다
 * (exotic-scan, ScannedExoticMarkers). 펄서=전기 청백의 밝은 점(펄서 결정 8).
 */
export const EXOTIC_RENDER: Readonly<Record<ExoticKind, { color: string; size: number }>> = {
  black_hole: { color: '#1a1420', size: 1.8 },
  pulsar: { color: '#bfe6ff', size: 3.0 },
  // 백색왜성 = 작지만 강렬한 청백 점광 / 적색거성 = 흔하고 큼직한 깊은 주황 노드.
  white_dwarf: { color: '#dbe8ff', size: 2.2 },
  red_giant: { color: '#ff6a3c', size: 3.4 },
}

export const STAR_KIND_LABELS: Readonly<Record<StarKind, string>> = {
  main_sequence: '주계열성',
  black_hole: '블랙홀',
  pulsar: '펄서 · 중성자성',
  white_dwarf: '백색왜성',
  red_giant: '적색거성',
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
