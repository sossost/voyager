# Feature Spec: 이색 천체 (Exotic Celestial Bodies)

**Status:** Confirmed (brainstorm) — 적대 검증 1회 반영(2026-06-15)
**Created:** 2026-06-15
**Author:** (brainstorm session)
**백로그 출처:** G-c-9 "이색 천체: 블랙홀·성운·펄서 등" (`04-backlog.md:141`)

---

## Overview

주계열성만 존재하던 우주에 **이색 천체 4종**을 도입한다: **적색거성 · 백색왜성 · 펄서(중성자성) · 블랙홀**.
이들은 `Star` 타입에 추가되는 **`kind` 필드**로 표현되며, 주성 RNG 스트림의 기존 draw들
(localPos×3 · spectral · multiplicity · companions×N) **전부 뒤, 진짜 마지막 draw**로 append된다 — 기존 별의
위치·분광형·다중성 값을 한 비트도 바꾸지 않는다(값 보존, 골든으로 검증). 출력에 새 필드가 추가되므로
**GEN_VERSION 4 → 5** 범프 + 골든 스냅샷 재생성이 수반된다.

이색 천체는 **별도 항법 노드가 아니라 기존 별 노드 그 자체**다 — `StarId`·피킹·워프·콜아웃의 *데이터 배선*을
재사용한다(렌더 분기 코드는 신규). 워프해서 도달하면 일반 항성 대신 그 천체가 렌더된다. 희귀도는 분광형에
종속되어 결정론적으로 도출하며(블랙홀·펄서는 대질량 O/B 계에서만, 적색거성·백색왜성은 더 흔하게), 블랙홀은
풀스크린 포스트셰이더 없이 **그림자 + 도플러 강착원반 + 비대칭 포톤 호**의 가산 빌보드 적층으로
"실사 가르강튀아 실루엣"을 그린다(결정 5).

게임플레이는 **시각 명소 + 가벼운 현상 도감**이다. 이색 천체로 워프하면(=방문) 발견 기록(`Discovery`)이
`addVisit`과 **동일 persist 트랜잭션**에 커밋되고(결정 16 준수), 도감의 "현상" 탭이 채워진다 — 저장 포맷
확장이지만 부트 차단(`GEN_VERSION`)과는 독립이다(결정 7).

성운(볼류메트릭)·항행 위험·탐사 보상 미니게임은 **명시적 비범위**로 둔다(결정 2·9).

## User Goals

- 탐험가로서, 우주를 항해하다 적색거성·백색왜성·펄서·블랙홀 같은 **희귀하고 극적인 천체**를 발견하고 싶다 — 우주가 단조롭지 않도록.
- 탐험가로서, 블랙홀에 워프해 다가가 **사건지평선과 강착원반의 실사적 모습**을 가까이서 보고 싶다.
- 수집가로서, 내가 발견한 이색 천체가 **도감(현상 탭)에 기록**되어 발견의 성취가 남길 바란다.
- 항법가로서, 은하 맵에서 어느 노드가 이색 천체인지 **색·크기로 구분**해 목적지로 삼고 싶다.
- 기존 플레이어로서, 내가 이미 방문한 별들의 위치·이름·분광형·다중성이 **그대로 유지**되길 바란다(`kind` 추가가 기존 우주를 깨지 않도록).

## Behavior

### Happy Path

