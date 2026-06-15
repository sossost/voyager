# Implementation Plan: 쌍성계 / 다중성계 (Binary & Multiple Star Systems)

**Status:** ✅ Implemented (2026-06-15)
**Created:** 2026-06-15
**Spec:** ./01-spec.md
**Decisions:** ./02-decisions.md

---

## Spec Summary

**Goal:** 단일 항성만 생성하던 우주에 쌍성·삼중성을 도입. 동반성은 주성 스트림 뒤 append-only draw로 생성(은하 맵 노드는 1개 유지), 질량중심을 공전하는 제2/제3태양으로 사실적으로 렌더.

**Key Behaviors:** 다중 ~45%(single55/binary33/triple12) · 계층형 삼중성 · 동반성 분광 주성 이하 · 질량중심 실시간 공전(편심) · 이중/삼중 광원 · 분리거리 기반 행성 배치(circumbinary↔주성) · 패널에 등급+구성별 분광형.

**핵심 불변식:** 기존 별 localPos·spectral 값 보존 · `planetsOf` 무변경(행성/외계 골든 보존) · Sol 단일성 · engine/ 순수성 · GEN_VERSION 3→4.

---

## Architecture

요약 (상세는 02-decisions §9·§10):
- **엔진**: `Multiplicity`·`Companion` 타입 + `starsInSector` append draw. raw 파라미터만 생성.
- **렌더**: `scenes/system/multiplicity.ts`(신규)에 질량 룩업·질량중심·공전·circumbinary 판정. `CurrentSystem`이 별 N개·광원 N개·`planetCenter` 그룹 렌더.
- **HUD**: `StarInfoPanel`에 등급+구성 분광형.
- **원점 = inner barycenter** → 단일성 무회귀, circumbinary 자동.

---

## Implementation Plan

### Phase 1: 엔진 + GEN_VERSION + 골든 [M]

순수 생성 레이어. append-only 규칙·값 보존이 이 페이즈의 전부.

- [ ] `sectors.ts` — `Multiplicity`·`Companion` 타입 추가, `Star`에 `multiplicity`·`companions` 필드 추가
- [ ] `sectors.ts` — `MULTIPLICITY_WEIGHTS`(55/33/12), `ECC_MAX`, separation 범위 상수(BINARY/INNER/OUTER), `companionWeightsAtMost(primary)` helper
- [ ] `sectors.ts` — `starsInSector` 기존 4 draw **뒤에** multiplicity→companion 루프 append (draw 순서: spectral→separation→eccentricity→phase)
- [ ] `sectors.ts` — `SOL_STAR` 상수에 `multiplicity:'single', companions:[]` 추가
- [ ] `index.ts` — `Multiplicity`·`Companion` 타입 export
- [ ] `version.ts` — `GEN_VERSION = 4` + 사유 주석(v4: 별 스트림 동반성 append, 쌍성/삼중성)
- [ ] `sectors.test.ts` — 신규 테스트:
  - 다중성 분포가 목표 비율 근방 (큰 표본 카운트, 허용 오차)
  - 모든 companion.spectral이 주성 질량 이하 (SPECTRAL_BY_MASS 인덱스 ≥ 주성)
  - triple은 companions 길이 2 + [inner, outer] 계층, binary는 1, single은 0
  - **append-only 값 보존**: 고정 (seed, sector)의 별 localPos·spectral이 하드코딩 기대값과 일치 (회귀 잠금)
  - 결정론: 같은 (seed,sector)는 companions까지 동일
  - SOL_STAR는 single·companions 빈 배열 (기존 `toEqual(SOL_STAR)` 테스트 유지 확인)
- [ ] `universe.golden.test.ts` — `GEN_VERSION`을 4로 단언 변경
- [ ] 골든 스냅샷 재생성: `npm test -- -u` → diff 검토(별에 multiplicity·companions만 추가, 기존 값·planets·encounters 불변인지 육안 확인)

**Verify:** `npm run typecheck && npm run lint && npm run test` green. 골든 diff가 "별 신규 필드 추가 + 행성/외계 불변"임을 확인.

---

### Phase 2: 동반성 렌더 + 질량중심 공전 [L]

- [ ] `scenes/system/multiplicity.ts`(신규) — `SPECTRAL_MASS` 룩업, `massOf`, `bodyPositions(star, elapsed, outArray)`(단일/쌍성/삼중성 타원 근사), `isCircumbinary(star)`, `companionVisualRadius(spectral)`, 상수(`COMPANION_ORBIT_SCALE`, `CIRCUMBINARY_THRESHOLD`, 공전 각속도)
- [ ] `multiplicity.test.ts`(신규) — bodyPositions 단위 테스트: single은 원점, binary는 질량비대로 반대편·합이 질량가중 0(질량중심 보존), 결정론, circumbinary 판정 임계
- [ ] `CurrentSystem.tsx` — `bodies = [primary, ...companions]` 구성, 각 별 `StarSurface`(색·반경 주입) + `pointLight`를 systemGroup 자식으로 렌더, 위치는 ref 배열 + useFrame에서 `bodyPositions` 갱신
- [ ] 워프 중(`isWarping`)엔 기존처럼 StarSurface 전체 중단 — 동반성도 함께 중단
- [ ] LOD: 기존 group.visible 로직 유지 (동반성도 그룹 자식이라 자동 적용)

