# Implementation Plan: 펄서(중성자성) 고품질 렌더

**Status:** Approved
**Created:** 2026-06-17
**Spec:** ./01-spec.md
**Decisions:** ./02-decisions.md

---

## Spec Summary

**Goal:** 이색 천체 두 번째 종 **펄서**를 블랙홀급 고품질로 도입. 히어로 = 회전하는 등대 쌍극 빔(부드러운 글로우 펄스, 광과민성 안전), 받침 = 상대론적 쌍제트 + 초고온 본체/폴라캡. 인씬 셰이더 + high 디테일(포스트이펙트 X).
**Engine:** `StarKind`에 `'pulsar'` append, O/B 한정·블랙홀보다 약간 흔하게, **GEN_VERSION 7 + 골든 재생성**. 다중성계 허용·행성 유지(블랙홀과 차별).

## 게이트 (커밋 전 전부 green — CLAUDE.md)

```bash
npm run typecheck && npm run lint && npm run test && npm run test:coverage && npm run build
npm run test:e2e   # LIFE1 불변 단언
```

---

## Implementation Plan

### Phase 1: 엔진 + 타입 완결 + 분포/골든 [S]

> `StarKind`에 `'pulsar'` 추가는 여러 파일의 exhaustive 타입을 깬다 → 타입 완결 스텁을 같은 페이즈에서 처리해 typecheck를 green으로 유지. 이 페이즈에서 펄서는 임시로 `StarSurface`로 렌더된다(디스패치는 Phase 2).

- [ ] `engine/galaxy/sectors.ts` — `StarKind` += `'pulsar'`; `KIND_WEIGHTS_BY_SPECTRAL`의 O·B에 `{ value: 'pulsar', weight: N }` 추가 (weight: pulsar > black_hole, 예 O: pulsar 10/black_hole 6, B: pulsar 6/black_hole 3 — Phase 1에서 분포 테스트로 확정).
- [ ] `engine/version.ts` — `GEN_VERSION = 7` + v7 주석(펄서 kind 분포 변경, 프로브 섹터 F/G/M이라 골든 diff 0이지만 결정 13으로 범프).
- [ ] `scenes/system/exotic.ts` — `kindRadiusFactor`에 `case 'pulsar'` (작고 조밀한 본체, 예 0.6).
- [ ] `scenes/galaxy/spectral.ts` — `EXOTIC_RENDER.pulsar`(전기 청백 `#bfe6ff` 계열, size ≈ 3.0), `STAR_KIND_LABELS.pulsar = '펄서'`.
- [ ] `data/phenomena/phenomena.ts` — `PHENOMENA_CATALOG`에 펄서 아키타입(`kind:'pulsar'`, `label:'펄서'`, 로어, `rarity:'rare'`). 헤더 주석의 "후속 PR" 문구 갱신.
- [ ] `engine/galaxy/sectors.test.ts` — `STAR_KINDS` += pulsar; describe를 GEN_VERSION 7로; 펄서 분포 테스트: ① 펄서는 O/B에서만 ② 펄서가 블랙홀보다 흔하다(count 비교) ③ exotic 총합 상한 유지.
- [ ] `scenes/system/exotic.test.ts` — `ALL_KINDS` += pulsar; `kindRadiusFactor('pulsar')` 유한 양수·`< 1` 단언.
- [ ] `tests/golden/universe.golden.test.ts` — `expect(GEN_VERSION).toBe(7)`; `npm run test -- -u`로 스냅샷 재생성(프로브 섹터 diff 0 확인).
- **Verify:** `npm run typecheck && npm run lint && npm run test` green. 골든 diff = GEN_VERSION 필드만(별 kind 값 불변 확인). 펄서는 화면상 임시 StarSurface.

### Phase 2: Pulsar 고품질 렌더 컴포넌트 (히어로) [L]

> 작업의 핵심. `BlackHole.tsx`/`StarSurface.tsx` 패턴 계승. 옛 `1e149cf:Pulsar.tsx`는 골격 참조용(그대로 복원 금지 — 그게 불만의 원인).

- [ ] `scenes/system/Pulsar.tsx` (신규) — 02-decisions Architecture의 씬그래프 계층 구현:
  - 본체: `StarSurface`(emissiveBoost ≈ 2.0, coronaScale ≈ 0.7) + 자기극 폴라캡 가산 핫스팟 2개.
  - 자전 그룹(`spinRef`, `SPIN_RATE`) → 자기축 틸트 서브그룹(`MAGNETIC_OFFSET`)에 **등대 쌍극 빔 2개**(가산 콘, high=내부 레이어·fbm·리딩엣지 밝기) + 자전축 정렬 **상대론적 쌍제트 2개**(high=충격파 노트).
  - **카메라 향 글로우 펄스**: 빔 월드 방향 2개와 카메라 시선 내적 → 중앙 가산 플레어 빌보드 강도 변조. 펄스 하한 클램프(완전 소등 없음), `SPIN_RATE`로 통과 ≤3Hz.
  - 셰이더 안전(각도 normalize·`d*d`·clamp·위험 pow 금지). 머티리얼 `useEffect` dispose.
  - crossfade opacity: 모든 가산 머티리얼 `uOpacity = 1 - crossfadeProgress(거리)`.
  - 티어 분기: `QUALITY_PRESETS[qualityTier]`로 high=풀디테일 / medium·low=경량(단일 콘·노이즈 생략).
