# Decisions: 뷰 전환 홀로그램 연출 (H-5)

**Created:** 2026-06-12

---

## Technical Decisions

### 1. 전환 연출 방향

| Option | Pros | Cons |
|--------|------|------|
| A: 홀로그램 소환/해제 (스캔라인) | 컨셉("함교 홀로그램")과 일치, 시각적 임팩트 | CSS 외 R3F 연동 없으면 Three.js 씬과 정확히 겹치는 위치 제어 어려움 |
| B: 공간 이동 (줌인/아웃) | 실제 카메라 이동감, 자연스러운 시점 전환 | 카메라 리그 충돌, 워프와 혼동 가능, 구현 복잡 |
| C: 빠른 페이드 | 구현 최단, 범용적 | 홀로그램 컨셉과 무관, 임팩트 없음 |

**Chosen:** A — 홀로그램 소환 (스캔라인 디졸브)
**Reason:** "함교에서 쏘는 홀로그램" 컨셉을 가장 직접적으로 표현. 워프(카메라 이동)와 시각 언어가 겹치지 않는다.

---

### 2. 구현 레이어

| Option | Pros | Cons |
|--------|------|------|
| A: CSS clip-path 오버레이 (DOM) | GPU 가속, 셰이더 불필요, 60fps 보장, 유지 보수 쉬움 | R3F 씬 픽셀 단위 접근 불가 (글리치 효과 제한) |
| B: R3F EffectComposer ShaderPass | 씬 전체 픽셀 조작 가능, 정밀한 글리치 | drei EffectComposer 의존 추가, 복잡도 높음, 성능 리스크 |
| C: Canvas 2D 오버레이 | 선 단위 자유 드로잉 | rAF 직접 관리, React 생명주기 외부 |

**Chosen:** A — CSS clip-path 오버레이
**Reason:** 현재 프로젝트의 DOM HUD 레이어(철칙 6: 텍스트 UI는 DOM으로) 패턴과 일치. 성능 리스크 없음. 스캔라인 효과에 충분한 표현력.

---

### 3. 전환 방향

| Option | Pros | Cons |
|--------|------|------|
| A: 단방향 — 들어오는 씬만 연출 | 구현 단순 (1개 컴포넌트), 나가는 씬 자원 즉시 해제 | 나가는 씬이 즉시 사라져 약간 어색할 수 있음 |
| B: 양방향 — 나가는 씬도 연출 | 완성도 높음 | 두 씬 동시 렌더 또는 씬 상태 캐싱 필요, 구현 2배 |

**Chosen:** A — 단방향
**Reason:** 0.4s 이하 짧은 전환에서 양방향은 체감 차이 미미. 구현 단순성 > 완성도 트레이드오프.

---

### 4. 전환 시간

| Option | Pros | Cons |
|--------|------|------|
| A: 0.3~0.5s | 빠른 반응성, 반복 사용 시 답답하지 않음 | 연출이 눈에 잘 안 띌 수 있음 |
| B: 0.6~1.0s | 연출 인식 확실 | 반복 시 느림 |
| C: 1.0s+ | 드라마틱 | 게임 루프 방해 |

**Chosen:** A — 총 0.6s (플리커 32ms + 스캔라인 400ms + 글로우 200ms 오버랩)
**Reason:** 스캔라인 자체는 0.4s. 플리커·글로우는 겹치거나 짧아 체감 총 길이는 0.5s 수준.

---

### 5. 부가 효과

| Option | Pros | Cons |
|--------|------|------|
| A: 청색 플리커 + 프레임 글로우 | 홀로그램 느낌 강화, CSS만으로 구현 | 없으면 스캔라인만으로도 충분 |
| B: 스캔라인만 | 가장 단순 | 홀로그램 컨셉 표현력 약함 |

**Chosen:** A — 청색 플리커 + 프레임 글로우
**Reason:** 사용자가 자유 위임. 기존 우주선 프레임(`.ship-frame`) 글로우 강도를 순간 증폭하는 방식이라 추가 DOM 요소 최소화.

---

---

## Architecture (added by /yc:plan)

### 6. 버튼 잠금 방식

