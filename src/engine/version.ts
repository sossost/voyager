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
 * v8 (2026-06-18): 백색왜성·적색거성 — KIND_WEIGHTS_BY_SPECTRAL의 A/F/G/K에 white_dwarf·
 *   red_giant kind 추가 (exotic-stars 결정 1·2 — 저~중질량별의 진화 산물). 펄서와 동일하게
 *   append-only(kind draw는 weighted next() 1회만 소비 — RNG 스트림·다른 별·다른 draw 불변)이고
 *   단일성계 보정도 없다(multiplicity/companions 보존 — 블랙홀과 차별).
 *   **추가로 planetsOf의 hasLife를 적색거성·백색왜성 항성계에서 false로 덮어쓴다**
 *   (exotic-stars 결정 8 — 죽어가는 별엔 생명이 없다, 고증). 생명 draw(rng.next())는 그대로
 *   소비해 RNG 스트림·행성 개수/궤도/팔레트·다른 행성은 불변(append-only) — 해당 별 행성의
 *   hasLife 출력만 바뀐다. alienAt은 무변경(hasLife를 안 보므로 골든 encounters는 그대로).
 *   **v5~v7과 달리 프로브 섹터(2,0,3)의 F/G형 별이 white_dwarf·red_giant를 뽑을 수 있어 골든
 *   스냅샷의 별 kind + 그 별 행성들의 hasLife 필드가 실제로 바뀐다**(M은 항상 main_sequence라
 *   불변). Sol은 조기 continue로 kind draw 미실행 → main_sequence·지구 생명 유지. LIFE1 인근
 *   생명체 별은 전부 main_sequence라 보존(E2E green). 골든 재생성 필요.
 * v9 (2026-07-01): 동결선(frost line) — 행성 종류(rocky/gas) 가중치를 궤도 인덱스 종속으로
 *   교체 (백로그 M-1 — 고증). 기존 고정 rocky60/gas40 → 내행성 암석 지배·외행성 가스 지배
 *   램프(kindWeightsAtIndex). index는 kind draw 이전 확정 루프 변수라 draw 순서·개수 불변,
 *   weighted()·radius 분기 모두 next() 고정 소비 → RNG 스트림 불변, kind·radius 출력 값만
 *   바뀐다(append-only, 펄서·백색왜성과 동일 패턴). hasLife(kind 무관)·orbitAu·paletteSeed
 *   보존. 프로브 섹터(2,0,3) 행성 kind/radius가 바뀌어 골든 재생성 필요. hasLife는 kind와
 *   독립이라 LIFE1 생명 행성 보존(E2E green). Sol은 상수 분기라 무영향.
 * v10 (2026-07-03): 거주가능구역(HZ) 기반 생명 분포 — 균일 10%를 폐기하고 hasLife를
 *   getLifeProbability(star, index)로 산출 (백로그 M-2·M-3 — 고증). ①O/B 스펙트럼(대질량
 *   단명성 + 그 잔해 펄서·블랙홀)은 생명 확률 0(M-3), ②그 외 A/F/G/K/M 주계열은 스펙트럼별
 *   HZ 중심(√L 사전계산 상수표) 대비 명목 궤도의 거주성 곡선(평지+smootherstep 감쇠)×평지
 *   최대확률(0.45). 기존 red_giant·white_dwarf 억제(v8)는 유지. 생명 draw(rng.next())는
 *   위치·소비 그대로 두고 결과 확률만 새 규칙으로 정한다 — **planet 스트림 draw 순서·개수
 *   불변이라 PRNG 스트림 골든은 불변이고(append-only 회귀 검증), hasLife 값 분포만 바뀐다**.
 *   명목 궤도((index+1)·0.6, jitter 제외)를 쓰는 건 생명 draw(#2)가 궤도 draw(#4)보다 앞서
 *   실제 orbitAu가 없기 때문. 결과: 생명은 F/G/K 태양형 HZ 궤도에 집중, M형(40%)·O/B는 무생명,
 *   전체 평균 ~5.7%로 희귀화. 프로브 섹터(2,0,3)의 F/G형 행성 hasLife가 바뀌어 우주 골든
 *   재생성 필요. Sol은 상수 분기(지구 생명 유지), LIFE1 인근 생명 행성 다수 보존(E2E green).
 * v11 (2026-07-07): 사실성 v2 — 분포 변경 8건을 한 범프로 묶음 (docs/features/fidelity-v2):
 *   ①O-1 궤도 그리드 분광형 종속 — orbitAu = 안정오프셋 + 그리드×orbitScaleOf(≈√L, HZ 비례).
 *     정규화 궤도가 전 분광형 동일해져 M형 생명 0 해소. 동결선(belts)·가스 램프도 같은 스케일 +
 *     거대행성 질량 상관(GAS_FREQUENCY_FACTOR, Johnson 2010). ②M형 생명 페널티 ×0.5
 *     (Shields+ 2016 중립). ③HZ_PEAK 0.45→0.54 재튜닝 — 은하 평균 생명/행성 v10 동급(~5.8%).
 *   ④M-4 다중성 분광 종속(MULTIPLICITY_WEIGHTS_BY_SPECTRAL — Duchêne & Kraus 2013).
 *   ⑤N-3 다중성계 행성 안정 재배치 — stabilityOffsetAu(P-type, Holman-Wiegert ×2)를 엔진
 *     orbitAu에 반영 (N-1 렌더 밀어내기는 안전망으로 격하, 표시는 OrbitDisplay 정규화).
 *   ⑥O-7 진화 산물 정합 — K형 WD/RG 제거(수명>우주 나이), O형 BH>펄서, A형 RG 추가.
 *   ⑦O-8 삼중성 Mardling-Aarseth 클램프(비 4.7) — 출력 재매핑만, draw 수 불변.
 *   ⑧O-10 은하 밀도 — 나선팔 로그 나선(lnApprox, 피치 12.5°)·지수 원반(expNegApprox,
 *     Rd=R/3, NORM 1.7로 총 별 수 v10 동급). O-12 가스 위성 0개 20→2.
 *   전 항목 draw 수·순서 불변(클램프/재매핑 패턴) — PRNG 스트림 골든 불변, 출력 분포만 변경.
 *   섹터 밀도·다중성·궤도가 바뀌어 우주 골든 재생성 필요. Sol은 상수 분기 무영향.
 *   LIFE1 시작계 인근 생명 행성은 재검증 (E2E — 필요시 시드 교체).
 */
export const GEN_VERSION = 11