1. 플레이어가 은하 맵에서 일반 별과 색·크기가 다른 노드(예: 깊은 주황의 거대 점 = 적색거성, 전기 청백의 점 = 펄서, 어두운 코어+밝은 링 = 블랙홀)를 발견한다.
2. 그 노드를 선택하면 콜아웃/StarInfoPanel에 천체 종류(예: "블랙홀", "펄서 · 중성자성", "적색거성 K형")가 표시된다.
3. 플레이어가 워프를 발동한다. **워프 커밋 시점**(연출 시작 전, 결정 16)에 그 별이 이색 천체이면 `addVisit`과 **같은 persist() 트랜잭션**으로 `Discovery{ starId, kind, discoveredAt, isFirst }`가 기록된다. 해당 `kind` 최초 발견이면 `isFirst:true` + "최초 발견" 토스트.
4. 워프 도착 후 `CurrentSystem`이 일반 `StarSurface` 대신 그 천체를 렌더한다:
   - **적색거성**: 크게 부푼 차갑고 붉은 표면(`StarSurface`에 emissive/코로나 prop 확장 — 결정 5 참조, 무변경 재사용은 아님). 반경은 위계 상한 클램프.
   - **백색왜성**: 아주 작고 뜨거운 청백 표면(`StarSurface` prop 확장).
   - **펄서**: 작은 중성자성 본체 + 자전하는 좁은 가산 제트 콘 2개(양극) + 주기 점멸(광과민성 상한 준수).
   - **블랙홀**: 검은 사건지평선 구 + 기울어진 도플러 강착원반(한쪽이 밝음) + **비대칭 포톤 호**(원반 평면의 부분 호 — 구를 감싸는 풀-원형 헤일로 아님, 결정 31 준수). 중력렌즈 없음(결정 5).
5. 도감의 "현상" 탭을 열면 4종 아키타입(적색거성·백색왜성·펄서·블랙홀)이 발견/미발견 상태·발견 수·최초 발견 뱃지·로어와 함께 표시된다.

### Error Cases

- **Sol(태양) 진입**: 태양은 항상 주계열성이다. `starsInSector` 루프 내 `id === SOL_STAR_ID` 분기 `continue`(`sectors.ts:157`)로 `starRng` 블록 전체(따라서 `kind` draw)를 건너뛴다 → 항상 `kind:'main_sequence'`. LIFE1 시작 항성계(Sol) 무영향.
- **GEN_VERSION 불일치 부트**: 기존 Profile의 `genVersion`이 4이면 부트에서 기존 안내 모달(본 시트 결정 13 메커니즘, `BootGate.tsx:86`이 `genVersion`만 비교)이 뜬다. 마이그레이션은 v2 비범위.
- **이색 천체에 행성·생명 생성**: `planetsOf()`·`alienAt()` 무변경이라 이색 천체 계에도 행성·생명이 생성될 수 있다(블랙홀계 생명행성 등). 비현실 quibble은 **결정론 보존을 위해 v1에서 수용**(Open Question) — 에러가 아니라 의도된 동작.

### Edge Cases

| Situation | Expected Behavior |
|-----------|-------------------|
| 이색 천체가 LOD 거리(`SYSTEM_LOD_DISTANCE`) 밖 | 기존과 동일하게 `group.visible=false` — 본체·강착원반·제트 드로콜 제거. 은하 맵에선 여전히 포인트 1개(+블랙홀 링 빌보드). |
| 워프 중(`scene.kind==='warping'`) | 기존과 동일하게 본체 렌더 중단 — 강착원반·제트도 함께 중단. 도착 후 `WarpFlashOverlay` 피크에 crossfade로 fade-in. |
| **이색 천체가 다중성계(쌍성·삼중성)의 주성** | `kind`는 **주성에만** 존재(append 위치 = 주성 스트림). `CurrentSystem`이 `bodies[0]`(=주성)일 때 `star.kind`로 본체를 `ExoticBody`로 디스패치, `companions`(bodies[1+])는 항상 `StarSurface`. 본체 위치·공전·광원은 `multiplicity.ts`의 `bodyPositions[0]`을 그대로 사용(kind는 위치 수학을 바꾸지 않음). 질량중심은 `massOf(spectral)` 유지 — **블랙홀·펄서는 O/B에서만 나오므로(결정 4) 주성이 이미 최대 질량 = 질량중심 정합**(결정 7). |
| `Companion`에 `kind` 없음 | `Companion` 타입(`sectors.ts:53-63`)은 **무변경** — 동반성은 분광형 기반 일반 별로 자동 렌더(결정 7). |
| 블랙홀/펄서 계에 행성 존재 | `planetsOf()` 무변경이라 행성은 생성·렌더된다(골든 보존). 본체 시각 반경이 `multiplicity.ts` clearance 계산에 참여해 행성/동반성 관통을 막는다(쌍성계 결정 10 메커니즘 재사용). |
| reduced-motion 환경 | **코드베이스에 reduced-motion 인프라가 현재 없음**(useReducedMotion·prefers-reduced-motion 미구현). 펄서 점멸·강착원반 회전·자전의 reduced-motion 정지/정적 처리는 `/yc:plan`에서 렌더 정책으로 신규 설계(Open Question). |
| 펄서 점멸 광과민성 | 점멸 주파수 상한(≤3Hz 권장)·대비 상한으로 광과민성 발작 위험 차단. reduced-motion 시 정적. |
| 적색거성이 행성보다 시각적으로 압도 | 결정 27(별이 항상 행성의 2배+) 위계 유지 — 적색거성 반경 상한 클램프로 행성을 완전히 가리지 않게. |

