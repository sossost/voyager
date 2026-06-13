# Backlog: v1 이후 개선 항목

**Created:** 2026-06-11 (v1 완료 + 코드 리뷰 직후)

## A. 코드 리뷰 LOW 메모 (검증 생략된 경미 항목 — 빠른 개선 후보)

~~1. **`nextToastId` 모듈 레벨 가변 변수**~~ — ✅ 완료 (2026-06-12): 팩토리 클로저 안으로 이동.
~~2. **`__gameStore` 노출 가드 불일치**~~ — ✅ 완료 (2026-06-12): `import.meta.env.DEV` 교체 + Window 타입 보강.
~~3. **CameraRig 카메라/타깃 비동기**~~ — ✅ 완료 (2026-06-12): OrbitControls ref 추가, 동일 useEffect에서 일괄 적용.
~~4. **매직 넘버**~~ — ✅ 완료 (2026-06-12): `INT32_MAX` 상수화, SelectedStarMarker 링 반지름 상수화.
5. **ScanSequence 셀렉터 분리** — ScanSequence가 이미 모듈 최상단에 분리되어 있어 실질적 문제 없음 — 해소됨.
~~6. **WarpFlashOverlay 암묵적 falsy**~~ — ✅ 완료 (2026-06-12): `isWarping === false` 명시적 표현.

> 해소됨 (결정 22): GalaxyBackdrop uPixelRatio 지연 갱신(useFrame 전환), 구형 페이드 기하 불일치(페이드 자체 제거).

## B. 출시 전 수동 체크 (자동화 불가 — 03-plan 구현 노트 참조)

- [ ] 실기기 모바일(iOS Safari 포함)에서 코어 루프 완주 + 터치 조작감
- [ ] CPU 4x 스로틀에서 PerformanceMonitor 자동 하향 발동·30fps 유지 실측
- [ ] Safari 사생활 모드 실브라우저에서 메모리 폴백 확인

## C. v2 후보 (01-spec Out of Scope에서)

- 서버/계정/도감 온라인 공유 (StorageDriver 인터페이스 + saveVersion 축이 확장 지점)
- 변이체(샤이니) 시스템 — SpeciesArchetype 데이터 구조에 여지 있음
- 라이트 자원 관리(연료), 사운드/BGM, 포획 미니게임
- 우주 좌표 딥링크 (?seed=&star= 로 특정 별 공유)

## D. 콘텐츠 잔여 작업

- [ ] 실아트 2차: eyes/mouth/appendage/pattern 슬롯 변형 교체 (body 12종은 1차 완료) — `npm run build:parts`
- [ ] 60종 로어 텍스트 작성 (현재 스텁) — `src/data/species/species.json`의 `lore` 필드만 수정 (분포 무관 → GEN_VERSION 불필요, 단 골든 스냅샷은 갱신됨)
- [ ] 별/행성/외계인 명명 톤 다듬기 (01-spec Open Questions)

## E. 은하 비주얼 2차 후보 (2026-06-11, 1차 패스 머지 직후 피드백)

1. ~~**배경 은하**~~ — ✅ 완료 (2026-06-11, 결정 24): `scenes/shared/DistantGalaxies` 절차 스머지 빌보드 16장, 은하·항성계 씬 공용.
2. ~~**워프 연출 다듬기**~~ — ✅ 완료 (2026-06-11, 결정 26): 워프 카메라 리그(현 위치 → 목표 응시 → 돌진) + 가산 블렌딩 혜성형 트레일 2층(75+36) + 점화 시차 + 코어 플레어 + FOV 큐빅 서지 + 플래시 청백 틴트, 총 ~4.3s로 연장. 타임라인 구조 불변.
3. **쌍성계(다중성계)** — 현재 단일 항성만 생성. 쌍성/삼중성 도입은 출력 분포 변경 = **GEN_VERSION 3** + 별 스트림 append-only 규칙 안에서 동반성 draw 설계 필요. 항성계 씬·StarInfoPanel·궤도 연출도 연동. 엔진 변경 — `/yc:brainstorm` 선행 권장.
4. ~~**시점 전환: 우주선 뷰 ↔ 은하 뷰**~~ — ✅ 완료 (2026-06-11, 결정 34): SceneState galaxy에 view 축(ship/map). 우주선 뷰 = 현재 별 고정(시뮬레이션 기본), 은하 전도 = 은하 중심 고정(목적지 선택). 워프는 발동 즉시 우주선 포즈로 컷.
5. **항성계 이탈 워프 연출** — 항성계 → 우주선 뷰 전환이 현재 즉시 스왑이라 진입(워프 도착) 연출과 비대칭. 결정 34로 우주선 뷰가 생겨 이탈 연출을 얹을 자리는 마련됨.
6. ~~**항성계 배경 별**~~ — ✅ 완료 (2026-06-11, 결정 25·28): `SystemStarfield` 균일 별밭(스텔라리스식) + `SystemBackdropStars` 실제 이웃 별 셸 투영. 은하수 띠(GalacticBand)는 시도 후 기각 — 결정 28.