- [ ] `scenes/system/exotic.ts` 또는 Pulsar 모듈 상수 — 형태 상수(`SPIN_RATE`·`MAGNETIC_OFFSET`·`BEAM_LEN_FACTOR`·`BEAM_CONE_ANGLE`·`JET_LEN_FACTOR`·`PULSE_MIN`).
- [ ] `scenes/system/CurrentSystem.tsx` — 본체 디스패치에 `body.kind === 'pulsar' ? <Pulsar radius color /> :` 분기 추가.
- **Verify:** `npm run build` green. 프리뷰로 펄서 별 워프 진입 → 빔 회전·글로우 펄스·제트·본체 육안 확인(LIFE1 인근 or 디버그 시드). 콘솔 에러 0, high 티어 검은 화면 없음(NaN 가드).

### Phase 3: 통합 검증 + 발견 트리거 + E2E [S]

> 도감·맵·패널은 타입/분기 재사용으로 자동 동작 — 동작 확인 + 테스트 보강.

- [ ] 확인(코드 변경 없음 예상): `StarInfoPanel`/`SystemReadout` "펄서" 라벨, `GalaxyStarField` 맵 노드 전기 청백, `CodexOverlay` 현상 탭 펄서 슬롯, `warpTo` 펄서 발견 기록.
- [ ] `store/createGameStore.test.ts` — 펄서 발견 테스트(sampleStars에서 펄서 별 찾아 warpTo → `discoveredPhenomena`에 `kind:'pulsar'` 기록·최초 발견 플래그). 블랙홀 테스트 패턴 재사용.
- [ ] E2E(`tests/e2e/`) — LIFE1 시드 불변 단언이 green인지 확인(펄서가 LIFE1 시작계에 없음). 필요 시 펄서 존재 시드로 맵 노드/도감 스모크 추가(과하면 생략).
- **Verify:** `npm run test && npm run test:coverage && npm run test:e2e` green.

### Phase 4: 게이트 · 폴리시 · 광과민성 검증 [S]

- [ ] 광과민성 실측 — 빔 통과 주파수 ≤3Hz, 완전 소등 없음, 급격한 대비 변화 없음(SPIN_RATE·PULSE_MIN 조정).
- [ ] 비주얼 튜닝 — 빔 길이·콘각·색, 폴라캡 강도, 제트 충격파, 플레어 강도. Bloom 본체 백색 메움 없는지(본체 작게·강도 clamp).
- [ ] 전 게이트 green + 다중렌즈 코드리뷰(code-reviewer + security-reviewer 병렬, CRITICAL 0).
- [ ] 02-decisions/03-plan 편차 노트 갱신, 메모리 갱신.
- **Verify:** `npm run typecheck && npm run lint && npm run test && npm run test:coverage && npm run build && npm run test:e2e` 전부 green.

## Dependencies

- Phase 2 → Phase 1 (kind·타입·radius 팩터 선행)
- Phase 3 → Phase 2 (Pulsar 렌더 + 디스패치 후 통합 확인)
- Phase 4 → Phase 3

## Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| 빔/제트 셰이더 NaN → high 티어 검은 화면 (Bloom 번짐) | HIGH | 블랙홀 교훈 준수 — 각도 normalize·`d*d`·출력 clamp·위험 pow 금지. high 티어 워프 진입 육안 검증 |
| 광과민성(빔 카메라 직격 섬광) | MEDIUM | SPIN_RATE로 통과 ≤3Hz, PULSE_MIN 하한(완전 소등 없음), 부드러운 글로우 펄스(결정 4·5) |
| 골든/분포 회귀 | MEDIUM | GEN_VERSION 7 범프 + 골든 regen, 프로브 섹터 diff 0 확인, 분포 단위 테스트, LIFE1 E2E |
| Bloom이 작은 본체를 백색으로 메움 | MEDIUM | 본체 반경 작게(kindRadiusFactor 0.6)·빔/플레어 강도 clamp(블랙홀 교훈 2) |
| 다중성계 펄서 주성 출력 회귀 | LOW | `isBlackHole` 분기 불변(펄서는 multiplicity·companions 보존) — 분포 테스트로 검증 |
| 펄서 본체 디스패치 누락 시 StarSurface 폴백 | LOW | Phase 2 디스패치 추가, 프리뷰 육안 확인 |

## Estimated Complexity: M (엔진/통합은 S, Pulsar 렌더가 L)