## Interface Design

### Data Model

`Star` 타입에 `kind` 한 필드를 추가한다 (append-only — 기존 필드 순서/의미 불변). `Companion`은 무변경:

```typescript
export type StarKind =
  | 'main_sequence'   // 일반 항성 (기본·압도적 다수)
  | 'red_giant'       // 적색거성 — 부푼 차가운 표면
  | 'white_dwarf'     // 백색왜성 — 작고 뜨거운 잔해
  | 'pulsar'          // 펄서/중성자성 — 자전 제트 + 점멸
  | 'black_hole'      // 블랙홀 — 그림자 + 강착원반

export interface Star {
  readonly id: StarId
  readonly sector: SectorCoords
  readonly localPos: readonly [number, number, number]
  readonly spectral: SpectralClass
  readonly name: string
  readonly multiplicity: Multiplicity
  readonly companions: readonly Companion[]   // Companion 타입 무변경 (kind 없음)
  // --- append-only 신규 (GEN_VERSION 5) ---
  readonly kind: StarKind
}
```

> `kind`는 **주성 Star에만** 존재. 블랙홀·펄서도 `spectral`은 가진다(전구체 분광형 — O/B). 렌더는 `kind`로 분기하며 적색거성·백색왜성은 `spectral`을 색 틴트에, 블랙홀·펄서는 `spectral`을 질량중심 계산(massOf)에만 쓰고 표면 색엔 무시. **모델은 `kind` 한 필드만 추가**해 최소화. `kind`를 required로 추가하므로 `SOL_STAR` 상수에 `kind:'main_sequence'`를, `starsInSector` 내부에 draw를 더하면 모든 Star 생성 경로(starById·useGalaxyStars는 starsInSector 재사용)가 자동 충족된다(`SOL_STAR` toEqual 단위 테스트는 동시 갱신).

### Generation (engine) — append-only draw 설계

주성 스트림 `rngFor(seed, 'star', id)`의 기존 draw 순서:
`localPos.x → .y → .z → spectral → multiplicity → [companions: 0/4/8 draw 가변]` **(불변)**.

그 **전부 뒤, 진짜 마지막 draw**로 다음을 append한다 (Sol은 루프 내 분기 continue로 미실행):

```
DRAW (마지막): kind = weighted(KIND_WEIGHTS_BY_SPECTRAL[spectral])
```

