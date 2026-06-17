# Decisions: 펄서(중성자성) 고품질 렌더

**Created:** 2026-06-17

> 기존 이색 천체 결정(`docs/features/exotic-bodies/02-decisions.md`)을 상속한다. 본 문서는 펄서 고유 결정만 기록한다. 전역 철칙(`CLAUDE.md`)·결정 22·26·28(물리충실 기각·좁은 핫코어 집중·블러구름 기각, 게임미학 우선, 빛은 가산) 준수.

## Technical Decisions

### 1. 시그니처(히어로) 비주얼

| Option | Pros | Cons |
|--------|------|------|
| A: 등대 스윕 빔 | 가장 상징적·동적·즉각 인지. 단일 시그니처로 격을 만들기 좋음(블랙홀 렌즈 선례) | 빔이 카메라 직격 시 광과민성·과노출 관리 필요 |
| B: 상대론적 쌍제트 | 디테일 압도 가능 | 정적이라 즉각 드라마 약함 |
| C: 자기권 + 폴라캡 | 가장 차별화 | 추상적 — '펄서'로 즉시 안 읽힘, 셰이더 난도 최상 |
| D: 복합 전부 | 최대 임팩트 | 요소 경쟁·산만·성능 부담. 블랙홀의 '렌즈 하나' 성공과 반대 |

**Chosen:** A (등대 스윕 빔). 보조로 쌍제트·고온 본체/폴라캡을 받침으로 둔다(결정 2).
**Reason:** 펄서 하면 떠오르는 가장 상징적 이미지. 블랙홀이 "렌즈 하나"로 격을 만든 교훈을 그대로 적용 — 단일 히어로에 집중하고 나머지는 받침.

---

### 2. 보조 요소 구성

| Option | Pros | Cons |
|--------|------|------|
| A: 쌍제트 + 고온 본체/폴라캡 | 빔(자기축)과 입체 대비, 펄서 본체 정체성 명확. 옛 구현 골격 계승·강화 | — |
| B: + 자기권 필드라인 | 살아있는 느낌 강화 | 추가 셰이더·산만 |
| C: + 적도 싱크로트론 토러스 | 화려 | **블랙홀 강착원반과 시각 혼동** — 차별성 훼손 |

**Chosen:** A (쌍제트 + 초고온 본체/폴라캡). 자기권 필드라인·싱크로트론 토러스는 **제외**.
**Reason:** 히어로(빔)를 받치되 경쟁하지 않는 최소 구성. 토러스는 블랙홀 강착원반과 헷갈려 이색 천체 간 차별성을 깨므로 명시적 기각.

---

### 3. 렌더 기법 티어 전략

| Option | Pros | Cons |
|--------|------|------|
| A: 인씬 셰이더 + high 디테일 | 포스트 없이 충분히 화려, 성능·복잡도 안전, PerformanceMonitor 하향 자연 대응. 블랙홀 페이크 폴백 패턴 재사용 | 풀스크린 포스트만큼의 '압도'는 아닐 수 있음 |
| B: 포스트이펙트 (블랙홀 high처럼) | 블랙홀급 압도감 | high 전용·셰이더 NaN/Bloom 리스크(블랙홀 교훈)·GPU·복잡도 최상 |
| C: 하이브리드 (빔 글로우만 포스트) | 임팩트와 안전 절충 | 두 경로 동기화·티어 분기 부담 |

**Chosen:** A (인씬 셰이더 + high 티어 디테일).
**Reason:** 블랙홀의 포스트이펙트는 NaN→검은 화면, Bloom 번짐 등 큰 리스크를 동반했다(exotic-bodies 핵심 교훈). 펄서의 빔·제트는 가산 셰이더 지오메트리만으로 충분히 화려하게 표현 가능하고, 본체는 StarSurface 계열 재사용으로 안전하다. high 티어에서 세그먼트·노이즈·내부 충격파 레이어를 더해 격을 만든다.

