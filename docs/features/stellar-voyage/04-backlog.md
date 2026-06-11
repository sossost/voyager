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