- **append-only 불변식**: companions 개수(single 0 / binary 4 / triple 8 draw)와 **무관하게** `kind`는 그 뒤에 온다. `weighted()`는 가중치 테이블과 무관하게 정확히 `next()` 1회를 소비하므로(`streams.ts:71`) 분광형별 분기가 draw 수를 바꾸지 않는다(결정 4) → 기존 5+N draw 값 비트 보존.
- **분광형 종속 가중치**(결정 4): 테이블만 분광형으로 분기해 *결과 매핑*을 사실적으로.
  - **O/B (대질량, 합 정확히 4%)**: `main_sequence` 다수 + `black_hole`·`pulsar`(이들의 진화 종착) + 약간의 `red_giant`. → 블랙홀·펄서는 O/B 계(4%)에서만.
  - **A/F/G (중간 질량)**: `main_sequence` 압도 + 소량 `white_dwarf`·`red_giant`.
  - **K/M (저질량, 다수)**: `main_sequence` 압도 + 소량 `red_giant`·드물게 `white_dwarf`.
  - 정확한 weight 수치는 `/yc:plan`에서 확정(이 스펙은 *형태*만 고정). **골든 재생성 전 잠금**, 특히 프로브 섹터(2,0,3)의 두 'F'형 별(`snap:2182,2214`)이 `main_sequence`로 유지되도록 `KIND_WEIGHTS_BY_SPECTRAL['F']`를 검산(결정 9).
- `planetsOf()`·`alienAt()`·`moons.ts`·`drawCompanions()`는 **변경 없음** — 행성·외계·위성·동반성 생성 draw·분포 불변(그들 골든 값 보존).
- **Sol**: `SOL_STAR` 상수에 `kind:'main_sequence'` 추가. 루프 내 분기 `continue`로 `kind` draw 미실행.

### Components (rendering)

> 모든 천체 수학(자전·도플러 위상·제트 방향·강착원반 기울기/회전)은 **렌더 시간/상수 함수**라 `scenes/`에 둔다 — 엔진 draw 아님, GEN_VERSION 무관(결정 6, 쌍성계 결정 9 선례). 책임 경계: `scenes/system/exotic.ts`(신규) = 단일 천체 형태/애니 파라미터, `scenes/system/multiplicity.ts`(수정) = 다체 배치·질량중심·clearance에 `kind`별 본체 반경 합성.

- **`CurrentSystem`(수정)** — `bodies = [primary, ...companions]`를 순회하며 `index===0 && star.kind !== 'main_sequence'`이면 `<ExoticBody kind={star.kind} spectral radius pos/>`로, 그 외(동반성·일반 주성)는 `<StarSurface>`로 디스패치. 위치·`pointLight`는 기존 `bodyPositions`/광원 경로 공유(블랙홀은 강착원반 발광색의 dim pointLight로 행성·동반성 조명 유지).
- **`StarSurface`(prop 확장)** — 현재 prop은 `{radius, color}` 2개뿐(`StarSurface.tsx:123-129`). 적색거성(차갑고 큰)·백색왜성(작고 고휘도 청백) 구분을 위해 **emissive/코로나 강도 prop을 추가**한다(셰이더 소폭 확장 — "무변경 재사용" 아님).
- **`AccretionDisk`(신규, BlackHole 내부)** — `PlanetRings`에서 재사용 가능한 건 **링 지오메트리 + 라디얼-UV 재매핑뿐**(`ringTexture.ts`는 토성 전용 하드코딩). 도플러 비대칭 발광·가산 블렌딩·고온 라디얼 그라디언트·회전은 **전부 신규 머티리얼/텍스처**.
- **`BlackHole`(신규)** — ① 검은 사건지평선 구(불투명, depthWrite) ② `AccretionDisk`(기울인 평면 디스크, 도플러 비대칭) ③ **비대칭 포톤 호**: 도플러 밝은 쪽 + 렌즈드 상단 호를 흉내내는 **원반 평면의 부분 호 가산 빌보드(크레센트)** — 구를 감싸는 풀-원형 헤일로/막 아님(결정 31). 포스트프로세싱 0(결정 5).
- **`Pulsar`(신규)** — 작은 중성자성 본체 + 자전축 정렬 가산 제트 콘 2개(좁은 핫코어, 결정 26 준수) + 주기 점멸(가산 강도 애니, Bloom 비의존, 광과민성 상한).
- **은하 맵 노드(`GalaxyStarField` 수정)** — `starBaseAttributes(star)`가 `star.kind`를 읽어 `EXOTIC_RENDER` 색/크기로 분기(적색거성=거대 주황 / 백색왜성=작은 청백 / 펄서=전기 청백). 1 draw call·좌표 기반 피킹(`useStarPicking`) 유지. **블랙홀만** 순수 어두운 점이 안 보이므로 작은 가산 링 빌보드 시블링을 줌게이팅으로 추가(결정 10·11).
- **`StarInfoPanel`/콜아웃(수정)** — `kind` 라벨 + (적색거성/백색왜성은 분광형 병기).
- **`CodexOverlay`(탭 인프라 신규)** — 현재 탭 구조 없음(단일 종족 그리드, `CodexOverlay.tsx:60-133`). 탭 셸로 리팩터: 탭1 "외계생명체"(기존 그리드 이전) + 탭2 "현상"(신규, 4종 아키타입 발견 상태). a11y: `role=tablist/tab/tabpanel` + 키보드 내비. 아키타입 메타데이터는 정적 모듈(`phenomena.ts`, 저장 대상 아님).