---

### 4. 등대 빔의 카메라 통과 동작 (광과민성)

| Option | Pros | Cons |
|--------|------|------|
| A: 부드러운 글로우 펄스 | 등대 체감 살리면서 안전(자전 주기·완전 소등 없음). 광과민성 안전 | 섬광 순간 드라마는 절제됨 |
| B: 순수 시각(점멸 없음) | 광과민성 완전 안전 | 단조 — '등대' 체감 약함 |
| C: 강한 플래시 | 가장 극적 | 광과민성 발작 리스크 — 결정 5(≤3Hz·대비 상한) 위반 가능 |

**Chosen:** A (부드러운 글로우 펄스).
**Reason:** "등대가 쓸고 지나간다"는 체감을 살리면서 광과민성 안전을 지키는 균형점. 완전 소등하지 않고(대비 상한) 자전 주기로 부드럽게 변조한다. 점멸 주파수 ≤3Hz 유지.

---

### 5. 빔 구성 (단일 vs 쌍극)

| Option | Pros | Cons |
|--------|------|------|
| A: 쌍극 빔 2개 | 천문학적·시각적 정석(양 자기극). 자기축이 자전축과 어긋나 회전 시 빔이 원뿔을 쓰는 등대 리듬 | 둘 다 카메라 향할 때 글로우 중첩 관리 |
| B: 단일 빔 | 단순·저비용·스윕 주기 명확 | 한쪽만 비춰 덜 상징적·비대칭 |

**Chosen:** A (쌍극 빔 2개).
**Reason:** 펄서의 등대 효과는 자기축≠자전축 + 양극 빔에서 나온다. 쌍극이라야 "회전하며 번갈아 쓸기" 리듬이 산다. 글로우 중첩은 펄스 강도 합산 clamp로 관리.

---

### 6. 다중성계 주성 허용 (블랙홀과 차별)

| Option | Pros | Cons |
|--------|------|------|
| A: 다중성계 허용 | 천문학적 자연(밀리초펄서=동반성 가속). 빔/제트(자전축)와 동반성(궤도면) 겹침 적음. `kind`만 append → 기존 쌍성 출력 보존 | 동반성이 빔을 가릴 수 있어 일부 구도 다양성 |
| B: 단일성계 (블랙홀처럼) | 시각 단순·일관성 | 동반성 출력 덮어쓰는 추가 보정 로직, 쌍성 다양성 손실 |

**Chosen:** A (다중성계 허용).
**Reason:** 블랙홀이 단일성계로 보정된 건 동반성이 **강착원반·중력렌즈와 겹쳐** 빛이 맺히는 문제(v6) 때문이었다. 펄서는 강착원반이 없고 빔·제트가 자전축 방향이라 궤도면의 동반성과 시각 간섭이 적다. 따라서 블랙홀의 단일성계 보정(`isBlackHole` 분기)을 펄서에 적용하지 않고 기존 `multiplicity`·`companions`를 그대로 보존한다.

---

### 7. 펄서계 행성 (블랙홀과 차별)

| Option | Pros | Cons |
|--------|------|------|
| A: 행성 유지 | `planetsOf` 무변경 → 골든 보존. 펄서 행성은 천문학적 명분(PSR B1257+12=최초 외계행성). 탐사 콘텐츠 유지 | 빔·제트 근처 행성 권도 정리 필요 |
| B: 행성 숨김 (블랙홀처럼) | 빔/제트에 시선 집중·장면 정돈 | 탐사 콘텐츠 손실, 펄서 행성의 흥미 포기 |

**Chosen:** A (행성 유지).
**Reason:** 블랙홀은 강착원반이 행성과 겹쳐 숨겼지만(렌더 전용 분기), 펄서는 강착원반이 없어 행성과 겹치지 않는다. `planetsOf()`를 건드리지 않으므로 골든도 보존된다.

