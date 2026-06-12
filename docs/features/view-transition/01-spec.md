# Feature Spec: 뷰 전환 홀로그램 연출 (H-5)

**Status:** Confirmed
**Created:** 2026-06-12
**Author:** brainstorm session

---

## Overview

은하 항법(퍼스펙티브) ↔ 우주선(1인칭) 뷰 전환 시, 새로 진입하는 씬이 위→아래 스캔라인으로 소환되는 홀로그램 연출. 현재 즉시(cut) 전환의 어색함을 제거하고 "함교에서 쏘는 홀로그램" 컨셉을 강화한다.

---

## User Goals

- 플레이어로서, `은하 항법` / `← 우주선` 버튼을 눌렀을 때 뷰가 단순히 바뀌는 것이 아니라 홀로그램이 켜지는 느낌을 받고 싶다.

---

## Behavior

### Happy Path — 우주선 뷰 → 은하 항법 진입

1. `은하 항법` 버튼 클릭
2. 현재 씬(우주선 뷰) 즉시 컷 — 연출 없음
3. 청색(`#5eead4`) 플리커 1프레임 발생 (홀로그램 게이트 동작 신호)
4. 수평 스캔라인이 화면 상단에서 아래로 내려오며 새 씬(은하 항법)이 드러남 (0.4s, easeOut)
5. 스캔라인 완료 직후 화면 프레임 글로우(기존 `.ship-frame` 라인) 순간 강조 후 복귀

### Happy Path — 은하 항법 → 우주선 뷰 진입

우주선 뷰 → 은하 항법 진입과 동일 (나가는 씬은 항상 즉시 컷).

### 전환 중 조작

- 전환 중 버튼 클릭 비활성화 — 전환이 완료된 후에만 토글 가능
- 전환 중 워프 버튼은 그대로 활성 (전환과 독립적)

### Edge Cases

| Situation | Expected Behavior |
|-----------|-------------------|
| `prefers-reduced-motion` 활성 | 스캔라인 없이 즉시 표시 (플리커·글로우도 생략) |
| 전환 중 탭 비활성화 후 복귀 | 애니메이션 즉시 완료 상태로 스킵 |
| 워프 → 도착 직후 뷰 토글 | `pendingArrival` 소비 완료 후 허용 (도착 줌인과 겹치지 않음) |

---

## Interface Design

### 컴포넌트

**`ViewTransitionOverlay`** (신규, DOM 레이어)
- Canvas 위 절대 포지션 오버레이
- `clip-path: inset(Y% 0 0 0)` — Y가 100%→0%로 감소하며 씬이 드러남
- 배경: `transparent` (새 씬이 아래서 그대로 보임)
- 플리커: 전환 시작 시 `opacity 0→0.15→0` (청색 틴트 레이어, 1프레임 ≈ 32ms)
- 프레임 글로우: 전환 완료 시 `.ship-frame` 라인에 `box-shadow` 강도 순간 증폭 후 복귀

**Store 변경**
- `scene.view` 토글 시 `isTransitioning: boolean` 플래그 설정 (전환 중 버튼 잠금용)
- 또는 CSS 클래스로만 처리 (store 변경 최소화 우선)

### 애니메이션 타이밍

| 단계 | 시작 | 지속 | 이징 |
|------|------|------|------|
| 청색 플리커 | 0ms | 32ms (2프레임) | 즉시 |
| 스캔라인 디졸브 | 32ms | 400ms | easeOut cubic |
| 프레임 글로우 | 432ms | 200ms | easeOut |

총 전환 시간: **~0.6s** (플리커 포함)

---

## Acceptance Criteria

- [ ] WHEN 은하 항법 버튼을 클릭하면 THE SYSTEM SHALL 새 씬을 0.4s 스캔라인 디졸브로 표시한다
- [ ] WHEN 우주선 버튼을 클릭하면 THE SYSTEM SHALL 새 씬을 0.4s 스캔라인 디졸브로 표시한다
- [ ] THE SYSTEM SHALL 스캔라인 시작 직전 청색 플리커(32ms)를 표시한다
- [ ] THE SYSTEM SHALL 스캔라인 완료 후 프레임 글로우를 0.2s 강조한다
- [ ] WHILE 전환 중이면 THE SYSTEM SHALL 뷰 토글 버튼을 비활성화한다
- [ ] WHERE prefers-reduced-motion이 활성이면 THE SYSTEM SHALL 모든 애니메이션을 건너뛰고 즉시 표시한다
- [ ] THE SYSTEM SHALL 워프 전환(WarpFlashOverlay)과 독립적으로 동작한다

---

## Scope

**In Scope:**
- `view: 'ship'` ↔ `view: 'perspective'` 전환 시 스캔라인 연출
- 청색 플리커 + 프레임 글로우 부가 효과
- `prefers-reduced-motion` 지원

**Out of Scope:**
- 워프 전환 연출 (WarpFlashOverlay 별도 담당)
- 나가는 씬 연출 (즉시 컷)
- 은하뷰 내 줌/패닝 애니메이션
- 사운드 효과

## Open Questions
- [ ] 전환 중 버튼 잠금: store `isTransitioning` 플래그 vs CSS pointer-events only — `/yc:plan`에서 결정