| Option | Pros | Cons |
|--------|------|------|
| A: Zustand `isViewTransitioning` 플래그 (선택) | 기존 패턴 일관, 다른 컴포넌트에서도 구독 가능 | 스토어 필드 1개 추가 |
| B: CSS `body[data-view-transitioning]` | 스토어 불필요 | 명령형 DOM 조작, React 패턴 벗어남 |
| C: React Context | 스토어 없이 공유 | 추가 Context 레이어, 현 코드베이스에 Context 없음 |

**Chosen:** A — `isViewTransitioning: boolean` in `UiSlice`
**Reason:** `openPerspective`/`returnToShip` 액션 안에서 atomic set 가능. `NavigationControls`·`ShipFrame` 모두 Zustand 구독 패턴 사용 중.

---

### 7. CSS 애니메이션 구조

| Option | Pros | Cons |
|--------|------|------|
| A: 두 레이어 — cover + scanline (선택) | 스캔라인이 커버 경계를 정확히 추적, clip-path + top 동기화 | 두 개 DOM 요소 |
| B: 단일 cover에 gradient scanline | DOM 요소 1개 | clip-path 중 gradient 기준점이 고정돼 스캔라인이 경계 추적 불가 |
| C: Canvas 2D | 자유도 최고 | RAF 직접 관리, React 외부 |

**Chosen:** A — `.vt-cover` + `.vt-scanline` 두 레이어
**Reason:** `clip-path: inset(0 → 100% top)` 과 `top: 0 → 100vh` 를 동일 easing/duration으로 동기화하면 스캔라인이 경계를 정확히 따른다.

---

### Structure

```
src/
├── ui/
│   └── common/
│       └── ViewTransitionOverlay.tsx   ← 신규
├── styles/
│   └── view-transition.css             ← 신규 (keyframes + classes)
├── store/
│   ├── types.ts                        ← UiSlice에 isViewTransitioning 추가
│   └── createGameStore.ts              ← openPerspective/returnToShip에서 set
└── ui/hud/
    ├── HudLayer.tsx                    ← ViewTransitionOverlay 마운트
    ├── NavigationControls.tsx          ← isViewTransitioning 시 버튼 disabled
    └── ShipFrame.tsx                   ← isViewTransitioning + ship뷰 시 코너 글로우
```

### Core Flow (Pseudo-code)

```
// openPerspective() / returnToShip() 액션
set({ scene: { kind: 'galaxy', view: newView }, isViewTransitioning: true })

// ViewTransitionOverlay
useEffect(() => {
  if (view === prevViewRef.current || prevViewRef.current == null) {
    prevViewRef.current = view
    return
  }
  prevViewRef.current = view

  if (prefers-reduced-motion) {
    setViewTransitioning(false)
    return
  }

  setPhase('flicker')
  t1 = setTimeout(() => setPhase('scanline'), FLICKER_MS)       // 32ms
  t2 = setTimeout(() => { setPhase('idle'); setViewTransitioning(false) },
                  FLICKER_MS + SCANLINE_MS)                      // +400ms
  return () => clearAll(t1, t2)
}, [view])

// CSS 레이어
.vt-cover[data-phase="scanline"]  → animation: inset(0,0,0,0) → inset(100%,0,0,0) 0.4s easeOut
.vt-scanline[data-phase="scanline"] → animation: top 0→100vh 0.4s easeOut (동기)
.vt-flicker[data-phase="flicker"]   → opacity 0.15→0 32ms

// ShipFrame 글로우 (→ ship 방향 전환 시)
isViewTransitioning && view === 'ship'
  → .ship-frame-corner--glow 클래스 → drop-shadow 순간 강화 → 0.6s fade
```

### Key Interfaces

```typescript
// UiSlice 추가
readonly isViewTransitioning: boolean
setViewTransitioning(isTransitioning: boolean): void

// ViewTransitionOverlay 내부 phase
type VtPhase = 'idle' | 'flicker' | 'scanline'
```

### 타이밍 상수

```typescript
const VT_FLICKER_MS = 32      // 약 2프레임 — 홀로그램 게이트 신호
const VT_SCANLINE_MS = 400    // 스캔라인 메인 연출
const VT_TOTAL_MS = VT_FLICKER_MS + VT_SCANLINE_MS  // = 432ms
```
