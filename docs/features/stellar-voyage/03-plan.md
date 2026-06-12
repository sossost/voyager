# Implementation Plan: Voyager (v1 코어 루프)

**Status:** Approved
**Created:** 2026-06-11
**Spec:** ./01-spec.md
**Decisions:** ./02-decisions.md

---

## Spec Summary

**Goal:** 시드 기반 무한 3D 은하를 항행하며 절차 생성 외계인을 수집하는 캐주얼 웹 게임 v1
**Key Behaviors:** 은하 뷰 → 워프 → 태양계 뷰 → 생명체 행성 탐사 → 조우 카드 → 도감/일지
**Architecture:** React + R3F 단일 영속 Canvas, 순수 결정론 엔진(engine/) 분리, Zustand 4슬라이스, StorageDriver(Dexie/Memory 동등) — 상세는 02-decisions.md Architecture 섹션

## 기술 스택 (버전 고정)

| 패키지 | 버전 | 비고 |
|--------|------|------|
| react / react-dom | ~19.2 | **R3F 9.6 peer가 `<19.3` 캡** — lockfile로 자동 업그레이드 차단 |
| three | ^0.184 | v1 기간 중 업그레이드 동결 |
| @react-three/fiber | ^9.6 | v10은 알파 — 채택 금지 |
| @react-three/drei | ^10.7 | OrbitControls, PerformanceMonitor |
| zustand | ^5 | 4슬라이스 + write-through |
| dexie | ^4.4 | liveQuery 미사용 |
| motion | ^12 | 조우 연출 (구 framer-motion) |
| detect-gpu / maath | ^5 / ^0.10 | 초기 품질 티어 / damp |
| @react-three/postprocessing | ^3 | high 티어 전용 Bloom (동적 로드) |
| vite / typescript | ^7 / ~5.8 | strict + noUncheckedIndexedAccess |
| vitest / fast-check / fake-indexeddb | ^4 / ^4 / ^6 | 엔진 90%/전체 80% 커버리지 |
| @testing-library/react / @react-three/test-renderer | ^16 / ^9 | UI jsdom / 씬 그래프 |
| @playwright/test | ^1.5x | E2E — 픽셀 비교 대신 상태 단언 |
| eslint + eslint-plugin-boundaries | ^9 | engine/ 순수성 기계 강제 |
| svgo + @svgr/cli | ^4 / ^8 | 파츠 빌드 파이프라인 |
| r3f-perf + leva | dev only | 성능 계측 + 파라미터 튜닝 |
| (미채택) seedrandom, simplex-noise 등 | — | PRNG·노이즈는 벤더링 — 의존성 업데이트 = 우주 파괴 |

## Implementation Plan

### Phase 1 — 프로젝트 기반 (git + Vite + 품질 게이트 + Canvas 골격) [M]

- [ ] git init + Vite react-ts 스캐폴딩 + strict tsconfig(noUncheckedIndexedAccess) + 경로 alias + src/ 폴더 트리 + 첫 커밋 (1h)
- [ ] ESLint 9 flat config: eslint-plugin-boundaries로 engine/ → react·three·persistence·브라우저 API 임포트 금지, no-restricted-properties로 Math.random 전역 금지 + engine/ 내 초월함수(sin/log/exp/pow) 금지 — 위반 샘플로 동작 확인 (2h)
- [ ] vitest + coverage-v8(엔진 90%/전체 80% 임계치) + fake-indexeddb + @testing-library/react + fast-check 환경 구성, 더미 테스트로 파이프 검증 (1.5h)
- [ ] 런타임 의존성 설치 및 버전 고정 (react ~19.2 캡 주의) (0.5h)
- [ ] 단일 영속 Canvas + z-레이어 골격(z-0/10/20/30) + 회전 박스 헬로 씬 + r3f-perf 개발 오버레이 (1.5h)
- [ ] WebGL 프로브 + WebGLBlocked 차단 화면 + ContextLossGuard 골격(contextlost/restored + Canvas key 리마운트) (1.5h)

