# Decisions: 쌍성계 / 다중성계 (Binary & Multiple Star Systems)

**Created:** 2026-06-15

> 프로젝트 본 결정 시트(`docs/features/stellar-voyage/02-decisions.md`)의 결정 13(GEN_VERSION·스트림 격리), 22~28(비주얼 1·2차 패턴·기각 이력), 32(GEN_VERSION 3)와 연속선상. 새 결정 번호는 본 시트 편입 시 부여.

## Technical Decisions

### 1. 동반성 모델 — 게임 내 존재 방식

| Option | Pros | Cons |
|--------|------|------|
| A: 장식형 제2태양 (서브컴포넌트) | 별 시각 사실성 최대, append-only로 기존 우주 보존, 은하 맵 노드 1개 유지, 범위·리스크 최소 | 동반성 별도 선택/워프 불가, 동반성 자체 행성계 없음 |
| **A-사실성 강화** | A의 장점 + 질량중심 공전·편심·이중 광원·분리거리 기반 행성 배치로 B의 천문학적 사실성 거의 전부 흡수 | 행성 S/P-type 완전 분리는 아님(근사) |
| B: 독립 항성 + 분리 행성계 | 최대 깊이(S/P-type 완전 분리, 동반성 항법) | 엔진·씬·콜아웃 전면 재작업, 출력 분포 변경 폭 큼, 고리스크, 별도 brainstorm 필요 |

**Chosen:** A-사실성 강화
**Reason:** 사용자 목표가 "최대한 현실적이고 디테일한 *시각화*". 별 자체의 시각 사실성은 A·B가 동일하고, 차이는 행성 궤도 토폴로지와 항법 깊이뿐. 분리거리 기반 행성 배치(circumbinary↔주성)로 B의 행성 사실성마저 근사 흡수하면서, 동반성을 별도 항법 노드로 만들지 않아 범위·리스크를 통제한다. append-only 원칙과도 자연스럽게 맞물린다.

---

### 2. 다중성 범위 (다중도)

| Option | Pros | Cons |
|--------|------|------|
| A: 쌍성 + 삼중성 | 실제 분포에 근접, 다양성 풍부, 렌더 N-순회로 일반화 용이 | 삼중성 궤도 배치 고민 필요(계층형) |
| B: 쌍성만 | 가장 단순, 삼중성 궤도 고민 불필요 | 다양성 제한, 추후 삼중성 추가 시 또 GEN_VERSION 범프 |

**Chosen:** 쌍성 + 삼중성
**Reason:** 한 번의 GEN_VERSION 범프로 다양성을 최대화. 삼중성은 물리적으로 안정한 **계층형(근접 쌍 + 멀리 도는 제3성)** 으로 고정하면 궤도 배치 모호성도 해소된다(결정 6 참조).

---

### 3. 다중성계 출현 빈도

| Option | Pros | Cons |
|--------|------|------|
| A: 현실적 ~45% 다중 | 태양형 별 실제 다중성 비율에 근접, '사실성 우선' 미학과 일치 | 다중성이 흔해 희소성은 낮음 |
| B: 희소 ~15~20% | 다중성계가 특별한 발견 | 사실성 떨어짐 |
| C: 흔함 ~60%+ | 비주얼 임팩트 최대 | 단일성의 평온함이 희소, 비현실적 |

**Chosen:** 현실적 (single≈55% / binary≈33% / triple≈12%, 다중 ≈45%)
**Reason:** 프로젝트의 일관된 '사실성 우선' 미학. 절반 가까이가 다중성이라 탐험 다양성이 풍부하면서도 단일성의 평온함이 유지된다.

---

### 4. 별 운동 — 실시간 공전 vs 고정 배치

| Option | Pros | Cons |
|--------|------|------|
| A: 실시간 질량중심 공전 | 살아있는 느낌, 역동감, 사실성 최대. 공전각은 렌더 시간 기반이라 결정론 무관 | useFrame 연속 갱신 — 성능 주의(LOD로 통제) |
| B: 고정 오프셋 배치 | 구현 단순, 성능 부담 없음 | 사실성·역동감 저하, '정지된 모형' 느낌 |

