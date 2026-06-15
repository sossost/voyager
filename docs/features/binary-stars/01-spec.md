# Feature Spec: 쌍성계 / 다중성계 (Binary & Multiple Star Systems)

**Status:** Confirmed
**Created:** 2026-06-15
**Author:** (brainstorm session)
**백로그 출처:** E-5(2차) #3 · G-c #3 "쌍성계(다중성계)"

---

## Overview

단일 항성만 생성하던 우주에 **쌍성·삼중성**을 도입한다. 동반성(companion)은
주성의 RNG 스트림 뒤에 **append-only draw**로 생성되어 기존 별의 위치·분광형을
한 비트도 바꾸지 않으며(값 보존), 질량중심(barycenter)을 공전하는 제2/제3태양으로
사실적으로 렌더된다. 출력에 새 필드가 추가되므로 **GEN_VERSION 3 → 4** 범프 +
골든 스냅샷 재생성이 수반된다.

동반성은 **은하 맵 노드를 새로 만들지 않는다** — 다중성계도 항법상 별 1개다.
사실성은 *시각·궤도*에 집중하고, 항법·행성계 분리(S/P-type 완전 분리)는 비범위로 둔다.

## User Goals

- 탐험가로서, 항성계마다 1·2·3개의 태양이 질량중심을 도는 모습을 보고 싶다 — 우주가 더 다양하고 사실적으로 느껴지도록.
- 탐험가로서, 별을 선택했을 때 그 계가 단일성인지 쌍성인지 삼중성인지, 각 별의 분광형이 무엇인지 알고 싶다.
- 기존 플레이어로서, 내가 이미 방문한 별들의 위치·이름·분광형이 그대로 유지되길 바란다(동반성 추가가 기존 우주를 깨지 않도록).

## Behavior

### Happy Path

1. 플레이어가 은하 맵/우주선 뷰에서 항성계로 진입한다.
2. 그 계가 다중성이면 중앙에 주성, 그 주위를 동반성(들)이 질량중심 기준으로 공전한다.
   - **쌍성**: 주성 + 동반성 1개가 공통 질량중심을 공전(편심 궤도).
   - **삼중성(계층형)**: 근접 쌍(주성 + 내부 동반성)이 가까이 공전하고, 외부 동반성이 그 쌍의 질량중심을 멀리서 공전.
3. 각 별은 분광형에 맞는 크기·색·광도로 렌더되고, 별마다 point light가 행성을 비춘다.
4. 행성 배치는 분리거리에 적응한다:
   - **근접 쌍성**: 행성이 계의 질량중심을 도는 **주위연성 궤도(circumbinary, 타투인식)**.
   - **원거리 쌍성**: 행성은 주성 궤도를 돌고, 동반성은 멀리 빛나는 제2태양.
5. 플레이어가 별을 선택하면 콜아웃/StarInfoPanel에 등급과 구성별 분광형이 표시된다 (예: "쌍성계 · G2V + M4V").

### Error Cases

- **Sol(태양) 진입**: 태양은 단일성이다. `starsInSector`에서 `SOL_STAR` 조기 반환으로 동반성 draw를 타지 않는다 → 항상 단일 태양으로 렌더. LIFE1 시작 항성계(Sol) 무영향.
- **버전 불일치 부트**: 기존 Profile의 `genVersion`이 3이면 부트에서 기존 안내 모달(결정 13 메커니즘)이 뜬다. 마이그레이션은 v2 비범위.

### Edge Cases