**Verify:** dev 서버에서 헬로 씬 60fps. lint/test/build 모두 green. engine/에서 react·Math.random 사용 샘플이 lint 에러로 차단. WebGL 강제 비활성화 시 차단 화면.

### Phase 2 — 결정론 생성 엔진 (TDD, 순수 TS — 3D 무관) [L]

- [ ] cyrb128 + sfc32 벤더링('수정 금지' 봉인 주석) + Rng 래퍼(next/int/pick/weighted) — 고정 시드 첫 1000개 출력 해시 골든 마스터 (1.5h)
- [ ] rngFor(seed, ns, ...key) 스트림 팩토리 + 격리 테스트: 한 스트림의 draw 추가가 다른 스트림에 무영향 (1h)
- [ ] coords.ts: 브랜디드 타입 + 인코딩/파싱/검증 + 시드 정규화(1~32자 영숫자) (1h)
- [ ] 정수 격자 value noise(산술 보간만) + 은하 원반 감쇠·나선팔 밀도 함수 — 초월함수 0 검증 (2h)
- [ ] starsInSector: 섹터 → 별(로컬 위치/분광형/이름) — 결정론·개수 범위 테스트 (1.5h)
- [ ] planetsOf: 1~8행성, 암석/가스, 생명체 10% — 10k 샘플 몬테카를로 분포 테스트 (1.5h)
- [ ] SpeciesArchetype JSON 스키마 + 60종 스텁 데이터(커먼32/레어18/에픽8/레전더리2) + 스키마 검증 (2h)
- [ ] alienAt: 희귀도 가중(70/22/7/1) → 종족 → 파츠/팔레트/이름 + 결정론 individualId — 분포·결정론 테스트 (2h)
- [ ] fast-check 속성 테스트(임의 (seed,coords) 2회 생성 = 동일, 1000케이스) + 시드 3종 생성물 전체 직렬화 골든 스냅샷 커밋 + GEN_VERSION 연동 (1.5h)

**Verify:** vitest green, 엔진 커버리지 90%+. 골든 스냅샷 3종 커밋. 10k 샘플 생명체율 9~11%, 희귀도 분포 ±1%p. engine/ 외부 런타임 의존성 0.

### Phase 3 — 스토어 + 은하 뷰 (첫 비주얼) [M]

- [ ] Zustand 4슬라이스 + universe 상수 + SceneState 가드 전이 액션 — 비합법 전환 차단 단위 테스트 (2h)
- [ ] SectorPoints: 섹터당 Points 1드로콜 + 프래그먼트 셰이더 라디얼 글로우 + 분광형별 색/크기 + maxPointSize 캡 (2h)
- [ ] useVisibleSectors: 로드 R/언로드 R+1 히스테리시스 + LRU(용량 ≥ 티어별 가시 작업셋) + 300ms 페이드인 + 200ms 스로틀 (2h)
- [ ] CameraRig: 마우스 회전/줌/팬 + 터치 드래그/핀치 + maath damp (1.5h)
- [ ] useStarPicking: 화면공간 최근접 1차(click/tap 시점에만) + raycast 보조 + 터치 히트 반경 2배 + 선택 하이라이트 (2h)
- [ ] StarInfoPanel(이름/분광형/방문 여부 Set 조회) + 항행 버튼(현재 별 비활성 + 즉시 진입) + drei Stars 원경 (1.5h)

**Verify:** 데스크탑 60fps, 드로콜 < 가시 섹터 수. 카메라 고속 이동 시 스파이크 없음. 같은 시드 재실행 = 같은 별(이름 포함). 마우스·터치 양쪽 별 선택.

### Phase 4 — 워프 + 태양계 + 기록 write-through (메모리 드라이버 선행) [M]

- [ ] StorageDriver 인터페이스 + MemoryDriver + persist() 백오프 래퍼 — 두 드라이버 공유 계약 테스트 스위트 (2h)
- [ ] SystemScene: 분광형 색 항성 + 행성(암석/가스 시각 구분) + 시간 t 기반 공전 + Orbits (2h)
- [ ] 행성 피킹 + PlanetPanel(타입/생명체 신호/탐사 버튼) + 은하 복귀 (1.5h)
- [ ] WarpEffect 3단 타임라인: 스트리크 셰이더 → FOV 60→85 펄스 → 플래시 피크 씬 스왑 은닉 (2h)
- [ ] 워프 커밋 배선: 플래시 전 저장 커밋 + 플로팅 오리진 rebase + 방문 별 마커 — 멱등성 테스트 (1.5h)