**Verify:** preview_start → 다중성계 항성계 진입, 2~3개 별이 질량중심을 공전, 분광 색·크기 대비 확인, console 에러 없음. 단일성 항성계는 기존과 동일(주성 중앙 정지).

---

### Phase 3: 행성 배치 적응 (circumbinary ↔ 주성) [M]

- [ ] `CurrentSystem.tsx` — 행성들을 `<group ref={planetCenterRef}>`로 감싸고, useFrame에서 위치 지정: `isCircumbinary`면 (0,0,0), 아니면 주성 현재 위치(`bodyPositions`의 primary 슬롯)
- [ ] `PlanetCalloutProjector` 좌표 정합 확인 — 콜아웃이 planetCenter 오프셋을 반영해야 함 (현재 별 월드 오프셋 + planetCenter + 궤도 위치). 필요 시 projector에 center 전달
- [ ] 단일성: planetCenter=(0,0,0)=주성 → 기존 동작 100% 동일 회귀 확인

**Verify:** 근접 쌍성 = 행성이 두 별 바깥에서 barycenter 공전(타투인식), 원거리 쌍성 = 행성이 주성 따라감·동반성은 멀리. 콜아웃 위치가 행성에 정확히 붙는지 확인.

---

### Phase 4: HUD 다중성 표시 [S]

- [ ] `multiplicity.ts` 또는 HUD helper — `multiplicityRankLabel(star)`, `spectralCompositionLabel(star)`(예: 'G + M')
- [ ] `StarInfoPanel.tsx` — 다중성계일 때 '구성' `hud-fact` 행 추가(등급 + 구성별 분광형). 단일성은 기존 그대로
- [ ] (선택) `SystemReadout.tsx` — 진입 리드아웃 이름 옆/아래 등급 suffix('· 쌍성계')
- [ ] (선택) `JournalOverlay.tsx` — 방문 목록에 다중성 마이크로 마커 — 범위 밖이면 보류

**Verify:** 쌍성/삼중성 별 선택 시 콜아웃에 'G + M' 식 구성 표시, 단일성은 미표시. 데스크탑+모바일(≤540px 도킹) 레이아웃 깨짐 없음.

---

### Phase 5: 테스트·폴리시·튜닝 [M]

- [ ] E2E `npm run test:e2e` — coreLoop·memoryFallback green 확인 (Sol 단일 → 무변경 기대). 실패 시 원인 분석
- [ ] reduced-motion — 공전 useFrame 정책 확인(정지 또는 저속). 별 초기 위상은 결정론 표시
- [ ] 성능/LOD — CPU 스로틀에서 다중성계 진입 시 프레임 유지, 광원 3개 부담 실측
- [ ] 튜닝 — `COMPANION_ORBIT_SCALE`·`CIRCUMBINARY_THRESHOLD`·공전 속도·동반성 반경 시각 조정(01-spec Open Questions)
- [ ] `npm run test:coverage` 80%+ 유지, `npm run build` green
- [ ] 백로그 E-5#3·G-c#3 ✅ 처리, 02-decisions 결정 번호 본 시트 편입

**Verify:** 전체 게이트 green (`typecheck && lint && test && test:coverage && build && test:e2e`).

---

## Dependencies

- Phase 2·3·4 → Phase 1 (타입·데이터 필요)
- Phase 3 → Phase 2 (bodyPositions·primary 위치 필요)
- Phase 4 → Phase 1 (companions 데이터). Phase 2와 병행 가능
- Phase 5 → 전 페이즈

## Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| 기존 별 localPos/spectral 값 변경(우주 깨짐) | HIGH | Phase 1에서 값 보존 단위 테스트 + 골든 diff 육안 검토. append-only 순서 엄수 |
| 행성/외계 골든이 의도치 않게 변경 | HIGH | `planetsOf` 무변경 — diff에 system.planets·encounters 변화 없어야 함. 변화 시 즉시 중단 |
| GEN_VERSION 누락 → 철칙 2 위반 | HIGH | Phase 1 체크리스트에 명시, 골든 단언 4로 강제 |
| Sol/LIFE1 회귀 | MED | Sol 조기 continue 보존 + 기존 SOL 테스트 유지 + E2E green |
| 삼중성 2단계 질량중심 공전 복잡도 | MED | multiplicity.ts에 격리·단위 테스트. binary 먼저 완성 후 triple 확장 |
| 다중 광원 성능 | MED | 최대 3개·LOD 적용. Phase 5 실측, 필요 시 동반성 광원 강도 하향/통합 |
| 콜아웃 좌표 어긋남(planetCenter 오프셋) | MED | Phase 3에서 projector 좌표 명시 검증 |
| R3F 규율 위반(공전각 store화) | LOW | ref+useFrame만, store 금지 — 코드리뷰 체크 |

## Estimated Complexity: **L**

엔진 변경 자체는 작지만(append draw), 사실적 다중성 렌더(2단계 질량중심 공전·다중 광원·행성 배치 적응)와 GEN_VERSION/골든 규약이 무게중심.

---

## Verification Gate (커밋 전 전부 green)

```bash
npm run typecheck && npm run lint && npm run test && npm run test:coverage && npm run build
npm run test:e2e
```
