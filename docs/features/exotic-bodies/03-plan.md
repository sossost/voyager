# Implementation Plan: 이색 천체 (Exotic Celestial Bodies)

**Status:** Draft
**Created:** 2026-06-15
**Spec:** ./01-spec.md
**Decisions:** ./02-decisions.md

> ⚠️ **PR 분할 (2026-06-16):** 4종 계획이지만 **이번 PR은 블랙홀만** 머지한다. 거성·왜성·펄서
> 관련 단계(Phase 3의 `StarSurface` 변조·`Pulsar.tsx`, Phase 5의 거성·왜성·펄서 아키타입)는
> **후속 PR로 이연**. `StarKind`는 현재 2종(`main_sequence | black_hole`), GEN_VERSION 5 유지
> (골든 무변화 — Phase 1 불변식 3의 "weight 잠금"이 그대로 성립). 상세: `02-decisions.md` 결정 16.

---

## Spec Summary

**Goal:** 주계열성만 있던 우주에 적색거성·백색왜성·펄서·블랙홀 4종을 `Star.kind`(append-only 마지막 draw)로 추가. 블랙홀은 풀스크린 포스트 없이 페이크 적층으로 "실사 가르강튀아". 발견은 현상 도감(`discoveredPhenomena`)에 기록. **GEN_VERSION 4→5**.

**핵심 불변식 (위반 = 기존 플레이어 우주 파손):**
1. `kind`는 'star' 스트림 **전부 뒤 마지막 draw** — 기존 localPos·spectral·multiplicity·companions 값 비트 보존.
2. `planetsOf`·`alienAt`·`moons`·`drawCompanions`·`Companion` 타입 **무변경** — 행성·외계·위성·동반성 골든 보존.
3. 골든 diff = 별 직렬화에 `kind` 1키 추가뿐. **프로브 섹터(2,0,3) 두 'F'별이 `main_sequence` 유지**되도록 weight 잠금.
4. Sol = `kind:'main_sequence'`(루프 continue로 draw 미실행), LIFE1 무영향, E2E green.
5. 천체 수학(반경·도플러·회전·clearance·맵 색)·저장(`discoveredPhenomena`)은 전부 GEN_VERSION 무관(렌더/저장 축).

---

## Implementation Plan

> 페이즈 1이 모든 것을 막는다(`kind` 존재 선행). 그 외는 1 의존. 각 페이즈는 독립 검증 가능.
> 메모리 `continuous-phase-execution`: 페이즈 간 확인 생략하고 끝까지 진행(게이트는 페이즈마다).

### Phase 1: 엔진 — `kind` 생성 + GEN_VERSION + 골든 (결정론 핵심) [M] — **TDD/RED-HIGH**
- [ ] `StarKind` 타입 + `KIND_WEIGHTS_BY_SPECTRAL` 상수(`sectors.ts`, `SpectralClass`/`MULTIPLICITY_WEIGHTS` 인근). O/B만 black_hole·pulsar, **F는 main_sequence 강하게**(프로브 별 검산).
- [ ] **분포 단위 테스트 먼저 작성**(`sectors.test.ts`, `sampleStars` 패턴): black_hole·pulsar는 spectral∈{O,B}에서만 / 전체 exotic 비율 상한 / 결정론 재현(`toEqual`).
- [ ] `kind` append draw — `sectors.ts:171`(`drawCompanions`) **직후**: `const kind = starRng.weighted(KIND_WEIGHTS_BY_SPECTRAL[spectral])`. `Star` 타입에 `readonly kind` 추가, 리터럴(`:175`)에 `, kind`. `SOL_STAR`(`:90-98`)에 `kind:'main_sequence'`. `engine/index.ts:22` export.
- [ ] `SOL_STAR.kind` 단언 추가(`sectors.test.ts:126-128`).
- [ ] `KIND_WEIGHTS` 수치 잠금 → 프로브 섹터(2,0,3) 두 'F'별이 `main_sequence`인지 손계산 검증.
- [ ] `version.ts:20` **실측 확인** 후 `GEN_VERSION = 5` + v5 사유 주석. 골든 단언 `universe.golden.test.ts:33-34` `toBe(5)`.
- [ ] 골든 재생성: `npx vitest run -u tests/golden/universe.golden.test.ts`. **수동 diff 리뷰**: 별에 `kind`만 추가(id↔localPos 사이 알파벳 삽입), planets/encounters/aliens/companions·SPECIES/PALETTE 스냅 불변. 그 외 움직이면 STOP.
- **Verify:** `npm run typecheck && npm run lint && npm run test` green(분포·결정론·골든·SOL). engine 순수성 ESLint green.