**Verify:** 별 선택→워프(프레임 드랍 없음)→태양계→행성 패널→복귀 전체 루프. 워프 중 재워프 가드 차단. 재방문 별 '방문함' 표시. 왕복 시 행성 구성 동일.

### Phase 5 — 조우 + 파츠 파이프라인 (placeholder-first) [M]

- [ ] scripts/build-parts.ts(svgo→@svgr/cli→parts.manifest.ts) — 샘플 파츠 3개로 검증 (1.5h)
- [ ] 기하 도형 placeholder 파츠 풀세트 — 60종 전부의 fixedParts/allowedParts 커버 (2h)
- [ ] AlienCard: 슬롯 z순서 합성 + CSS 변수 팔레트 + 실루엣 모드 + 희귀도 프레임 — 개체→SVG 스냅샷 테스트 (2h)
- [ ] ScanSequence(motion): 빌드업 + 희귀도 4단계 차등 공개 연출 + 카드 플립 (2h)
- [ ] explore 액션: 생성→중복 판정→최초 발견 플래그→캐시 갱신→write-through — 재방문 멱등성 테스트 (1.5h)

**Verify:** 탐사→스캔→카드→등록 동작. 재탐사 = 동일 개체 + '이미 조우함' + 중복 등록 없음. 4개 희귀도 연출 시각 구분. 최초 발견 종족 해금.

### Phase 6 — IndexedDB 영속화 + 복원 + 시드 온보딩 + 도감/일지 [M]

- [ ] Dexie 스키마 v1 + DexieDriver — fake-indexeddb로 Phase 4 계약 테스트 통과 (2h)
- [ ] probeStorage 실제 open 프로브(실패 주입 테스트) → MemoryDriver 폴백 + 상시 경고 배너 (1.5h)
- [ ] 부트 시퀀스: 복원→하이드레이트→현재 별 직행, genVersion 불일치 안내 + SeedSetup(자동생성/입력/인라인 검증/?seed= 프리필) (2h)
- [ ] CodexGrid: 60슬롯(미발견 실루엣) + 완성률 + 종족 상세/개체 목록 — store 캐시만 읽음 (2h)
- [ ] Journal: VisitTimeline(listVisits 페이징) + 시드 복사/공유 (1.5h)

**Verify:** 새로고침/재시작 후 완전 복원. IDB 차단 환경에서 배너 + 도감·일지 포함 전체 플레이 가능. 잘못된 시드 인라인 에러. 같은 시드 = 같은 좌표 동일 외계인.

### Phase 7 — 품질 자동 하향 + 모바일 + 접근성 + E2E + 아트 교체 [L]

- [ ] useQualityTier: detect-gpu 초기 티어 → QualityPreset(DPR 2/1.5/1, 별 20k/8k/3k, maxPointSize, 세그먼트) + PerformanceMonitor decline 시 DPR→별 예산→postFx 순 하향 + 수동 오버라이드 (2h)
- [ ] visibilitychange + 풀스크린 오버레이 시 frameloop='never' + 태양계 이탈 시 dispose (1.5h)
- [ ] high 티어 전용 Bloom 동적 로드 + 워프/항성 적용 (1h)
- [ ] 모바일 마감: 375px 반응형(패널 시트화) + 터치 타겟 44px + 실기기 검증 (2h)
- [ ] 접근성: 포커스 트랩, Tab 순서, ESC, ARIA, 명도 대비, 키보드 전 루프 (2h)
- [ ] Playwright E2E: 부트→워프→탐사→카드→도감→새로고침 복원 + IDB 차단 폴백 시나리오 (2h)
- [ ] 실아트 1차 교체: body 12종 + 우선 슬롯 변형 (잔여 placeholder는 출시 비차단) (2h)
- [ ] 수락 기준 12개 전수 체크 + CPU 4x 스로틀 자동 하향 확인 + 문서 갱신 (1.5h)