**Chosen:** 실시간 공전
**Reason:** 시각 사실성 목표의 핵심. R3F 규율 준수(연속값은 store 금지, ref+useFrame). 공전각은 엔진 draw가 아닌 렌더 시간 함수라 GEN_VERSION·결정론과 무관. LOD 거리 밖에선 기존처럼 visible=false로 비용 제거.

---

### 5. 동반성 분광형과 주성의 관계

| Option | Pros | Cons |
|--------|------|------|
| A: 주성 이하로 제약 (질량 ≤ 주성) | 실제 주성-반성 관계와 일치, '주성이 주인공'이라 시각 위계 명확, append draw는 가중치 재정규화로 간단 | 동반성이 주성보다 밝을 가능성 제거(약간의 다양성 손실) |
| B: 독립 추첨 | 구현 최단순, 더 다양 | 때론 반성이 더 밝아 주/반 구분 모호 |

**Chosen:** 주성 이하로 제약
**Reason:** 주성-반성 위계가 시각·정보 표시 모두에서 명확해진다. 주성 분광형 인덱스 이상(질량 동급 이하)만 남긴 가중치를 재정규화해 추첨 — 간단하고 결정론적.

---

### 6. 삼중성 궤도 구조 (스펙 확정 사항)

| Option | Pros | Cons |
|--------|------|------|
| A: 계층형 (근접 쌍 + 원거리 제3성) | 유일하게 역학적으로 안정(실제 삼중성 형태), 렌더 배치 명확 | — |
| B: 평면 등거리 3성 | 단순 배치 | 물리적으로 불안정(비현실), 사실성 미학 위배 |

**Chosen:** 계층형 (companion[0]=inner 근접, companion[1]=outer 원거리)
**Reason:** 알파 센타우리(α Cen A/B + Proxima)처럼 실제 삼중성은 모두 계층형. 사실성 미학에 부합하고 separation 범위를 hierarchy로 분기하면 배치도 결정적. 사용자 합의로 스펙에 고정(별도 옵션 질문 생략).

---

### 7. GEN_VERSION 처리

| Option | Pros | Cons |
|--------|------|------|
| A: 4로 범프 + 골든 재생성 | 철칙 2 준수, 출력에 신규 필드 추가 사실 명시 | 기존 Profile 버전 불일치 모달(의도된 동작) |
| B: 범프 없이 진행 | 모달 없음 | 철칙 위반 — 골든 스냅샷 변경을 은폐, 금지 |

**Chosen:** 4로 범프
**Reason:** 동반성 draw가 'star' 스트림 *값*은 보존하지만, 우주 출력에 `multiplicity`·`companions` **신규 필드가 추가**되어 골든 스냅샷이 바뀐다 → 철칙 2에 따라 범프 필수. **백로그의 "GEN_VERSION 3" 메모는 정정**: 현재값이 이미 3(v3=수직 두께 렌즈, 결정 32)이므로 실제 목표는 **4**. version.ts 주석과 본 결정 시트에 사유 기록.

---

### 8. 행성 배치 — 분리거리 적응 (렌더 전용)

| Option | Pros | Cons |
|--------|------|------|
| A: 분리거리 기반 적응 (근접=주위연성 / 원거리=주성 궤도) | 천문학적 사실성(P-type vs S-type), `planetsOf` 생성 draw 불변(행성 골든 보존) | 궤도 중심 분기 로직 필요 |
| B: 항상 주성 궤도 | 단순 | 근접 쌍성에서 행성이 한 별만 도는 비현실 |

**Chosen:** 분리거리 기반 적응 (렌더 시 궤도 중심만 변경)
**Reason:** B-모델의 행성 사실성을 생성 분포 변경 없이 흡수하는 핵심 트릭. `planetsOf()`는 그대로 두고 *렌더 배치 기준점*만 근접 쌍성=질량중심, 원거리=주성으로 분기 → 행성 생성 골든 값 100% 보존, GEN_VERSION 영향은 별 스트림 한정.