## F. 비주얼 3차 — 천체 디테일 + 위치 가시화 (2026-06-11 합의)

> 둘 다 렌더 전용 — GEN_VERSION·저장 포맷 무관. 기존 결정론 필드(paletteSeed/kind/radius/hasLife/spectral)만 사용, 새 엔진 draw 없음. 작업 전 결정 22~28(비주얼 1·2차 패턴·기각 이력)과 사용자 취향 메모(블러 구름·미세 파티클 뭉침 기각, 게임 미학 우선, 빛은 가산) 숙지.

### F-1. 항성·행성 디테일 — ✅ 완료 (2026-06-11, 결정 29)

- ~~**항성**~~ — `StarSurface`: 절차 셰이더 입상반(끓는 표면) + 림 다크닝 + 가산 빌보드 코로나(호흡 맥동). SPECTRAL_RENDER 색, 입상반 백색이 Bloom을 트리거.
- ~~**행성**~~ — `planetTexture.ts`: paletteSeed 결정론 등장방형 베이크 (암석 = fbm 고도 밴드 + 극관, 생명 = 바다/대륙 + 구름층, 가스 = 뒤튼 위도 밴드 + 폭풍 반점). 자전 + planetSegments 프리셋 연결. 프레넬 대기 림은 실측 "막" 피드백으로 기각(결정 31) — 행성 주변 부가 구는 금지 패턴.

### F-2. 방문/현재 위치 가시화 — ✅ 기본·토글 완료 (2026-06-11, 결정 30)

- ~~**기본 ① 현재 위치 비콘**~~ — `CurrentStarBeacon`: 호박색 펄스 링 + 소나 확장 링 2개, FOV 역산 화면 고정 크기(17px) 클램프.
- ~~**기본 ② 방문 별 발광 틴트**~~ — `GalaxyStarField` starColor/size 어트리뷰트 갱신(청록 60% + 밝기 1.45× + 크기 1.18×). `VisitedStarMarkers` 삭제 — 512 캡 해소.
- ~~**토글 ③ 여정 경로선**~~ — `JourneyPath`: visitedAt 오름차순 Set 순서 폴리라인 + 정점 색 페이드, HUD 토글(기본 off).
- ~~**후순위 ④ 오프스크린 화살표**~~ — ✅ 완료 (2026-06-12): `CurrentStarArrowProjector` + `CurrentStarArrow` — 갤럭시 뷰에서 현재 별이 화면 밖이면 가장자리에 호박색 삼각형 화살표, useFrame camera.project() 기반 (DOM HUD, React 상태 없음).

## G. 로드맵 4차 — 우주선 뷰 고도화 + 천체 다양화 (2026-06-12 피드백, PR #3 머지 직후)

> **컨셉 확정 (2026-06-12 업데이트):**
> - **우주선 뷰(1인칭)** — 항상 우주선 내부 시점. 은하·항성계가 창밖으로 보임. 기본 시점.
> - **퍼스펙티브 뷰(3인칭)** — 은하 공간 안에 우주선 모델이 실제로 렌더. 카메라가 우주선 중심 공전. 은하 항법 맵 역할.
> - 두 뷰 모두 동일한 은하 씬 위에서 동작 — 씬 스왑 없음 (결정 41).
> 결정 28(물리 충실 기각)·31(행성 부가 구 금지) 숙지.

### G-a. 빠른 개선 (렌더/DOM 전용 — GEN_VERSION 무관)

