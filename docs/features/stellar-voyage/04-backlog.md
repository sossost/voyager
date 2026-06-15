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
3. ~~**🔝 쌍성계(다중성계)**~~ — ✅ 완료 (2026-06-15, GEN_VERSION 4) → `docs/features/binary-stars/`. **A-사실성 강화**: 동반성은 주성 스트림 뒤 append-only draw(`drawCompanions` — multiplicity→spectral/separation/eccentricity/phase, 은하 맵 노드 1개 유지), 쌍성+삼중성(계층형)·다중 ~45%(55/33/12)·동반성 분광 주성 이하 제약. 렌더: `scenes/system/multiplicity.ts`(질량중심 타원 공전·circumbinary 판정·질량 룩업) + `CurrentSystem` 별 N개·광원 N개·`planetCenter` 그룹(circumbinary↔주성 추종). `StarInfoPanel`·`SystemReadout`에 등급+구성 분광형('삼중성계 · G + G + G'). `planetsOf` 무변경 → 행성/외계 골든 값 보존(diff는 별 신규 필드만). Sol 단일성·LIFE1 무영향(E2E green). 골든 재생성·`sectors.test.ts`·`multiplicity.test.ts` 추가.
4. ~~**시점 전환: 우주선 뷰 ↔ 은하 뷰**~~ — ✅ 완료 (2026-06-11, 결정 34): SceneState galaxy에 view 축(ship/map). 우주선 뷰 = 현재 별 고정(시뮬레이션 기본), 은하 전도 = 은하 중심 고정(목적지 선택). 워프는 발동 즉시 우주선 포즈로 컷.
5. ~~**항성계 이탈 워프 연출**~~ — ✅ 해소 (2026-06-15). 원래 "항성계→우주선 뷰가 즉시 스왑"이라는 비대칭 지적이었으나, 결정 41(씬 통합)로 별도 항성계 씬이 사라지고 워프 출발이 `WarpCameraRig`의 정렬→회전→돌진 시퀀스로 대체되며 비대칭 자체가 소멸. 잔여 미세 대칭으로 **이탈 풀백 반동 + 워프 함교 리드아웃**을 추가. 워프를 5박자로 재구성(`warpTimeline`에서 각 박자를 ms로 직접 정의 → 진행도 분기점·`WARP_STAGE_A_MS`를 누적합에서 파생, 카메라·HUD 공유. 현재 정렬900·대기700·충전2000·반동650·돌진2200ms = stage A 6450ms — 각 단계가 또렷이 읽히도록 넉넉하게, "너무 빨라 단계 인식 불가" 피드백 반영): ① 목표 응시 정렬(회전) → ② 정렬 고정 대기 → ③ 상단 게이지 0→100% 충전(**카메라 정지**) → ④ 게이지 만충 후 목표 반대로 `DEPARTURE_PULLBACK_DISTANCE`(70u) 반동(wind-up) → ⑤ 점화 시 풀백 지점에서 큐빅 가속 돌진(뿜)+스트리크·FOV. **핵심(사용자 피드백)**: 연출(반동·돌진)은 게이지가 다 찬 뒤에 시작 — 충전 중엔 카메라가 멈춰 긴장을 적재한다. 정렬·반동·돌진이 dollyDirection 축에 colinear라 반동이 "축 방향 순수 후퇴(목표 중앙 고정)"로 읽힌다. 도착 줌인(`ShipCameraRig` pendingArrival)과 대칭. 끝점·돌진 거리 불변(풀백을 rushDistance에 합산), 연속성 보장.

   **워프 함교 리드아웃**(`WarpReadout`) — 워프 중 상단 중앙에 `WARP → 목적지` + 드라이브 단계(정렬→충전→점프) + CSS 충전 게이지(대기 종료 후 차기 시작, 만충 시 반동 트리거와 동기). 도착 리드아웃(SystemReadout)의 출발 대칭. 규약 준수: 단계 라벨은 JS 타이머(3회 전이), 게이지 채움은 CSS 애니메이션 delay+duration(프레임당 React 상태 없음 — 라이브 % 숫자는 그래서 생략). 렌더/DOM 전용, GEN_VERSION 무관. **알려진 엣지**: ≤540px에서 토스트 상단 레인(결정 42)과 위치 겹침 가능 — 워프 중 토스트는 드물어 보류.
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

> **🔝 우선순위 격상 (2026-06-15).** 엔진 확장(쌍성계 / 사실성 v2 / 이색 천체)을 다음 작업으로. 모두 출력 분포가 바뀌므로 **`/yc:brainstorm` → GEN_VERSION 범프 + 골든 재생성**이 선행. 철칙 2·3(GEN_VERSION 규칙·draw append-only) 숙지 필수.
> - ✅ **쌍성계 = GEN_VERSION 4** 완료 (2026-06-15) — E-5#3 참조. (`feature/binary-stars`)
> - ⏭️ **GEN_VERSION 번호는 구현 시점에 배정** — 다음 범프 = 5, 그다음 = 6. (후보: 사실성 v2 G-c-11, 이색 천체 G-c-9. 둘 중 먼저 머지되는 쪽이 5.) **"미리 번호 박지 말 것"** — v3가 이미 적용된 걸 모르고 "쌍성계=3"이라 적었다가 4로 정정한 전례 있음.

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

~~8. **위성(달)**~~ — ✅ 완료: `engine/system/moons.ts`(위성 전용 rngFor 스트림 격리, GEN_VERSION 불필요) + `scenes/system/Moon.tsx`(행성 그룹 자식 미니 궤도). PR #14에서 Sol 위성을 실제 데이터로 고정(`SOLAR_SYSTEM_MOONS` 16종).
9. **🔝 이색 천체: 블랙홀·성운·펄서 등** — 별 분포·종류 변경 = **GEN_VERSION 범프**(구현 시점 배정) + 골든 재생성. 표현(블랙홀 렌즈 효과·펄서 점멸·성운 볼류메트릭)과 게임플레이(탐사 보상? 항행 위험?)가 모두 열려 있음 — `/yc:brainstorm` 선행 필수.