---

### 8. 은하 맵 노드 표현 + 희귀도

| Option | Pros | Cons |
|--------|------|------|
| A: 전기 청백 점, 블랙홀보다 약간 흔하게 | 고온 중성자성 정체성·일반 별과 구분. 고품질 렌더를 더 자주 감상 | 과하면 희귀성 퇴색 |
| B: 블랙홀과 비슷한 희귀도 | 둘 다 극희귀 | 고품질 펄서를 볼 기회 적음 |
| C: 블랙홀보다 희귀 | 최상급 희귀 | 거의 못 봄 — 투자 대비 노출 최소 |

**Chosen:** A (전기 청백 점, O/B weight에서 black_hole < pulsar).
**Reason:** 펄서는 밝은 점이라 블랙홀처럼 링 빌보드 보강이 불필요(블랙홀은 검은 점이라 안 보여 링 추가). 블랙홀보다 약간 흔하게 두어 공들인 고품질 렌더를 감상할 기회를 늘리되, 여전히 O/B 한정이라 자연 희귀를 유지한다. 정확한 weight는 `/yc:plan`에서 확정.

---

### 9. reduced-motion 처리

| Option | Pros | Cons |
|--------|------|------|
| A: 이번 범위 밖 | 빔이 이미 부드러운 펄스·안전 주기라 즉각 위험 낮음. 인프라 신설은 전역 영향(별도 작업) | 접근성 정석은 아님 |
| B: 펄서 전용 정적 처리 | 펄서만 회전·펄스 정지 | 작은 인프라 추가 |
| C: 전역 인프라 신설 | 향후 모든 애니 준수 | 스코프 대폭 확장·회귀 테스트 — 펄서 PR 범위 초과 |

**Chosen:** A (이번 범위 밖).
**Reason:** 코드베이스에 reduced-motion 인프라가 전혀 없어 신설은 전역 영향을 주는 별도 작업이다. 펄서 빔은 이미 광과민성 안전 설계(부드러운 펄스·완전 소등 없음·≤3Hz)라 즉각 위험이 낮다. 향후 인프라가 생기면 펄서 애니에 적용한다(데드코드는 남기지 않음).

---

### 10. GEN_VERSION 범프 (7)

| Option | Pros | Cons |
|--------|------|------|
| A: GEN_VERSION 7로 범프 + 골든 재생성 | 결정 13(출력 분포 변경) 준수. 블랙홀 v6 선례와 일관 | 기존 플레이어 부트 시 안내 모달(PRE_RELEASE_AUTO_MIGRATE로 개발 중 생략) |
| B: 범프 안 함 | 골든 diff 0(프로브 섹터 미도달)이라 철칙 2 트리거 미충족 | 분포가 실제로 바뀌어 결정 13 위반 — v6 선례와 불일치 |

**Chosen:** A (GEN_VERSION 7 + 골든 재생성).
**Reason:** 펄서를 O/B 가중치에 추가하면 O/B 추첨 결과 분포가 바뀐다(블랙홀 v6 단일성계 보정과 같은 성격 — 골든 diff는 0이지만 분포 변경). 결정 13에 따라 범프하고 골든을 재생성한다. **번호는 7** — 6은 블랙홀 단일성계가 이미 사용("미리 번호 박지 말 것" 전례 주의).

---

## Architecture (added by /yc:plan, 2026-06-17)

### 코드베이스 분석 — 통합 지점

기존 블랙홀(exotic-bodies)이 `StarKind` 확장 패턴을 깔아놓아, 펄서 추가는 **타입 주도로 완결성이 강제**된다:

| 지점 | 현재 | 펄서 작업 | 자동/수동 |
|------|------|-----------|-----------|
| `engine/galaxy/sectors.ts` `StarKind` | `'main_sequence' \| 'black_hole'` | `\| 'pulsar'` 추가 | 수동 |
| `engine/galaxy/sectors.ts` `KIND_WEIGHTS_BY_SPECTRAL` | O/B만 black_hole | O/B에 pulsar 추가(weight > black_hole) | 수동 |
| 별 생성 루프 (`sectors.ts:206`) | `kind = weighted(...)` 1 draw | **무변경** — weighted는 테이블 무관 1 draw(append-only 유지) | 자동 |
| 블랙홀 단일성계 보정 (`sectors.ts:210`) | `isBlackHole` 분기 | **무변경** — 펄서는 `!== 'black_hole'`이라 multiplicity·companions 보존 | 자동 |
| `engine/version.ts` | `GEN_VERSION = 6` | `7` + 주석 | 수동 |
| `scenes/system/exotic.ts` `kindRadiusFactor` | switch 2종(exhaustive, no default) | `case 'pulsar'` 추가 안 하면 **컴파일 에러** | 수동(타입 강제) |
| `scenes/galaxy/spectral.ts` `EXOTIC_RENDER` | `Record<ExoticKind>` (black_hole만) | `ExoticKind`에 pulsar 자동 포함 → 항목 안 넣으면 **컴파일 에러** | 수동(타입 강제) |
| `scenes/galaxy/spectral.ts` `STAR_KIND_LABELS` | `Record<StarKind>` | pulsar 키 안 넣으면 **컴파일 에러** | 수동(타입 강제) |
| `scenes/system/CurrentSystem.tsx` 디스패치 (`:275`) | `black_hole ? BlackHole : StarSurface` | `pulsar ? Pulsar` 분기 추가 | 수동 |
| `CurrentSystem` `showPlanets` (`:109`) | `kind !== 'black_hole'` | **무변경** — 펄서는 행성 자동 유지 | 자동 |
| `scenes/galaxy/GalaxyStarField.tsx` 맵 노드 (`:57`) | `main_sequence ? SPECTRAL : EXOTIC_RENDER` | **무변경** — EXOTIC_RENDER.pulsar 추가로 자동 색/크기 | 자동 |
| `data/phenomena/phenomena.ts` `PHENOMENA_CATALOG` | black_hole 1건 | pulsar 아키타입 추가(라벨·로어·rarity) | 수동 |
| `ui/hud/{StarInfoPanel,SystemReadout}.tsx` | `kind !== 'main_sequence' ? STAR_KIND_LABELS[kind]` | **무변경** — 라벨 추가로 자동 표시 | 자동 |
| `ui/codex/CodexOverlay.tsx` PhenomenaTab | `PHENOMENA_CATALOG` 순회 | **무변경** — 카탈로그 추가로 자동 표시 | 자동 |
| `store/createGameStore.ts` warpTo 발견 (`:147`) | `kind !== 'main_sequence' ? kind` | **무변경** — 펄서 발견 자동 기록 | 자동 |
| `scenes/galaxy/BlackHoleMapRings.tsx` | black_hole 전용 링 | **무변경** — 펄서는 밝은 점이라 링 불필요(결정 8) | 자동 |

> **핵심**: 수동 작업은 엔진 2(kind·weight)·버전 1·렌더 라벨/팩터 4(타입 강제)·도감 1·디스패치 1·**Pulsar 컴포넌트 1(신규, 작업의 90%)**. 나머지는 타입·분기 재사용으로 자동.

### Pulsar 렌더 컴포넌트 설계 (`scenes/system/Pulsar.tsx`, 신규)

블랙홀의 `BlackHole.tsx`/`StarSurface.tsx` 패턴(가산 셰이더 메시 + crossfade opacity + 빌보드)을 계승. **포스트이펙트 없음**(결정 3).