### Phase 2: 은하 맵 노드 + 정보 패널 (가장 싼 가시 효과, 순수 렌더) [S]
- [ ] `EXOTIC_RENDER`(`spectral.ts`, `Exclude<StarKind,'main_sequence'>` 미러) + `STAR_KIND_LABELS`. 적색거성 size는 결정 27 상한 클램프.
- [ ] `GalaxyStarField.tsx:56` kind 분기(`star.kind==='main_sequence' ? SPECTRAL_RENDER[spectral] : EXOTIC_RENDER[kind]`) — `:80`·`:151` 자동 전파, draw call·피킹 불변.
- [ ] `StarInfoPanel.tsx:71` 직전 "종류" 행(주성 `selectedCompanion==null` && `kind!=='main_sequence'`만). import `STAR_KIND_LABELS`.
- **Verify:** `npm run build` + preview — 맵에 거성/왜성/펄서/블랙홀 노드 색·크기 구분, 선택 시 패널 "종류" 표시. 피킹 정상.

### Phase 3: 근접 이색 천체 렌더 (헤드라인) [L]
- [ ] `multiplicity.ts` `renderedRadius`(L60)·`bodyVisualRadius`(L53)에 kind 반경 분기 **공유**(거성 큼·왜성 작음) → clearance 자동 정합(관통 없음).
- [ ] `StarSurface.tsx` optional `emissiveBoost?`/`coronaScale?`(기본값) — 거성/왜성. 기존 단일 항성 렌더 불변 확인.
- [ ] `scenes/system/exotic.ts`(순수 파라미터) + `ExoticBody.tsx`(디스패처) + `BlackHole.tsx`(그림자 구 + `AccretionDisk.tsx` 신규 가산 도플러 셰이더·회전 + 비대칭 포톤 호 빌보드, 결정 31 부분 호) + `Pulsar.tsx`(제트 콘 2개 + 점멸 ≤3Hz).
- [ ] `CurrentSystem.tsx`: `BodyVisual`(L58-63)+`kind`, 빌더(L106-123), L198 디스패치. 부모 group ref + `uOpacity` 크로스페이드 계약 준수(도착 팝인 방지).
- **Verify:** preview — 각 kind 근접 렌더; 이색 주성 + 동반성(쌍성/삼중성)에서 관통 없음; LOD/워프 게이팅 동작; CPU 4× throttle 30fps(풀스크린 포스트 0 확인).

### Phase 4: 블랙홀 맵 링 빌보드 + reduced-motion [M]
- [ ] `BlackHoleMapRings.tsx`(`SelectedStarMarker` 빌보드 패턴 복제, `stars.filter(black_hole)`, 1 draw call) — `GalaxyScene.tsx:100` 직후 시블링. 줌게이팅: 원거리 표시 → 근접 시 `CurrentSystem` ExoticBody로 핸드오프(`crossfadeProgress` 거리 패턴).
- [ ] reduced-motion 렌더 정책(최소): 펄서 점멸·강착원반 회전·자전 정적 폴백(`prefers-reduced-motion`).
- **Verify:** preview — 블랙홀 맵에서 보임, 근접 핸드오프 매끈, reduced-motion 정적.