### Persistence (현상 도감)

```typescript
// persistence/types.ts — 신규 (저장 대상: 플레이어 기록, 철칙 4 준수)
export interface PhenomenonDiscovery {
  readonly starId: StarId        // 식별자만 저장 — 종류명·로어·희귀도는 읽을 때 재생성
  readonly kind: StarKind        // 도감 집계 편의용 비정규화
  readonly discoveredAt: number  // epoch ms
}
// 옵션 b 확정 — 별도 테이블 아님 (결정 8·13):
export interface Profile { /* 기존 + */ readonly discoveredPhenomena?: readonly PhenomenonDiscovery[] }
```

- **네이밍**: 기존 `discoveredSpecies`(종족 수집, `store/types.ts:72`)와 구분 — 레코드 `PhenomenonDiscovery`, 필드 `discoveredPhenomena`. "최초 발견"(`isFirst`)은 저장하지 않고 기록 시점에 배열에서 파생(단일 소스).
- **발견 트리거**: `warpTo`(`createGameStore.ts:131-135`)에서 목적지가 이색 천체이면 **`addVisit`과 동일 persist() 콜백**에서 `saveProfile(buildProfile())`로 함께 커밋(결정 16: 연출 *전* 커밋, 중단돼도 안전). `onWarpComplete`(도착)에는 persist 없음 — 도착 훅에 새 사이드이펙트를 만들지 않는다(결정 7). `visitedAt = now()`를 한 번 뽑아 visit/discovery 공유.
- **저장 = Profile 내장 배열(옵션 b 확정, 결정 13)**: `Profile.discoveredPhenomena?` + 로드 시 `?? []`(`seenHints?` 선례). **Dexie 스키마·`StorageDriver` 계약·`MemoryDriver`·`driverContract` 전부 무수정**, `warpTo`가 이미 호출하는 `saveProfile`에 필드만 얹어 **신규 쓰기 경로 0**(철칙 5). 폴백 동등성은 profile 왕복이 `driverContract`로 기검증. (a) Dexie 테이블은 페이징 필요 시에만 — 별 발견은 visit과 1:1이라 불필요.
- **`saveVersion` 무범프**: `Profile.saveVersion`은 존재하나 **쓰이기만 하고 읽히지 않으며**(부트는 `genVersion`만 비교, `BootGate.tsx:86`), 옵셔널 필드라 기존 profile이 무중단 로드된다 → **SAVE_VERSION 범프 불필요**.
- 모든 쓰기는 `persist()` 단일 경로(철칙 5). Dexie liveQuery 금지(메모리 폴백 동등).

## Acceptance Criteria

