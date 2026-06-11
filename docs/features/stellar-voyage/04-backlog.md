# Backlog: v1 이후 개선 항목

**Created:** 2026-06-11 (v1 완료 + 코드 리뷰 직후)

## A. 코드 리뷰 LOW 메모 (검증 생략된 경미 항목 — 빠른 개선 후보)

1. **`nextToastId` 모듈 레벨 가변 변수** — `store/createGameStore.ts`: 팩토리 클로저 안으로 이동 (테스트 격리).
2. **`__gameStore` 노출 가드 불일치** — `store/index.ts`: `MODE !== 'production'` 대신 `import.meta.env.DEV` 또는 의도 주석 + Window 타입 보강.
3. **CameraRig 카메라/타깃 비동기** — focus 변경 시 `controls.target`과 `camera.position`을 동일 프레임에 일괄 적용.
4. **매직 넘버** — `planets.ts`의 `2147483647` → `INT32_MAX` 상수, SelectedStarMarker 링 반지름 상수화.
5. **ScanSequence 셀렉터 분리** — EncounterOverlay 내부 함수 매 렌더 재생성 (성능 영향 미미, 스타일).
6. **WarpFlashOverlay 암묵적 falsy** — early-return 패턴으로 재구성.

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

1. **배경 은하** — 현재 우주에 우리 은하 하나뿐이라 바깥이 빈 검정. 줌아웃·항행 배경에 원거리 은하 몇 개(빌보드 스프라이트 또는 작은 성운 텍스처)를 띄워 공간감 부여. 렌더 전용 — GEN_VERSION 무관.
2. **워프 연출 다듬기** — 현 3단 타임라인(결정 16)이 투박함. 스트리크 셰이더 품질, FOV 펄스 곡선, 플래시 타이밍·색감 개선. 렌더 전용. `src/scenes/warp/`.
3. **쌍성계(다중성계)** — 현재 단일 항성만 생성. 쌍성/삼중성 도입은 출력 분포 변경 = **GEN_VERSION 3** + 별 스트림 append-only 규칙 안에서 동반성 draw 설계 필요. 별계 씬·StarInfoPanel·궤도 연출도 연동. 엔진 변경 — `/yc:brainstorm` 선행 권장.
4. **시점 전환: 우주선 뷰 ↔ 은하 뷰** — 현재 항상 전지적 은하 시점. 평소엔 우주선(추적/1인칭) 시점으로 머물다가, 항행 목표 선택 시에만 은하 뷰로 전환하고 워프는 우주선 시점에서 발동되는 흐름. 씬 상태·카메라·UX 재설계 — 스펙 선행 (`/yc:brainstorm` 후보). 5번과 한 묶음.
5. **항성계 이탈 워프 연출** — 별계 → 은하 지도 전환이 현재 즉시 스왑이라 진입(워프 도착) 연출과 비대칭. 이탈 연출을 추가하면 4번의 우주선 뷰 흐름과 자연스럽게 맞물림.
6. **항성계 배경 별** — 별계 씬에 배경 별이 없어 항성계만 덩그러니 떠 있음. 주변 실제 별(은하 별 필드 데이터 재사용, 시드 결정론 유지) 또는 원거리 스타필드를 배경에 깔기. 렌더 전용.