| Situation | Expected Behavior |
|-----------|-------------------|
| 다중성계가 LOD 거리(`SYSTEM_LOD_DISTANCE`) 밖 | 기존과 동일하게 `group.visible=false` — 동반성·궤도 드로콜 제거. 은하 맵에선 여전히 포인트 스프라이트 1개. |
| 워프 중(`scene.kind==='warping'`) | 기존과 동일하게 `StarSurface` 렌더 중단 — 동반성도 함께 중단. |
| 동반성 분광형이 주성과 동일 | 허용. 크기·색 대비가 약해지지만 궤도 위치로 구분됨. |
| 근접 쌍성인데 행성이 0개 | 주위연성 궤도만 빈 채(행성 없음) — 두 별만 공전. |
| reduced-motion 환경 | 공전 애니메이션은 useFrame 기반 연속값 — reduced-motion 시 정지 또는 저속(렌더 정책에 따름). 별 위치는 결정론 초기 위상으로 정적 표시 가능. |
| 삼중성에서 외부 동반성이 매우 원거리 | 외부 별은 화면 밖일 수 있음 — 정상. 콜아웃엔 3개 분광형 모두 표기. |

## Interface Design

### Data Model

`Star` 타입에 다중성 정보를 추가한다 (append-only — 기존 필드 순서/의미 불변):

```typescript
export type Multiplicity = 'single' | 'binary' | 'triple'

export interface Companion {
  /** 주성 대비 동반성. 계층형 삼중성에서 hierarchy로 역할 구분. */
  readonly spectral: SpectralClass        // 주성 이하로 제약 (질량 ≤ 주성)
  readonly separation: number              // 질량중심/주성 기준 궤도 반장축 (게임 스케일)
  readonly eccentricity: number            // [0, ~0.6) 편심
  readonly phase: number                   // [0, 1) 초기 공전 위상 (×2π)
  readonly hierarchy: 'inner' | 'outer'    // 삼중성: inner=근접 쌍, outer=원거리 제3성
}

export interface Star {
  readonly id: StarId
  readonly sector: SectorCoords
  readonly localPos: readonly [number, number, number]
  readonly spectral: SpectralClass         // = 주성 분광형
  readonly name: string
  // --- append-only 신규 ---
  readonly multiplicity: Multiplicity
  readonly companions: readonly Companion[] // single: [] / binary: 1 / triple: 2
}
```

> **질량비**는 별도 draw가 아니라 분광형에서 결정론적으로 도출(spectral→mass 룩업)한다 — draw 최소화. 질량중심·광도 대비는 렌더 시 계산.

### Generation (engine) — append-only draw 설계

주성 스트림 `rngFor(seed, 'star', id)`의 기존 draw 순서:
`localPos.x → localPos.y → localPos.z → spectral` **(불변)**.

그 **뒤에** 다음을 append한다 (Sol은 조기 반환으로 미실행):

```
DRAW 5: multiplicity  = weighted(MULTIPLICITY_WEIGHTS)   // single 55 / binary 33 / triple 12
// 동반성 수: single→0, binary→1, triple→2
for each companion:
  DRAW: companion.spectral      = weighted(spectral weights, 주성 이하로 클램프)
  DRAW: companion.separation    = SEP_MIN + next() * SEP_SPAN  (hierarchy별 범위)
  DRAW: companion.eccentricity  = next() * ECC_MAX
  DRAW: companion.phase         = next()
```

- 삼중성은 **계층형 고정**: companion[0].hierarchy='inner'(근접), companion[1].hierarchy='outer'(원거리). separation 범위가 hierarchy로 분기.
- `planetsOf()`는 **변경 없음** — 행성 생성 draw·분포 불변. 행성의 *궤도 중심*만 렌더 시 분리거리에 따라 적응(circumbinary vs 주성).

### Components (rendering)

- **`CurrentSystem`** — 주성 1개 렌더에서 `star.companions`를 순회해 동반성 메시 + point light + 공전 궤도를 추가. 질량중심 계산 후 별 위치를 useFrame으로 갱신(ref만, store 금지).
- **`StarSurface`** — 동반성에도 재사용(분광 색·크기 주입). 변경 최소.
- **행성 궤도 중심** — `OrbitRing`/`Planet` 배치 기준점이 근접 쌍성이면 질량중심, 아니면 주성.
- **`StarInfoPanel` / 콜아웃** — 등급 라벨(단일/쌍성/삼중성) + 구성별 분광형 나열.

### Spectral 관계