- [ ] WHEN 비-Sol 별이 생성될 때 THE SYSTEM SHALL 주성 'star' 스트림의 기존 draw 전체(localPos×3 · spectral · multiplicity · companions×N, N∈{0,1,2})의 값을 변경 없이 보존한다(골든으로 검증).
- [ ] THE SYSTEM SHALL `star.kind`를 companions 개수와 무관하게 **기존 모든 draw 뒤 마지막 draw**로 생성한다(append-only, 순서 변경/삽입 없음).
- [ ] THE SYSTEM SHALL `kind`를 분광형 종속 가중치(`KIND_WEIGHTS_BY_SPECTRAL[spectral]`)에서 추첨하며, `black_hole`·`pulsar`는 spectral∈{O,B}인 별에서만 출현한다(분포 단위 테스트로 검증).
- [ ] THE SYSTEM SHALL 전체 exotic 비율을 long-tail로 유지한다 — 구체 상한은 `KIND_WEIGHTS` 잠금 시 O/B=4.00%(검증됨) 기반으로 산출해 분포 테스트 단언값으로 고정한다.
- [ ] WHEN 플레이어가 이색 천체 노드를 선택할 때 THE SYSTEM SHALL 콜아웃/패널에 그 `kind`를 표시한다(적색거성·백색왜성은 분광형 병기).
- [ ] WHILE 이색 천체가 LOD 거리 안에서 렌더되는 동안 THE SYSTEM SHALL `kind`별 전용 표현을 렌더한다(거성/왜성=StarSurface 변형, 펄서=제트+점멸, 블랙홀=그림자+강착원반+비대칭 포톤 호).
- [ ] WHERE 주성이 다중성계의 이색 천체일 때 THE SYSTEM SHALL `bodies[0]`을 `ExoticBody`로 디스패치하고 동반성은 `StarSurface`로 렌더하며, 본체 위치·질량중심을 기존 `multiplicity.ts` 경로로 계산한다.
- [ ] WHERE 블랙홀이 렌더될 때 THE SYSTEM SHALL 풀스크린 포스트프로세싱 없이 가산 빌보드 적층만으로 그리고, 포톤 호를 구를 감싸지 않는 부분 호로 렌더한다(결정 31·5 준수, no-Bloom 폴백 포함).
- [ ] IF 펄서 점멸이 렌더되면 THEN THE SYSTEM SHALL 점멸 주파수를 광과민성 상한(≤3Hz) 이하로 제한한다.
- [ ] WHEN 은하 맵에 이색 천체가 표시될 때 THE SYSTEM SHALL `EXOTIC_RENDER` 색·크기로 일반 별과 구분한다(블랙홀은 가산 링 빌보드 보강, 결정 27 위계 유지).
- [ ] WHEN 플레이어가 이색 천체로 워프할 때 THE SYSTEM SHALL `addVisit`과 동일 persist() 트랜잭션에서 `Discovery`를 기록하고, 해당 `kind` 최초면 `isFirst:true`로 표시한다.
- [ ] WHILE 현상 도감 탭이 열려 있는 동안 THE SYSTEM SHALL 4종 아키타입을 발견/미발견·발견 수·최초 발견 뱃지와 함께 표시하며, 탭 전환은 키보드로 조작 가능하다(role=tablist/tab/tabpanel).
- [ ] IF 별이 Sol(`SOL_STAR_ID`)이면 THEN THE SYSTEM SHALL `kind:'main_sequence'`로 처리하고 `kind` draw를 실행하지 않는다.
- [ ] THE SYSTEM SHALL `planetsOf()`·`alienAt()`·`moons.ts`·`drawCompanions()`의 생성 draw·분포를 변경하지 않는다(행성·외계·위성·동반성 골든 값 보존).
- [ ] THE SYSTEM SHALL `GEN_VERSION`을 5로 올리고(코드 반영 직전 version.ts 실측 후 확정) `tests/golden/` 스냅샷을 재생성하며, 재생성 diff가 별 직렬화에 `kind` 키 1개 추가로만 끝남을 수동 확인한다(그 외 변하면 STOP).
- [ ] THE SYSTEM SHALL `kind` 분포 단위 테스트(`sectors.test.ts` 스타일 sampleStars)를 추가해 O/B 한정·전체 비율 상한을 단언한다.
- [ ] THE SYSTEM SHALL engine/ 순수성 철칙(외부 패키지·브라우저 API·초월함수·전역 난수 금지)을 유지한다 — 천체 렌더 수학은 전부 scenes/.
- [ ] THE SYSTEM SHALL LIFE1 시드 E2E(coreLoop·memoryFallback)를 green으로 유지한다.

