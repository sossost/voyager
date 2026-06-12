# Implementation Plan: 뷰 전환 홀로그램 연출 (H-5)

**Status:** Approved
**Created:** 2026-06-12
**Spec:** ./01-spec.md

---

## Phase 1 — CSS 키프레임 (S, ~30min)

**목표:** 컴포넌트 없이 CSS만으로 모든 애니메이션을 먼저 정의한다.

- [ ] `src/styles/view-transition.css` 신규 생성
  - `.vt-cover` — `position: fixed; inset: 0; background: var(--color-bg); pointer-events: none; z-index: 90`
  - `.vt-scanline` — `position: fixed; left: 0; right: 0; height: 2px; background: var(--color-holo); box-shadow: 0 0 10px var(--color-holo); pointer-events: none; z-index: 91`
  - `.vt-flicker` — full-screen, `background: color-mix(in srgb, var(--color-holo) 15%, transparent)`
  - `@keyframes vt-cover-sweep` — `from { clip-path: inset(0 0 0 0) } to { clip-path: inset(100% 0 0 0) }` (0.4s cubic-bezier(0.22, 1, 0.36, 1))
  - `@keyframes vt-scanline-sweep` — `from { top: 0 } to { top: 100vh }` (동일 easing)
  - `@keyframes vt-flicker-out` — `from { opacity: 0.15 } to { opacity: 0 }` (32ms steps(1))
  - `.ship-frame-corner--glow` — `@keyframes vt-corner-glow: 0% { drop-shadow 강화 } 100% { 복귀 }` (0.6s)
  - `@media (prefers-reduced-motion)` — 모든 animation duration을 0ms로 override
- [ ] `src/styles/global.css` 또는 `src/main.tsx`에서 import

**Verify:** 브라우저 DevTools에서 CSS 파일 로드 확인, 클래스 수동 적용으로 애니메이션 동작 육안 확인

---

## Phase 2 — Store 업데이트 (S, ~15min)

**목표:** `isViewTransitioning` 플래그를 스토어에 추가한다.

- [ ] `src/store/types.ts` — `UiSlice`에 추가:
  ```ts
  readonly isViewTransitioning: boolean
  setViewTransitioning(isTransitioning: boolean): void
  ```
- [ ] `src/store/createGameStore.ts`
  - 초기값 `isViewTransitioning: false` 추가
  - `setViewTransitioning` 액션 구현: `set({ isViewTransitioning })`
  - `openPerspective()` — 기존 `set()` 호출에 `isViewTransitioning: true` 추가
  - `returnToShip()` — 동일

**Verify:** `npm run typecheck` 통과

---

## Phase 3 — ViewTransitionOverlay 컴포넌트 (S, ~45min)

**목표:** `WarpFlashOverlay` 패턴으로 뷰 전환 시퀀스를 관리하는 컴포넌트를 만든다.

- [ ] `src/ui/common/ViewTransitionOverlay.tsx` 신규 생성
  - `VtPhase = 'idle' | 'flicker' | 'scanline'` 타입
  - `VT_FLICKER_MS = 32`, `VT_SCANLINE_MS = 400` 상수
  - `sceneView` 셀렉터: `state.scene.kind === 'galaxy' ? state.scene.view : null`
  - `prevViewRef` 로 이전 view 추적 — 첫 마운트(prevView null)는 전환 생략
  - `useEffect([sceneView])`:
    - view 변화 없으면 return
    - `prefers-reduced-motion` 체크 → true면 `setViewTransitioning(false)` 즉시 호출 후 return
    - `setPhase('flicker')` → 32ms 후 `setPhase('scanline')` → 400ms 후 `setPhase('idle') + setViewTransitioning(false)`
    - cleanup: clearTimeout 두 개
  - 항상 세 개 div 렌더 (`aria-hidden="true"`), `data-phase` 속성으로 CSS 제어
- [ ] `src/ui/hud/HudLayer.tsx` — `<ViewTransitionOverlay />` 마운트 (ShipFrame 다음, z-index 순서상 HUD 버튼 아래)

**Verify:** `npm run typecheck` + dev 서버에서 `은하 항법` / `← 우주선` 버튼 클릭 시 스캔라인 육안 확인

---

## Phase 4 — 버튼 잠금 + 프레임 글로우 (S, ~20min)

**목표:** 전환 중 인터랙션을 차단하고 ship 뷰 진입 시 코너 글로우를 켠다.

- [ ] `src/ui/hud/NavigationControls.tsx`
  - `isViewTransitioning` 스토어 구독
  - 두 버튼에 `disabled={isViewTransitioning}` + `aria-disabled={isViewTransitioning}` 추가
  - CSS: `button:disabled { pointer-events: none; opacity: 0.5 }` (global.css에 이미 있으면 확인)
- [ ] `src/ui/hud/ShipFrame.tsx`
  - `isViewTransitioning` 스토어 구독
  - `showGlow = isViewTransitioning && scene.kind === 'galaxy' && scene.view === 'ship'`
  - `.ship-frame-corner` 에 조건부 `ship-frame-corner--glow` 클래스 추가

**Verify:** 버튼 클릭 후 전환 중 버튼 재클릭 무반응 확인. ship 뷰 진입 시 코너 강조 확인.

---

## Dependencies

```
Phase 1 (CSS)   ← 독립
Phase 2 (Store) ← 독립
Phase 3 (Component) ← Phase 1 + Phase 2 필요
Phase 4 (Polish)    ← Phase 2 + Phase 3 필요
```

Phase 1, 2는 병렬 진행 가능.

---

## Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| `clip-path: inset()` 와 `top` 타이밍 불일치 | LOW | 동일 easing/duration 상수 공유 — 별도 변수 없이 CSS custom property로 묶어 실수 방지 |
| `prefers-reduced-motion` 시 `isViewTransitioning` 미해제 | MEDIUM | reduced-motion 브랜치에서도 반드시 `setViewTransitioning(false)` 호출 필수 |
| 워프 도착 직후 view 토글 시 두 전환 겹침 | LOW | `isViewTransitioning` 플래그가 true이면 `openPerspective`/`returnToShip` 가드 추가 고려 (Phase 4에서 판단) |
| ShipFrame null 반환 중 글로우 클래스 적용 | LOW | `showGlow` 계산은 렌더 이전 — `isOnShip === false` 시 null 반환이므로 무조건 안전 |

---

## Estimated Complexity: S

신규 파일 2개, 수정 파일 4개. 기존 `WarpFlashOverlay` 패턴 재활용. CSS 애니메이션 위주라 R3F 로직 없음.