**씬그래프 계층:**
```
<group ref={rootRef}>                       // crossfade opacity 측정 기준
  <StarSurface radius color emissiveBoost=2.0 coronaScale=0.7 />   // 초고온 청백 본체
  <group ref={spinRef}>                      // 자전축(Y) 회전 — SPIN_RATE rad/s
    <PolarCaps />                            // 자기극 고온 핫스팟 2개(가산 디스크)
    <group rotation={[0,0,MAGNETIC_OFFSET]}> // 자기축 = 자전축에서 기울어짐
      <Beam +pole /> <Beam -pole />          // 등대 쌍극 빔 (가산 콘, high=내부 레이어)
    </group>
    <Jet +axis /> <Jet -axis />              // 상대론적 쌍제트(자전축 정렬, high=충격파 노트)
  </group>
  <CameraFlare ref={flareRef} />             // 카메라 향 글로우 펄스(빌보드, 강도=빔·시선 내적)
</group>
```

**히어로 — 등대 글로우 펄스 (결정 4·5, 광과민성):**
- 매 프레임 빔 월드 방향 2개와 카메라→펄서 시선의 내적을 구해, 최대값을 `CameraFlare` 빌보드 강도로 변조. **빔이 카메라를 향할 때만 화면 중앙이 부드럽게 밝아진다** → "등대가 쓸고 지나간다"가 지오메트리에서 자연 발생.
- 펄스 주파수 = 자전 주파수 × 2(쌍극) — `SPIN_RATE`를 빔 통과 **≤3Hz**로 묶는다(예: SPIN_RATE ≈ 2.0 rad/s ≈ 0.32 rev/s → 통과 0.64Hz, 안전). 강도 하한 클램프로 **완전 소등 없음**(대비 상한, 결정 5).

**셰이더 안전(블랙홀 교훈, 결정 10/01-spec):** 빔·제트·플레어 프래그먼트는 각도 normalize, 제곱은 `d*d`, 위험 `pow` 금지, 출력 clamp. 본체는 검증된 StarSurface 재사용.

**티어 분기(open question 4 해소):** 펄서 인씬 셰이더는 콘+빌보드라 레이마칭 대비 저비용 → **블랙홀처럼 high 고정하지 않고 PerformanceMonitor 하향에 자연 대응**. `QUALITY_PRESETS[qualityTier]` 기반 detail 분기(high=빔 내부 레이어·fbm 노이즈·제트 충격파 / medium·low=단일 콘·노이즈 생략).

**LOD·워프·crossfade 계약(기존 재사용):**
- LOD/워프 가시성: `CurrentSystem`이 이미 `group.visible`(LOD)·`!isWarping`(본체 마운트)으로 제어 → Pulsar는 추가 작업 없음.
- crossfade opacity: `StarSurface`/`BlackHole`처럼 `crossfadeProgress(거리)`로 빔·제트·플레어 머티리얼 `uOpacity` 변조(워프 도착 fade-in).

### Pulsar 형태 상수 (`scenes/system/exotic.ts` 또는 Pulsar.tsx 모듈 상수)
`SPIN_RATE`·`MAGNETIC_OFFSET`·`BEAM_LEN_FACTOR`·`BEAM_CONE_ANGLE`·`JET_LEN_FACTOR`·`PULSE_MIN`·`BEAM_PASS_HZ` 등. 시간 함수(회전·펄스)는 컴포넌트 useFrame, 형태 상수는 모듈 상수(결정 6 — GEN_VERSION 무관).

### 핵심 인터페이스
```ts
// engine/galaxy/sectors.ts
export type StarKind = 'main_sequence' | 'black_hole' | 'pulsar'

// scenes/system/Pulsar.tsx
interface PulsarProps {
  readonly radius: number   // STAR_VISUAL_RADIUS × kindRadiusFactor('pulsar')
  readonly color: string    // EXOTIC_RENDER.pulsar.color (전기 청백)
}

// data/phenomena/phenomena.ts — PHENOMENA_CATALOG에 추가
{ kind: 'pulsar', label: '펄서', lore: '…', rarity: 'rare' }
```