**Verify:** 스로틀에서 자동 하향·30fps 유지. 모바일 실기기 코어 루프 완주. 키보드 전 조작. E2E green, 커버리지 80%+(엔진 90%+). AC 12개 전부 체크.

## Dependencies

```
Phase 1 → 2 → 3 → 4 → 5 → 6 → 7   (직렬 — 각 phase가 이전 산출물 위에 쌓임)
```

- Phase 2는 3D와 무관한 순수 TS — 비주얼 작업과 심리스하게 병행 가능하나, Phase 3이 엔진 출력을 그리므로 선행 필수
- Phase 4에서 MemoryDriver를 먼저 만들어 계약 테스트를 확보하고, Phase 6의 DexieDriver가 같은 테스트를 통과(폴백 동등성)
- 실아트 제작(Phase 7 마지막)은 Phase 5 이후 언제든 병행 가능 — placeholder가 출시를 보호

## Estimated Complexity: XL

총 43개 태스크, 순작업 약 74시간 (1인 개발 기준 풀타임 2~3주, 파트타임 5~7주)

## Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| 생성 로직 변경·부동소수점 발산이 기존 우주를 조용히 변경 (시드 공유·재방문 AC 파괴) | HIGH | 5중 방어: 스트림 격리(1차) / GEN_VERSION(2차) / 정수 결정 경로 + 초월함수 lint 금지 / PRNG 벤더링+봉인+골든 마스터 / 시드 3종 직렬화 스냅샷 + fast-check를 CI 게이트로 |
| 60종 × 파츠 SVG 에셋 물량이 1인 개발 최대 병목 | HIGH | 종족=JSON 데이터 + 에셋 ~68개 압축 + placeholder-first(시스템 먼저 완성) + svgo/svgr 자동화 + CSS 변수 팔레트(색 변형 에셋 0개) |
| 모바일 저사양 GPU에서 글로우 오버드로우(fill-rate) + 고DPR 프레임 붕괴 | MEDIUM | detect-gpu 사전 티어링 + PerformanceMonitor 사후 적응. 하향 순서 고정(DPR→별 예산→postFx). maxPointSize 캡. 실기기 검증 Phase 7 verify에 포함 |
| WebGL 컨텍스트 손실(iOS Safari 제한·메모리 압박) 시 화면 정지 — R3F 자동 복구 없음 | MEDIUM | 단일 Canvas 원칙 + ContextLossGuard(contextlost/restored + key 리마운트 + 재연결 오버레이) + dispose/frameloop 수명주기 |
| R3F 안티패턴(매 프레임 setState)으로 리렌더가 렌더 루프 잠식 | MEDIUM | 연속 값은 ref+useFrame+damp 전용, getState() transient read, r3f-perf 상시 감시 — 02-decisions의 성능 규율 체크리스트 |
| React 19.3 출시 시 R3F 9.6 peer 캡(<19.3) 위반 | LOW | react ~19.2 + lockfile 고정, v1 기간 3D 스택 업그레이드 동결, 3D 코드 scenes/ 격리 |
| Safari/Firefox 사생활 모드 IndexedDB 쿼크 (API 존재하나 open 실패/세션 휘발) | LOW | 실제 db.open() 프로브 판정 + StorageDriver 완전 동등(공유 계약 테스트) + persist() 백오프 + Playwright IDB 차단 컨텍스트 검증 |

## 구현 노트 (계획 대비 변경 사항)

구현 과정에서 다음 항목이 계획과 다르게 확정됐다 (모두 보수적 안정성 원칙 유지):