---

## 철칙 준수 체크리스트

- [x] **engine/ 순수성** — 동반성 생성은 기존 rngFor·weighted만 사용, 외부 패키지·초월함수 무도입. 질량중심·공전은 렌더(scenes/) 책임.
- [x] **GEN_VERSION 규칙** — 3 → 4 범프 + version.ts·본 시트 사유 기록 + 골든 재생성.
- [x] **draw append-only** — 주성 'star' 스트림 기존 4 draw 뒤에만 추가, 순서 변경/삽입 없음. `planetsOf` 무변경.
- [x] **생성물 저장 금지** — 동반성은 저장 대상 아님, 항상 재생성.
- [x] **R3F 규율** — 공전각은 ref+useFrame, store 금지. 콜아웃 텍스트는 DOM 레이어.
- [x] **Sol 예외 보존** — `SOL_STAR` 조기 반환으로 동반성 draw 미실행 → LIFE1 무영향.

## Architecture (added by /yc:plan, 2026-06-15)

### 9. 별 운동·질량중심·임계값의 책임 레이어 분리

| Option | Pros | Cons |
|--------|------|------|
| A: 엔진은 raw draw만, 운동·질량·임계값은 렌더 | engine/ 순수성 유지(초월함수·질량 룩업 없음), 결정론 영향 최소 | 분리 규칙이 렌더에 흩어짐 |
| B: 질량중심·circumbinary 판정도 엔진 | 단일 소스 | engine/ 순수성 위반(질량·임계 = 렌더 관심사), 불필요한 결정론 결합 |

**Chosen:** A — 엔진은 `multiplicity`·`companions`(spectral/separation/eccentricity/phase)만 draw. 질량 룩업·질량중심·공전각·circumbinary 임계값은 모두 `scenes/` 렌더 레이어. `separation`은 추상 AU-유사 수치(엔진 draw)이고 렌더가 스케일·임계를 해석.

---

### 10. systemGroup 원점 = inner barycenter (행성 배치의 열쇠)

| Option | Pros | Cons |
|--------|------|------|
| A: 원점 = inner barycenter, 주성이 그 주위 공전 | 근접 쌍성에서 **행성이 원점 궤도 = 자동 circumbinary**, 단일성은 주성=원점이라 기존과 동일(무회귀) | 주성이 화면 중앙에 고정 안 됨(공전) — 의도된 사실성 |
| B: 원점 = 주성 (항상 중앙 고정) | 주성 항상 중앙 | circumbinary 구현이 오프셋 지옥 |

**Chosen:** A — 원점은 inner barycenter. 단일성은 barycenter=주성이라 기존 렌더 100% 호환. 행성은 `planetCenter` 그룹으로 감싸 위치를 매 프레임 지정: circumbinary면 (0,0,0)=barycenter, S-type(원거리)이면 주성의 현재 오프셋을 따라간다.

---

### Structure (영향 파일)

```
src/
├── engine/
│   ├── galaxy/sectors.ts        # ★ Multiplicity·Companion 타입 + append draw + SOL_STAR 필드
│   ├── galaxy/sectors.test.ts   # ★ 분포·제약·계층·append-only 값 보존 테스트
│   ├── version.ts               # ★ GEN_VERSION 3 → 4 + 사유 주석
│   └── index.ts                 # ★ Multiplicity·Companion 타입 export
├── scenes/
│   ├── system/multiplicity.ts   # ☆ 신규 — SPECTRAL_MASS, 질량중심·공전 위치 helper, circumbinary 판정
│   ├── system/CurrentSystem.tsx # ★ 별 N개 렌더·N개 광원·planetCenter 그룹
│   ├── system/StarSurface.tsx   # (재사용 — 변경 없음, color/radius 주입)
│   └── galaxy/spectral.ts       # (SPECTRAL_MASS를 여기 둘지 multiplicity.ts에 둘지는 구현 시)
├── ui/hud/
│   ├── StarInfoPanel.tsx        # ★ 다중성 등급 + 구성별 분광형 행
│   └── SystemReadout.tsx        # ☆ (선택) 진입 리드아웃에 등급 suffix
└── tests/golden/
    └── universe.golden.test.ts  # ★ GEN_VERSION 단언 4, 스냅샷 재생성(-u)
```

