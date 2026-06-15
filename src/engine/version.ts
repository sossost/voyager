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
 * v5 (2026-06-15): 이색 천체 — 별 'star' 스트림 마지막에 kind append (exotic-bodies 결정 9).
 *   companions(가변 draw) 뒤 마지막 draw라 기존 localPos·spectral·multiplicity·companions
 *   값은 보존되고 planetsOf·alienAt·moons·drawCompanions 무변경이라 행성·외계·위성·동반성
 *   출력은 그대로다. 골든의 별 직렬화에 신규 kind 필드가 추가되어 스냅샷이 바뀐다.
 *   Sol은 루프 내 조기 continue로 kind draw 미실행 → main_sequence 유지, LIFE1 무영향.
 */
export const GEN_VERSION = 5