1. ~~**서비스 이름 확정: Voyager**~~ — ✅ 완료 (2026-06-12): 표기 전부 "Voyager"로 (TopBar·부트 3종·index.html·README·스펙 문서 헤더·CLAUDE.md). Dexie DB명(`stellar-voyage`)·디렉터리·package.json name은 식별자라 유지.
2. ~~**우주선 뷰 배경 정리**~~ — ✅ 완료 (2026-06-12): SystemStarfield를 `shared/DecorativeStarfield`(radius/center 주입)로 일반화. 전도 = DistantGalaxies, 우주선 뷰·워프 = 정박 별 중심 균일 별밭(반경 12,000 — 은하 스팬 밖 + far 안). 실제 은하 별은 그대로.
3. ~~**생명체 행성 통신 파동**~~ — ✅ 완료 (2026-06-12): `LifeSignalWaves` — hasLife 행성 그룹 자식 빌보드 링 2개(위상 0.5 스태거), 주기 3.4s, 청록(#5eead4) 가산 페이드. 발생 반경 1.4×라 행성 실루엣을 가리지 않는다 (클릭 간섭 없음).
4. ~~**항성계 진입 시 항성 정보 표시**~~ — ✅ 완료 (2026-06-12): `SystemReadout` 함교 리드아웃 — 진입(부트 포함) 직후 상단 중앙에 이름·분광형이 떠올랐다 ~5s 후 소멸. 수명은 JS 타이머·페이드는 CSS(reduced-motion 시 정적 표시 후 소멸). 클릭 콜아웃 안은 선택 상태 추가가 필요해 보류.
5. ~~**행성 패널도 홀로그램 콜아웃 통일**~~ — ✅ 완료 (2026-06-12): `shared/CalloutProjector`(selector + computeWorldPosition 주입)로 일반화, 별/행성 공용. 행성 추적은 ref 레지스트리 대신 궤도 수식 추출(`planetOrbitPosition` — 렌더와 단일 소스)로 재계산. CSS `.star-callout*` → `.callout*`, 모바일 바텀 시트 제거.

### G-b. 중형 — 시점·연출 재작업

6. ~~**우주선 뷰 은하 측면 광원감**~~ — ✅ 완료 (2026-06-12, 결정 38): `ShipViewGalaxyGlow` — 정박 별 기준 방위각별 sectorDensity 선적분을 실린더에 구운 원반 밴드 + 은하 중심 코어 글로우 빌보드(각크기 상한 0.22). 텍스처+가산 원칙 준수, 점·입자 없음. 우주선 뷰·워프 전용 마운트.
7. ~~**항성계 씬 통합 + 퍼스펙티브 뷰 우주선**~~ — ✅ 완료 (2026-06-12, 결정 41, Phase 1~5): `kind:'system'` 제거 → 은하 씬 단일화. 항성계를 은하 좌표 오프셋 그룹에 직접 렌더(`CurrentSystem`), 워프 도착 포인트↔구체 크로스페이드(`starCrossfade`), 퍼스펙티브 3인칭에 항성계 + 우주선 모델(`SpaceshipModel`), 뷰별 워프 정렬(1인칭 보장). 피드백 반영: 워프 도착 확대 연출(`pendingArrival`→ShipCameraRig 줌인), 퍼스펙티브에도 항성계 렌더, 우주선 궤도면 위로 띄움·축소. `SystemScene`/`SystemEntryTransition`/`SystemBackdropStars` 삭제. 렌더+상태 전용 — GEN_VERSION 무관.

   <details><summary>원래 계획 (참고용)</summary>

   **컨셉:**
   - `SceneState.kind: 'system'` 삭제 → 은하 씬 단일화. 항성계 오브젝트를 은하 좌표계에 직접 배치.
   - `view: 'ship'` (1인칭 우주선 뷰) / `view: 'perspective'` (3인칭, 우주선 모델 렌더 + 우주선 중심 공전).
   - E-5 이탈 워프: 목표 별 조준 후 진입 워프 재사용. 뷰별 워프 진입 시퀀스 분리.

   **워프 발동 시퀀스 (뷰별):**
   - **우주선 뷰에서**: 카메라를 목표 별 방향으로 부드럽게 회전 → 정렬 완료 후 워프 주입
   - **퍼스펙티브 뷰에서**: 즉시 우주선 뷰로 컷 전환 → 카메라 목표 별 방향 회전 → 워프 주입

   **구현 단계 (순서 의존)**

   | # | 작업 | 핵심 파일 | 최소 모델 |
   |---|------|-----------|-----------|
   | 1 | `SceneState` 리팩터 — `kind: 'system'` 제거, `view` 타입에 `'perspective'` 추가, 스토어·액션·타입 일괄 수정 | `store/types.ts`, `createGameStore.ts`, `SceneRouter.tsx` | Haiku |
   | 2 | `SystemScene` → `GalaxyScene` 통합 — 별 구체·행성을 현재 별 은하 좌표에 렌더 | `GalaxyScene.tsx`, `SystemScene.tsx`(삭제), `StarSurface`, `Planet`, `OrbitRing` | Sonnet |
   | 3 | 포인트 스프라이트 크로스페이드 — `GalaxyStarField`에서 `currentStarId` 포인트 alpha 관리 (카메라 거리 ≈ 600 임계값) | `GalaxyStarField.tsx` | Sonnet |
   | 4 | 워프 진입 스케일 전환 — `WarpCameraRig` 내 거리 기반 StarSurface 페이드인 트리거, `SystemEntryTransition` 삭제 | `WarpCameraRig.tsx`, `SystemEntryTransition.tsx`(삭제) | Sonnet |
   | 5 | 카메라 리그 전환 — 정박 시 별 중심 공전 `CameraRig` 마운트 | `GalaxyScene.tsx` | Haiku |
   | 6 | 이탈 워프 + 뷰별 시퀀스 — ① 우주선 뷰: 목표 별 방향 회전 애니 → 워프. ② 퍼스펙티브 뷰: 우주선 뷰 컷 → 회전 → 워프. | `createGameStore.ts`, `WarpCameraRig.tsx`, `HudLayer.tsx` | Sonnet |
   | 7 | 맵→퍼스펙티브 리네임 + 시스템 오브젝트 숨김 처리 | `GalaxyScene.tsx`, HUD 버튼 레이블 | Haiku |
   | 8 | 퍼스펙티브 뷰 우주선 모델 — `currentStarId` 은하 좌표에 기하 도형 우주선 렌더. `PerspectiveCameraRig`(우주선 중심 공전). `CurrentStarBeacon` 대체. 워프 인터랙션 유지. | `scenes/galaxy/SpaceshipModel.tsx`(신규), `PerspectiveCameraRig.tsx`(신규 or MapCameraRig 수정) | Sonnet |
   | 9 | 콜아웃·패널 재연결 | `PlanetCalloutProjector.tsx`, `SystemReadout.tsx` | Sonnet |
   | 10 | 테스트 갱신 — E2E(씬 전환·뷰 전환 경로), 스토어 단위 테스트 | `tests/e2e/`, `store/*.test.ts` | Sonnet |

   > `/yc:plan` 실행 전 현재 브랜치 PR 머지 선행 필요.

   </details>

### G-c. 엔진 확장 — 생성 변경 (브레인스토밍 선행)

~~10. **Sol 고정 시작 항성계 — 태양계 베이스**~~ — ✅ 완료 (2026-06-12, G-c-10)

    **컨셉:** 시작 항성계를 항상 태양계로 고정. Sol은 RNG 스트림에서 완전 분리된 예외 노드 — 다른 별들의 생성 출력 불변, GEN_VERSION 불필요.

    **범위:**
    - 별 이름 "태양" (G2V), 행성 수성~해왕성 (이름 + 분광형 + 행성 수만 실제 반영, 궤도 반경은 게임 스케일 자유)
    - Sol 위치: 시드 무관 고정 은하 좌표
    - 지구(`isHomeWorld: true`): `hasLife=true`지만 외계 생명체 없음 — 유일한 예외. 탐사 시 "인류의 고향" 메시지.
    - 나머지 우주: 기존 절차 생성 그대로

    **핵심 결정:**
    - `planetsOf(seed, SOL_STAR_ID)` → `SOLAR_SYSTEM_PLANETS` 상수 반환 (RNG 미사용)
    - `alienAt()`: `planet.isHomeWorld === true`면 `null` 반환
    - `Planet` 타입에 `isHomeWorld?: boolean` 추가
    - LIFE1 E2E 테스트 재작성 필요 — Sol 내 비지구 행성 or 인근 별로 에픽 종족 이동

    **GEN_VERSION:** 불필요 (RNG 스트림 무변경, SOL만 상수 분기)  
    **선행 필요:** `/yc:brainstorm` (LIFE1 처리 방식·지구 UX 확정)

8. **위성(달)** — 행성 주위를 도는 위성. 위성 전용 rngFor 스트림(`'moon', planetId`)으로 격리하면 기존 출력 불변 — **GEN_VERSION 불필요**(스트림 격리 원칙). 렌더는 행성 그룹 자식 + 미니 궤도. 탐사 대상 여부(게임플레이 확장)는 별도 결정.
9. **이색 천체: 블랙홀·성운·펄서 등** — 별 분포·종류 변경 = **GEN_VERSION 4** + 골든 재생성. 표현(블랙홀 렌즈 효과·펄서 점멸·성운 볼류메트릭)과 게임플레이(탐사 보상? 항행 위험?)가 모두 열려 있음 — `/yc:brainstorm` 선행 필수. 우선순위는 위성·뷰 통일 뒤로.

## H. UX 버그 및 인터랙션 개선 (2026-06-12 피드백)

> 결정 41(씬 통합·퍼스펙티브 뷰) 구현 이후 발견된 버그·UX 이슈. 렌더/UI 전용 — GEN_VERSION 무관.

1. ~~**[버그] 우주선 뷰에서 항성 정보 패널 "함교 복귀" 버튼 오작동**~~ — ✅ 완료 (2026-06-12): `StarInfoPanel`에서 `scene.view === 'perspective'` 조건 가드 — 우주선 뷰에선 버튼 미표시.

2. ~~**[버그] 워프 발동 시 현재 항성이 화면 중앙에 돌출**~~ — ✅ 완료 (2026-06-12): `CurrentSystem`에서 `scene.kind === 'warping'` 동안 `StarSurface` 렌더 중단. 포인트 스프라이트가 시각 연속성, 도착 후 `WarpFlashOverlay` 피크에 crossfade로 자연 fade-in.

3. ~~**[성능/LOD] 은하뷰 축소 시 항성계 오브젝트 지속 렌더**~~ — ✅ 완료 (2026-06-12): `CurrentSystem` 내부 `useFrame`으로 카메라-별 거리 감시, `SYSTEM_LOD_DISTANCE = FAR×2 = 1300u` 초과 시 `group.visible = false` → 행성·궤도링 드로콜 제거.

4. ~~**[UX] 퍼스펙티브 뷰 우주선 위치·방향 불일치**~~ — ✅ 완료 (2026-06-12): `SpaceshipModel` 오프셋 `Y:18(only)` → `Y:22, Z:68` — ShipCameraRig 정박 방향(Y:42, Z:132) 축약, 별과 시각적 분리감.

6. ~~**[UX/비주얼] 은하뷰 우주선(현재 위치) 가시성 개선**~~ — ✅ 완료 (2026-06-12): 엔진 청록(`#7cf2e0`) 가산 블렌딩 헤일로 링(`RingGeometry` inner3.2/outer3.6) + 빌보드 + 1.8 rad/s 펄스(0.18~0.45 opacity). `CurrentStarBeacon`(호박색, 2.4s 소나)과 색·리듬 차별화.

5. **[비주얼] 은하뷰 ↔ 우주선뷰 전환 효과 — 홀로그램 투영 표현** — 현재 즉시(cut) 전환이라 어색함. 은하뷰 컨셉이 "함교에서 쏘는 홀로그램"임을 감안, 전환 시 홀로그램 펼침/접기 느낌의 연출 필요. 성능 및 구현 복잡도 우려 있으므로 **`/yc:brainstorm` 선행 권장** — 후보 방향:
   - 스캔라인 디졸브: 화면을 수평으로 픽셀 스캔하며 씬이 나타나거나 사라짐 (포스트 셰이더 단순)
   - 홀로그램 플리커: 전환 시 청색 틴트 + 노이즈 글리치 짧게 발생 (CSS mix-blend + keyframe)
   - 줌 인·아웃 컷: 은하뷰 진입 시 카메라가 멀리서 줌인되며 홀로그램 격자가 소환되는 느낌 (R3F lerp)
   - 성능 우선이면 CSS fade + 홀로그램 테두리 글로우만으로도 충분할 수 있음

## I. 온보딩 및 조작성 개선 (2026-06-12 피드백)

### ~~I-1. 컨텍스트 힌트 온보딩 (튜토리얼 대체)~~ — ✅ 완료 (2026-06-12)

> 모달 튜토리얼 대신 행동 유발 지점에 once-only 힌트. `Profile`에 `seenHints: Set<HintKey>` 필드 추가 — 저장 포맷 변경이지만 기존 플레이어는 빈 Set으로 마이그레이션 가능. GEN_VERSION 무관.

- **힌트 트리거 3종 (우선순위순):**
  1. 첫 진입 → `"별을 클릭해 탐색하세요"` — 3s 후 자동 소멸
  2. 첫 별 선택(콜아웃 열림) → `"워프로 이동할 수 있습니다"` — 워프 버튼 인접 표시
  3. 첫 생명체 행성 발견 → `"탐사 버튼으로 생명체를 찾아보세요"` — 탐사 버튼 인접 표시
- 힌트 UI: 작은 말풍선 + 페이드 아웃, `reduced-motion` 시 즉시 표시 후 소멸
- `seenHints`에 기록 후 재표시 안 함 — 재방문자 방해 없음
- `persist()` 단일 쓰기 경로 준수

### ~~I-2. 핵심 액션 버튼 추가 (마우스 의존도 감소)~~ — ✅ 완료 (2026-06-12)

> OrbitControls 터치 지원(드래그 패닝·핀치줌)은 이미 있음. 부족한 부분만 버튼으로 보강. 백로그 B 모바일 실측 후 실제 불편한 부분을 확인하고 우선순위 조정 권장.

- **현재 위치 복귀 버튼** — 카메라를 현재 항성으로 즉시 이동. HUD 고정 위치. 가장 실용적이고 구현 비용 최소.
- **줌 +/- 버튼** — 모바일 핀치 대체용. 스텝 줌(OrbitControls `dollyIn/Out` 호출). 데스크탑에선 숨김 처리 가능.
- *(보류)* 패닝·회전 버튼 — OrbitControls 터치가 충분한지 실측 후 결정.

## J. UI 퀄리티 패스 — SF 함교 콘솔 + HUD 정제 (2026-06-12 피드백)

> ~~레퍼런스: Mass Effect / Starfield 함교 콘솔. 결정 35(SF console 스킨) 기반 위에서 전체 HUD를 "함교에서 우주를 바라본다"는 컨셉으로 통일. DOM 레이어 전용 — GEN_VERSION·저장 포맷 무관. `/yc:brainstorm` 없이 바로 구현 가능하지만 레이아웃 변경 폭이 크므로 **디자인 시안 먼저 확정 권장**.~~
>
> ✅ 완료 (2026-06-13, J 섹션 전체)

### ~~J-1. 우주선 뷰 — 캐노피 프레임 + 함교 분위기 강화~~ — ✅ 완료

- ~~**캐노피 오버레이**~~ — ShipFrame에 측면 패널 라인 스팬(`.ship-frame-side`) 추가. 코너 브래킷에 `::before/::after` 틱 마크.
- ~~**주변부 비네팅**~~ — 청색 틴트 이중 그라디언트(`rgba(5,8,28)·rgba(2,5,18)`) 적용.
- **HUD 요소 엣지 정렬** — 기존 레이아웃(좌하단 네비, 우상단 패널)이 이미 Mass Effect 클러스터 구조 — 변경 불필요.
- ~~**하단 콘솔 스캔라인/그리드 질감**~~ — `repeating-linear-gradient 90deg` 세로선 그리드를 `::after` 배경에 합성.

### ~~J-2. 공통 HUD — 버튼·패널 정제~~ — ✅ 완료

- ~~**버튼 계층 정리**~~ — `.hud-button-nav` 추가(border 28%, text-dim, weight 500). NavigationControls 뷰 전환 버튼 전체 적용.
- ~~**콜아웃 패널 타이포·여백**~~ — `hud-fact gap 0.6rem`, `line-height 1.45`, `dt 0.8rem`, `dd 0.86rem/45% holo`.
- ~~**토스트 위치**~~ — `bottom: 6.5rem` (nav controls + 콘솔 밴드 위 safe zone).
- **퍼스펙티브 뷰 HUD 레이더 전환** — 검토 결과 현재 ShipFrame이 이미 ship/warping 전용이라 별도 작업 불필요.