| 항목 | 계획 | 실제 | 사유 |
|------|------|------|------|
| @vitejs/plugin-react | 최신 | ^5 핀 | v6는 Vite 8 요구 — Vite 7 유지 |
| 원경 별 | drei Stars | GalaxyBackdrop (밀도 함수 샘플 1드로콜) | 실제 은하 형상(원반·덩어리) 재현 |
| 파츠 매니페스트 위치 | src/data/parts.manifest.ts | src/assets/parts/partsManifest.ts | 생성 컴포넌트와 동일 위치 응집 |
| 빌드 스크립트 | scripts/build-parts.ts | scripts/build-parts.mjs | tsx 의존성 회피 (Node 직접 실행) |
| 단위 커버리지 게이트 | 전체 80% | 로직 계층(engine 90 / store·persistence 80) | scenes(WebGL)·ui(프레젠테이션)는 4계층 전략대로 Playwright E2E가 상태 단언으로 커버 — jsdom에 WebGL이 없어 전체 80%는 성립 불가 (리스크 실사 #6) |
| CPU 스로틀 자동 하향 실측 | Phase 7 verify | 미실측 | PerformanceMonitor decline → 단계 하향 로직 구현·수동 품질 전환은 브라우저 확인. 실기기/스로틀 실측은 출시 전 수동 체크 항목으로 남김 |
| 모바일 실기기 검증 | 실기기 | 375px 뷰포트 에뮬레이션 | 바텀 시트·터치 타겟 확인. 실기기는 출시 전 수동 체크 항목 |

## 테스트 전략 (4계층)

| 계층 | 대상 | 도구 | 비고 |
|------|------|------|------|
| 1. 엔진 (커버리지 본체) | 생성/해시/PRNG/희귀도/스토어 | vitest node + fast-check + 골든 마스터 | jsdom에 WebGL이 없으므로 순수 TS 분리가 전제조건 |
| 2. 씬 그래프 | 3D 구조/인터랙션 | @react-three/test-renderer | experimental — 보조용 |
| 3. 2D UI | 도감/카드/패널 | jsdom + testing-library | AlienCard는 순수 렌더 → 스냅샷 가능 |
| 4. E2E | 코어 루프 + 복원 + 폴백 | Playwright (SwiftShader) | 픽셀 비교 대신 상태(IndexedDB·DOM) 단언 |

---

# Implementation Plan: G-b-7 항성계 씬 통합 + 퍼스펙티브 뷰 우주선 (결정 41)

**Status:** Approved (2026-06-12 — 액션 리네임 `openPerspective`/`returnToShip` 채택 확정)
**Created:** 2026-06-12
**Decisions:** 결정 41 (41-a ~ 41-g, 02-decisions.md)
**Backlog:** 04-backlog.md G-b (step 7)

## Spec Summary

씬 스왑 없이 은하 배경을 유지한 채 항성계를 띄운다. `kind:'system'`을 제거하고 항성계 오브젝트를 은하 좌표계에 직접 배치 — "은하 속에 실제로 있다"는 감각. 퍼스펙티브(3인칭) 뷰에 우주선 모델을 렌더하고 우주선 중심으로 공전한다.

- **우주선 뷰(ship)** — 1인칭 함교. 현재 별 구체 + 행성 + 은하 배경이 한 좌표계에. 행성 클릭 → 탐사.
- **퍼스펙티브 뷰(perspective)** — 3인칭. 우주선 모델 + 우주선 중심 공전. 별 클릭 → 항행 목적지 선택.
- **워프** — 진입/이탈 대칭(목표 조준 후 동일 리그), 뷰별 발동 시퀀스, 도착 시 포인트→구체 자연 확대.

## Codebase Analysis (현황 → 통합 후)

| 영역 | 현재 | 통합 후 |
|------|------|---------|
| 상태머신 | `galaxy{ship\|map}` / `warping` / `system` (4상태) | `galaxy{ship\|perspective}` / `warping` (3상태) |
| 라우터 | `SceneRouter` switch — `system`→`SystemScene` 별도 트리 | `case 'system'` 제거, GalaxyScene 단일 |
| 항성계 렌더 | `SystemScene` 플로팅 원점(0,0,0): 별 r5, 행성 궤도 10~98, 카메라 10~180 | GalaxyScene 안 `<group position={starWorldPos}>` 오프셋 |
| 진입 연출 | `SystemEntryTransition`(1.45× 줌인) | 삭제 → 워프 중 거리 임계 페이드인 |
| 현재 위치 표지 | `CurrentStarBeacon`(map·warping) | perspective는 `SpaceshipModel` 대체, beacon은 warping만 |
| 카메라 | `ShipCameraRig` / `CameraRig`(map) / `WarpCameraRig` | + `PerspectiveCameraRig`(우주선 중심 공전) |

**`scene.kind`/`view` 의존 전수:** 스토어(`types.ts`, `createGameStore.ts` 8곳, 테스트 3종) · 씬(`SceneRouter`, `GalaxyScene`, `SystemScene`, `WarpCameraRig`, `useStarPicking`) · HUD(`NavigationControls`, `StarInfoPanel`, `PlanetPanel`, `ShipFrame`, `SystemReadout`) · E2E(`coreLoop.spec.ts`).

**불변 보장:** GEN_VERSION·골든·저장 포맷·engine/ 무관. `planetOrbitPosition`·`orbitRadiusOf` 수식은 오프셋 그룹 덕에 불변. 워프 타임라인 상수 불변.

## Implementation Plan

> 단계 의존이 강해 순서 고정. 각 Phase 끝 게이트(`typecheck && lint && test`) 통과 후 다음. 전체 완료 후 `test:coverage && build && test:e2e`.

### Phase 1 — 상태 모델 붕괴 [M] (backlog step 1)

상태머신을 먼저 갈아끼워 이후 렌더 분기의 기반을 만든다. TDD: 스토어 테스트를 신규 모델로 먼저 고치고(RED) 구현(GREEN).

- [ ] `store/types.ts`: `GalaxyViewMode = 'ship' | 'perspective'`. 유니온에서 `{kind:'system'}` 제거. `enterCurrentSystem`/`backToGalaxy` 제거, `openGalaxyMap`/`closeGalaxyMap` → `openPerspective`/`returnToShip` 리네임.
- [ ] `createGameStore.ts`: 초기 `scene` = `{kind:'galaxy', view:'ship'}`. `onWarpComplete` → ship. `selectPlanet`/`explore` 가드 `kind==='system'` → `view==='ship'`(행성 소속은 `currentStarId` 기준). `warpTo`/`selectStar` 가드(`kind==='galaxy'`) 유지.
- [ ] `SceneRouter.tsx`: `case 'system'` 제거.
- [ ] 스토어 테스트 갱신: `createGameStore.test.ts`·`explore.test.ts`·`hydration.test.ts`.

**Verify:** `typecheck && test -- store` green. 앱은 일시적으로 행성 미표시(정상 — Phase 2에서 복원).

### Phase 2 — 렌더 통합 + 카메라 프레이밍 [L] (steps 2, 5)

- [ ] `GalaxyScene.tsx`: `view==='ship'`(또는 `warping`) + `currentStarId` 존재 시 `<group position={shipFocus}>`에 `StarSurface`·`pointLight`·`ambientLight`·`Planet`/`OrbitRing`·`SystemBackdropStars`·`LifeSignalWaves` 렌더.
- [ ] `ShipCameraRig.tsx`: 정박 거리 시스템 프레이밍 값(~180u)으로 상향. 회전 전용 유지. 외곽 행성 프레임 인입 실측(41-g 리스크).
- [ ] `SystemScene.tsx` 삭제 + import 경로 이전.
- [ ] `PlanetCalloutProjector.tsx`: `computeWorldPosition`에 `+ starWorldPosition(seed, currentStarId)`.

**Verify:** 우주선 뷰에서 별 구체 + 공전 행성 + 은하 배경 동시 표시, 행성 클릭→패널, 콜아웃 추적. preview 스크린샷.

### Phase 3 — 워프↔항성계 연속 전환 [M] (steps 3, 4)

- [ ] `GalaxyStarField.tsx`: `currentStarId` 포인트만 카메라 거리 임계(≈600u)에서 알파/size 역페이드(어트리뷰트, 조건부 needsUpdate), 멀어지면 복원.
- [ ] `WarpCameraRig`/GalaxyScene: 워프 종반 거리 임계에서 `StarSurface` 페이드인(도착 별 `scene.to` 기준).
- [ ] `SystemEntryTransition.tsx` 삭제.

**Verify:** 워프 도착에서 점→구체 매끄러운 확대, 팝인 없음. preview 워프 1회 관찰.

### Phase 4 — 퍼스펙티브 뷰 + 우주선 모델 + 이탈 워프 [L] (steps 6, 7, 8)

- [ ] `view: 'map'` → `'perspective'` 전파. map 전용 `DistantGalaxies`/`GalaxyNebula`/`JourneyPath` 마운트 조건을 perspective로.
- [ ] `scenes/galaxy/SpaceshipModel.tsx`(신규): 기하 플레이스홀더 우주선, `currentStarId` 은하 좌표 배치, perspective 한정. perspective에서 `CurrentStarBeacon` 대체.
- [ ] `PerspectiveCameraRig.tsx`(신규 or `CameraRig` 재사용): focus=우주선, 우주선 중심 공전, 거리 재설정.
- [ ] 이탈 워프 + 뷰별 시퀀스(41-f): ① ship — 목표 방향 회전 후 `warpTo`. ② perspective — `returnToShip` 컷 → 회전 → `warpTo`. 회전은 ref+useFrame(철칙 6).

**Verify:** perspective에서 우주선 + 우주선 중심 공전. 두 뷰 항행이 시퀀스대로(perspective는 1인칭 컷 후 워프). preview 스크린샷 2종.

### Phase 5 — 콜아웃·패널 재연결 + 테스트 [M] (steps 9, 10)

- [ ] `SystemReadout.tsx`: 트리거 `scene.kind==='system'` → 워프 도착(ship 전이). `StarInfoPanel`/`PlanetPanel`/`NavigationControls` 버튼 레이블·가드 신규 뷰 모델로.
- [ ] `coreLoop.spec.ts`: `scene.starId` → `currentStarId`, 이탈→지도→항행 경로를 신규 레이블로. LIFE1 시드·코어 루프 골격 유지(시나리오만 조정).
- [ ] 스토어 테스트 최종 + 신규 액션(perspective 전환·이탈 워프) 커버.

**Verify (전체 게이트):** `typecheck && lint && test && test:coverage && build && test:e2e` 전부 green.

## Dependencies

```
Phase 1 (상태) → Phase 2 (렌더) → Phase 3 (워프 연속)
                       ↓
                  Phase 4 (퍼스펙티브·이탈워프) → Phase 5 (재연결·테스트)
```

## Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| **우주선 뷰 프레이밍** — 근접 정박(37u)으로 시스템(지름 200u) 못 담음 | HIGH | Phase 2 정박 거리 ~180u 상향 + 실측, 회전 전용 유지, 확정 전 사용자 확인 |
| **기존 플레이어 우주 깨짐** — 전이 누락 시 진입 불가 | HIGH | Phase 1 TDD, 전이 가드 전수 테스트. GEN_VERSION 무관이라 저장 안전 |
| **E2E 경로 단절** — 레이블·전환 변경 | MEDIUM | Phase 5 시나리오 동기 갱신, LIFE1·코어 루프 골격 유지 |
| **포인트 크로스페이드 깜빡임** | MEDIUM | 거리 히스테리시스 + 조건부 needsUpdate, 워프 종반에만 활성 |
| **콜아웃 오프셋 누락** | LOW | Phase 2 단일 지점 `+ starWorldPos` 수정 + preview 확인 |

## Estimated Complexity: **L** — 5 phases, ~10 파일 수정 + 2 신규(SpaceshipModel·PerspectiveCameraRig) + 3 삭제(SystemScene·SystemEntryTransition + map 별칭)

## Open Questions (확정 필요)

- [ ] 액션 리네임 `openGalaxyMap`/`closeGalaxyMap` → `openPerspective`/`returnToShip` 채택 여부 (API 명확성 vs diff 최소).
- [ ] HUD 버튼 문구 — "항성계 이탈"/"은하 지도"/"항성계 진입"의 신규 뷰 모델 재명명.
- [ ] 우주선 뷰 정박 거리(~180u)가 "함교에서 내다보는" 감각과 맞는지 — Phase 2 실측 후 결정.