- 동반성 분광형은 전체 가중치에서 뽑되 **주성 분광형 이하(질량 ≤ 주성)로 제약**한다 (O>B>A>F>G>K>M 질량 순). 구현은 주성 인덱스 이상만 남긴 가중치 재정규화.

## Acceptance Criteria

- [ ] WHEN 비-Sol 별이 생성될 때 THE SYSTEM SHALL 주성 'star' 스트림의 기존 4 draw(localPos×3, spectral) 값을 변경 없이 보존한다 (골든으로 검증).
- [ ] THE SYSTEM SHALL 전체 항성계의 약 45%(±오차)를 다중성으로 생성한다 (single≈55% / binary≈33% / triple≈12%).
- [ ] WHERE 삼중성일 때 THE SYSTEM SHALL companion 2개를 계층형(inner 근접 + outer 원거리)으로 생성한다.
- [ ] THE SYSTEM SHALL 모든 동반성의 분광형을 주성 분광형 이하(질량 ≤ 주성)로 제약한다.
- [ ] WHILE 다중성계가 LOD 거리 안에서 렌더되는 동안 THE SYSTEM SHALL 각 별을 질량중심 기준으로 실시간 공전시킨다(편심 반영, ref+useFrame, store 미사용).
- [ ] THE SYSTEM SHALL 별마다 분광 색의 point light를 배치해 행성을 이중/삼중 조명한다.
- [ ] WHERE 근접 쌍성일 때 THE SYSTEM SHALL 행성 궤도 중심을 계 질량중심에 둔다(주위연성). WHERE 원거리 쌍성일 때 주성에 둔다.
- [ ] WHEN 다중성계 별을 선택할 때 THE SYSTEM SHALL 콜아웃에 등급과 구성별 분광형을 표시한다.
- [ ] IF 별이 Sol(`SOL_STAR_ID`)이면 THEN THE SYSTEM SHALL 단일성으로 처리하고 동반성 draw를 실행하지 않는다.
- [ ] THE SYSTEM SHALL `planetsOf()`의 행성 생성 draw·분포를 변경하지 않는다(행성 골든 값 보존).
- [ ] THE SYSTEM SHALL `GEN_VERSION`을 4로 올리고 `tests/golden/` 스냅샷을 재생성하며 사유를 02-decisions·version.ts에 기록한다.
- [ ] THE SYSTEM SHALL engine/ 순수성 철칙(외부 패키지·브라우저 API·초월함수·전역 난수 금지)을 유지한다.

## Scope

**In Scope:**
- `Star` 타입 확장(`multiplicity`, `companions`) + append-only 동반성 draw
- 동반성 렌더(메시·코로나·point light) + 질량중심 실시간 공전(편심)
- 분리거리 기반 행성 궤도 중심 적응(circumbinary ↔ 주성)
- StarInfoPanel/콜아웃 다중성 표시(등급 + 구성별 분광형)
- GEN_VERSION 4 범프 + 골든 재생성 + 단위/E2E 테스트 갱신

**Out of Scope:**
- 동반성을 은하 맵의 **별도 항법 노드**로 만들기(선택·워프 대상 분리)
- 동반성 **자체 행성계** 분리(완전 S-type/P-type 분리, 동반성 주위 독립 행성)
- 식변광(eclipsing binary) 광도 변화, 별 표면 조석 변형
- 쌍성 안정성 게임플레이(항행 위험·탐사 보상·불안정 궤도)
- 질량중심 물리 정밀 시뮬레이션(케플러 정밀 해 — 시각 근사로 충분)

## Open Questions

- [ ] 공전 주기(시각 속도) 튜닝 값 — 너무 빠르면 어지럽고 느리면 정적. 구현 후 실측 조정.
- [ ] 근접/원거리 쌍성 분리 임계값(circumbinary 전환점)의 구체 수치 — /yc:plan에서 게임 스케일에 맞춰 결정.
- [ ] 동반성 코로나/Bloom 강도가 주성을 압도하지 않는지 — 렌더 실측.
