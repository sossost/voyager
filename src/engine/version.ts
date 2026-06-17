/**
 * 생성 로직 버전 — Profile에 저장되어 부트 시 비교된다.
 *
 * 증가 기준 (02-decisions.md 결정 13):
 *   - 올린다: 생성물의 "출력 분포 자체"가 바뀌는 변경
 *     (PRNG/해시 교체, 밀도 함수 수정, 가중치 변경, draw 순서 변경, 종족 카탈로그의 분포 변경)
 *   - 올리지 않는다: 엔티티 스트림에 draw를 append하는 변경 (스트림 격리가 1차 방어)
 *
 * 버전 불일치 시 부트에서 안내 모달을 띄운다. 마이그레이션은 v2 비범위.
 * tests/golden/의 스냅샷이 바뀌면 이 값을 올렸는지 반드시 확인할 것.
 *
 * v2 (2026-06-11): 나선팔 밀도 함수 + MAX_STARS_PER_SECTOR 80→5 (결정 21).
 * v3 (2026-06-11): 수직 두께 렌즈형 프로파일 — 중심 5 → 가장자리 1.2섹터 테이퍼 (결정 32).
 *   sy=0 평면 밀도는 불변이라 originStar·LIFE1 시작 항성계는 그대로다.
 * v4 (2026-06-15): 쌍성/삼중성 — 별 'star' 스트림에 multiplicity·companions append
 *   (binary-stars 결정 7). 기존 localPos·spectral 값은 보존되고 planetsOf 무변경이라
 *   행성·외계 출력은 그대로다. 골든의 별 직렬화에 신규 필드가 추가되어 스냅샷이 바뀐다.
 *   Sol은 조기 분기로 동반성 draw 미실행 → 단일성 유지, LIFE1 무영향.
 * v5 (2026-06-16): 이색 천체(블랙홀) — 별 'star' 스트림 마지막에 kind append (exotic-bodies 결정 9).
 *   companions(가변 draw) 뒤 마지막 draw라 기존 localPos·spectral·multiplicity·companions
 *   값은 보존되고 planetsOf·alienAt·moons·drawCompanions 무변경이라 행성·외계·위성·동반성
 *   출력은 그대로다. 골든의 별 직렬화에 신규 kind 필드가 추가되어 스냅샷이 바뀐다.
 *   Sol은 루프 내 조기 continue로 kind draw 미실행 → main_sequence 유지, LIFE1 무영향.
 *   ※ kind는 main_sequence|black_hole 2종만(거성·왜성·펄서는 후속 PR). 프로브 섹터(2,0,3)는
 *     전부 F/G/M형이라 블랙홀 도달 불가 → 골든 스냅샷은 4종→블랙홀 축소 후에도 동일(결정 21).
 * v6 (2026-06-16): 블랙홀은 단일성계 — kind=black_hole이면 multiplicity='single'·companions=[]로
 *   출력을 덮어쓴다 (사용자 피드백: 동반성이 강착원반·렌즈와 겹쳐 부자연스럽고 앞 통과 시 빛 맺힘).
 *   draw(multiplicity·drawCompanions)는 그대로 소비해 RNG 스트림·다른 별·다른 draw는 불변 —
 *   블랙홀 별의 multiplicity/companions 출력만 바뀐다. 프로브 섹터(2,0,3)는 블랙홀이 없어
 *   골든 스냅샷은 불변이지만, 블랙홀 출력 분포가 바뀌므로 결정 13에 따라 버전을 올린다.
 * v7 (2026-06-17): 펄서(중성자성) — KIND_WEIGHTS_BY_SPECTRAL의 O/B에 'pulsar' kind 추가
 *   (펄서 결정 8 — 블랙홀보다 약간 흔하게). kind draw(starRng.weighted)는 테이블과 무관하게
 *   next() 1회만 소비하므로 append-only·RNG 스트림 불변 — O/B 별의 kind 추첨 결과 분포만 바뀐다
 *   (블랙홀과 달리 펄서는 단일성계 보정 없음 = multiplicity/companions 보존, 펄서 결정 6).
 *   프로브 섹터(2,0,3)는 전부 F/G/M이라 O/B kind(블랙홀·펄서) 미도달 → 골든 스냅샷은 불변이지만,
 *   O/B kind 분포가 바뀌므로 결정 13에 따라 버전을 올린다(v6 선례 동일).
 */
export const GEN_VERSION = 7