### Key Interfaces

```typescript
// engine/galaxy/sectors.ts
export type Multiplicity = 'single' | 'binary' | 'triple'
export interface Companion {
  readonly spectral: SpectralClass     // 주성 이하 질량으로 제약
  readonly separation: number          // 추상 AU-유사 (렌더가 스케일·임계 해석)
  readonly eccentricity: number        // [0, ECC_MAX)
  readonly phase: number               // [0,1) → ×2π 초기 위상
  readonly hierarchy: 'inner' | 'outer'
}
export interface Star {
  /* 기존 5필드 불변 */
  readonly multiplicity: Multiplicity
  readonly companions: readonly Companion[]  // single:[] binary:1 triple:2(inner,outer)
}
```

### Core Flow (Pseudo-code)

```
// ── 엔진: starsInSector(), 기존 4 draw(localPos×3, spectral) 뒤에 append ──
multiplicity = starRng.weighted(MULTIPLICITY_WEIGHTS)  // single55 / binary33 / triple12
companionCount = single?0 : binary?1 : 2
for c in 0..companionCount:
  hierarchy = (triple && c==1) ? 'outer' : 'inner'
  cSpectral = starRng.weighted(companionWeightsAtMost(primary.spectral))  // 주성 이하만
  sepRange  = hierarchy=='outer' ? OUTER : binary ? BINARY : INNER
  separation   = sepRange.min + starRng.next()*sepRange.span
  eccentricity = starRng.next() * ECC_MAX
  phase        = starRng.next()
  companions.push({spectral:cSpectral, separation, eccentricity, phase, hierarchy})
// SOL_STAR(조기 continue)은 draw 미실행 → {multiplicity:'single', companions:[]}

// ── 렌더: scenes/system/multiplicity.ts (순수, three Vector3만) ──
SPECTRAL_MASS: Record<SpectralClass, number>  // O~16 … G~1 … M~0.3
massOf(spectral) → SPECTRAL_MASS[spectral]
// 두/세 별의 원점(inner barycenter) 상대 위치 — 시간 t의 타원 근사
bodyPositions(star, t) →
  single: [origin]
  binary: 질량비 r1=sep·m2/(m1+m2), r2=sep·m1/(m1+m2), 반대 위상, ellipse r(θ)=a(1-e²)/(1+e·cosθ)
  triple: 2단계 — 내부쌍(주성+inner)이 내부 barycenter Bi 주위, (Bi, outer)가 시스템 barycenter(원점) 주위
isCircumbinary(star) → 최근접 companion.separation < CIRCUMBINARY_THRESHOLD (triple은 항상 true)

// ── 렌더: CurrentSystem ──
bodies = [primary, ...companions]
for each body: <StarSurface color={SPECTRAL_RENDER[spectral].color} radius={mass^⅓ 스케일}/>  + <pointLight>
  → 위치는 ref + useFrame(bodyPositions(star, elapsed))
<group ref={planetCenter}>  // useFrame: circumbinary?(0,0,0):주성 현재 위치
  planets.map(...)  // 기존 그대로
</group>

// ── HUD: StarInfoPanel ──
rankLabel = single?∅ : binary?'쌍성계' : '삼중성계'
구성 = [primary.spectral, ...companions.map(c=>c.spectral)].join(' + ')  // 예: 'G + M'
```

> **결정론 무관 보장**: 공전각·질량중심·circumbinary 판정은 모두 렌더 시간/상수 함수 — 엔진 draw 아님. `planetsOf()` 무변경 → 행성·외계 골든 값 보존. 골든 변화는 오직 별 직렬화에 `multiplicity`·`companions` 필드가 추가되는 것뿐.