## Scope

**In Scope:**
- `Star` 타입 확장(`kind: StarKind`, `Companion` 무변경) + append-only 분광형 종속 `kind` draw + `SOL_STAR` 기본값
- 4종 천체 렌더: 적색거성·백색왜성(StarSurface prop 확장) / 펄서(제트+점멸) / 블랙홀(그림자+도플러 강착원반(신규 머티리얼)+비대칭 포톤 호, **풀스크린 포스트 없음**)
- 다중성계 주성이 이색일 때 `CurrentSystem` 디스패치 + `multiplicity.ts` clearance에 본체 반경 합성
- 은하 맵 노드 구분(`EXOTIC_RENDER` 색·크기 + 블랙홀 링 빌보드)
- StarInfoPanel/콜아웃 `kind` 표시
- 현상 도감: `Discovery` 기록(워프 커밋 트리거) + `phenomena.ts` 정적 아키타입 + `CodexOverlay` 탭 인프라 신규(외계생명체/현상)
- `GEN_VERSION` 5 범프 + 골든 재생성 + `kind` 분포 테스트 / 저장 포맷 확장(저장 위치는 plan 확정) / 단위·E2E 테스트 갱신

**Out of Scope:**
- **성운**(볼류메트릭/배경 색변조) — 별도 후속(결정 2). 결정 22/28/40 취향 지뢰밭이라 별도 brainstorm.
- **블랙홀 진짜 중력렌즈**(풀스크린/스크린스페이스 굴절) — high 티어 전용 후순위 사치 업그레이드(결정 5). v1은 페이크 적층만.
- **탐사 보상 미니게임**(scanPhenomenon 전용 진입점) — 도감은 워프 커밋 자동 기록으로 충분(결정 9).
- **항행 위험**(블랙홀 워프 방해·중력 효과) — 연출·상태 머신 신규 게임플레이 시스템, 명시적 비범위(결정 9).
- **동반성의 `kind`** — `Companion` 모델 무변경. 동반성은 일반 별 렌더.
- **이색 천체별 행성계 특수화**(블랙홀 행성 소멸·적색거성 내행성 삼킴 등) — `planetsOf` 무변경, 렌더 그대로. 후속 검토.
- **부트의 saveVersion 비교** — 현재 부트는 genVersion만 읽음. saveVersion 기반 마이그레이션 UX는 비범위.

## Open Questions

- [ ] `KIND_WEIGHTS_BY_SPECTRAL` 정확한 weight 수치 — `/yc:plan`에서 확정(골든 재생성 전 잠금 + 프로브 섹터 'F'별 검산).
- [ ] `Discovery` 저장 위치 — Dexie 별도 테이블(계약·폴백 확장 필요) vs Profile 내장 배열(최단순). `/yc:plan` persistence 구조 결정.
- [ ] 적색거성 반경 상한 클램프 값 — 결정 27 위계 유지하며 "부풂"이 읽히는 절충, 렌더 실측.
- [ ] 블랙홀 도플러 비대칭·포톤 호 강도 — "실사로 읽히되 막처럼 안 보이게", 렌더 실측.
- [ ] 펄서 점멸 주기(≤3Hz)·제트 길이 튜닝.
- [ ] reduced-motion 렌더 정책 — 코드베이스에 인프라 부재. 펄서 점멸·강착원반 회전의 정지/정적 처리를 어디서 어떻게(중앙 정책 신설 여부) `/yc:plan`에서 설계.
- [ ] 블랙홀계에 행성/생명이 생성되는 비현실을 v1에서 그대로 둘지(골든 보존) vs 렌더에서 숨길지 — 일단 그대로, 실측 후 결정.