11. **🔝 다중성계 사실성 v2** — 쌍성계(GEN_VERSION 4) 머지 후, 천문 사실성을 더 끌어올리는 후속. `docs/features/binary-stars/`(쌍성 1차) 위에 쌓되 별도 브랜치·별도 GEN_VERSION 범프. **`/yc:brainstorm` 선행** (특히 #6은 재결정). 시작: `/yc:brainstorm "다중성계 사실성 v2 — 분광형별 다중성 비율 + 4성계 + S/P형 재검토"`.

    > **1차에서 이미 충족 (재작업 불필요)**: ① 공전중심=바리센터(항상 circumbinary) ② 삼중성 계층 구조(inner 쌍 + outer) ③ 질량중심 공전·질량비.

    **갭 (구현 안 됨):**

    | # | 사실성 항목 | 현재 | 작업 | 비용 |
    |---|------------|------|------|------|
    | a | **분광형별 다중성 비율** | 고정 55/33/12 (분광 무관) | `MULTIPLICITY_WEIGHTS`를 분광형별 테이블로 분기 (`sectors.ts`). 목표값: O ~64% 삼중+, F/G 단일54/쌍29/삼중+17, M 단일~73%. 전체 평균은 M 다수라 단일성 ~2/3로 수렴. | **GEN_VERSION 범프** + 골든 재생성 (weighted 결과 분포 변경) |
    | b | **4성계 (2+2 / 3+1)** | 최대 삼중성 | `Multiplicity`에 `'quadruple'` 추가, 계층 한 레벨 더(2+2: 쌍성 두 쌍 / 3+1: 삼중 + 최외곽 1). append draw로 4번째 동반성. 렌더: `multiplicity.ts` `bodyPositions` 4체 중첩 + `MAX_BODIES` 3→4 (`CurrentSystem`·`currentBodies`·스크래치 배열·useStarPicking). 표시: 구성 'A+B+C+D'. | **GEN_VERSION 범프** + 골든 재생성 + 렌더 확장 |
    | c | **S형/P형 행성 궤도 (재결정)** | **P형(circumbinary)만** — 1차에서 사용자가 "항상 바리센터"로 결정해 S형 폐기(결정 8 개정). | 천문 사실성은 S/P 공존(S=한 별만 공전, P=쌍 전체 바깥). **재검토 필요**: 와이드 쌍성/계층 레벨별 S형 도입 여부. 단, 1차에서 S형이 와이드 쌍성 시각 혼란·관통 유발 이력 → 도입 시 분리거리 임계·궤도 안정역(stable zone) 설계 필요. | 렌더 전용(채택 시) — GEN_VERSION 무관, 단 설계 난도 높음 |
    | d | *(선택)* 형성 메커니즘 로어 | — | 코어 분열·동적 포획 등을 별 정보/로어 텍스트에 반영(시뮬 아님). | 낮음 (텍스트만) |

    > **묶음 권장**: a + b는 둘 다 분포 변경이라 **한 번의 GEN_VERSION 범프로 묶어** 골든 재생성 1회로 처리. c는 렌더 전용이라 별도 분리 가능.
    > **참고(카스토르)**: 별 수가 늘수록 계층 레벨만 추가되는 구조 — 4성계까지 하면 6중성계(2+2+2)도 같은 패턴으로 확장 가능하나 비범위.

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

## K. HUD 플라이트 데크 재설계 (2026-06-13, 결정 42)

> 4시안+3심사 패널로 도출. 빈도 기반 존 체계 — 상세는 결정 42. J 섹션을 부분 대체(NavigationControls·hud-button-nav 폐기). DOM/CSS 전용 — GEN_VERSION·저장 포맷 무관.

### 구현 단계

1. **K-1 골격**: `data-view` 루트 규약 + `ConsoleDeck`(모드 세그먼트 [함교|항법]·상태 라인·⟳·줌) + NavigationControls 삭제 + ShipFrame 밴드 제거 + `--deck-height` 앵커
2. **K-2 상단**: 텔레메트리 스트립(읽기 전용, 시드 텍스트 격하) + [도감|일지] 하우징 + ⚙ 포브(품질 수납) + 마스터 코션(StorageModeBanner 흡수)
3. **K-3 워프**: 데크 수납(translateY) + 1px 진행 라인(scaleX, 타임라인 동기)
4. ~~**K-4 디테일**: 분광 틱 룰러 + 모바일 콜아웃 도킹(≤540px)~~ — ✅ 완료 (PR #13, db63b07): 분광 틱 룰러 = `.hud-panel-header::after`(우측 감쇠) + `.system-readout::after`(양끝 대칭), CSS repeating-gradient + mask. 모바일 도킹 = `CalloutProjector` 도킹 분기(패널 고정 슬롯·점/리더라인만 신축) + `.callout-docked` CSS(≤540px). K 섹션 전체 완료.

### 검증 후 조건부 (v2 후보)

- 워프 조준 마커 트랙 축소판 — 정렬 단계에서 목적지 마커가 중앙 캐럿으로 수렴 (도수 눈금 없는 BEARING 축소판)
- 콜아웃 방위·거리 행 — 프로젝터 채널 추가·10Hz 갱신, 데스크탑 성능 실측 후
- 리드아웃 도킹 비행 애니메이션 — 테스트 파급 커서 보류 (결정 42 기각 항목)