### Phase 5: 현상 도감 (수집) [M]
- [ ] `data/phenomena/phenomena.ts` 정적 카탈로그(`PHENOMENA_CATALOG`, 4 아키타입 label·lore·rarity, `species.ts` frozen 패턴, 키=kind).
- [ ] `persistence/types.ts`: `PhenomenonDiscovery` + `Profile.discoveredPhenomena?`. hydration `?? []`.
- [ ] `createGameStore.ts` `warpTo`(L131-135): `visitedAt=now()` 호이스트, 목적지 exotic이면 캐시 set + `buildProfile`(L68-76)에 `discoveredPhenomena` 포함 → `saveProfile`이 함께 커밋(신규 쓰기 경로 0). 최초 발견(파생) 토스트.
- [ ] `CodexOverlay.tsx:128` 탭 셸(`useState<'species'|'phenomena'>`) + `CodexContent`=탭1 + `PhenomenaTab` 신규(발견/미발견·발견 수·최초 뱃지). a11y `role=tablist/tab/tabpanel` + 키보드.
- **Verify:** preview — 이색 천체 워프 → 발견 기록 영속; 도감 "현상" 탭 발견/잠금 + 최초 뱃지; 키보드 탭 내비. 메모리 폴백 동등(profile 왕복 기검증).

### Phase 6: 테스트·E2E·게이트 [M]
- [ ] 로직 농후 부분(`exotic.ts` 도플러/제트 수학, kind 반경 분기) 단위 테스트, 커버리지 80%+.
- [ ] E2E: LIFE1(coreLoop·memoryFallback) green 유지. (선택) 알려진 이색 별로 발견 E2E.
- **Verify (전체 게이트):** `npm run typecheck && npm run lint && npm run test && npm run test:coverage && npm run build && npm run test:e2e` 전부 green.

## Dependencies
- Phase 2·3·5 → Phase 1 (`kind` 존재 + 컴파일)
- Phase 4 → Phase 2·3
- Phase 6 → 전 페이즈
- Phase 5는 Phase 3·4와 병렬 가능(저장 축 독립)

## Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| 골든 회귀(별 외 값 변동) | **HIGH** | Phase 1 TDD-first. `KIND_WEIGHTS` 잠금 → 프로브 'F'별 main_sequence 손검산. 재생성 후 수동 diff(별 +kind키만). |
| weighted draw 수 변동으로 결정론 깨짐 | **HIGH** | `weighted()`=next() 1회(검증됨). kind는 companions 뒤 **마지막**. 분포·재현 테스트로 가드. |
| 이색 주성 다중성계 별/행성 관통 | MEDIUM | `renderedRadius` 단일 소스 분기(시각=충돌 반경 공유), 쌍성계 clearance 재사용. |
| 블랙홀 결정 31 위반(감싸는 막) | MEDIUM | 포톤=부분 호(크레센트), 강착원반=평면 디스크, 그림자=깨끗한 구. 리뷰 시 결정 31 대조. |
| 모바일 30fps(fill-rate) | MEDIUM | 풀스크린 포스트 0, 가산 빌보드 1~수 draw, 줌게이팅, no-Bloom 폴백. throttle 실측. |
| 펄서 점멸 광과민성 | MEDIUM | 점멸 ≤3Hz·대비 상한, reduced-motion 정적. |
| 네이밍 충돌(discoveredSpecies) | LOW | `discoveredPhenomena`/`PhenomenonDiscovery` 사용. |

## Estimated Complexity: L (엔진 1 HIGH-risk 페이즈 + 렌더 4종 + 도감 + 골든 재생성)

---

## Verification Gate (커밋 전 전부 green)

```bash
npm run typecheck && npm run lint && npm run test && npm run test:coverage && npm run build
npm run test:e2e
```

GEN_VERSION 범프 골든 재생성:
```bash
# version.ts·골든 단언을 5로 먼저 고친 뒤
npx vitest run -u tests/golden/universe.golden.test.ts
# 수동 diff 리뷰: 별 +kind키만, planets/encounters/aliens/companions 불변
```
