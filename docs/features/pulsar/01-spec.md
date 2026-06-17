# Feature Spec: 펄서(중성자성) 고품질 렌더

**Status:** Confirmed
**Created:** 2026-06-17
**Author:** (brainstorm session)
**백로그 출처:** G-c-9 "이색 천체: 블랙홀·펄서·백색왜성·적색거성" (`04-backlog.md`). 4종 중 **블랙홀만 main 머지**(GEN_VERSION 5+6)됐고, 펄서는 한때 `1e149cf`(Phase 3)에서 구현됐다가 PR 분할(`a1c8167`)로 제거됨. 본 피처는 그 펄서를 **블랙홀급 고품질로 재설계**해 별도로 출시한다.

---

## Overview

이색 천체의 두 번째 종 **펄서(중성자성)**를 도입한다. 블랙홀이 "측지선 레이마칭 중력렌즈"라는 단일 시그니처로 격을 만든 것처럼, 펄서는 **회전하는 등대 쌍극 빔**을 히어로로 삼아 "본 순간 펄서임을 아는" 천체로 만든다. 렌더는 블랙홀의 포스트이펙트 부담·NaN/Bloom 리스크를 피해 **인씬(in-scene) 셰이더 + high 티어 디테일**로 구현한다.

엔진은 기존 이색 천체 인프라(`StarKind` append, 분광형 종속 분포, 현상 도감)를 그대로 확장한다. 블랙홀과 달리 펄서는 **다중성계 주성이 될 수 있고 행성을 가진다**.

## User Goals

- 탐험가로서, 우주를 항해하다 **펄서**라는 희귀하고 극적인 천체를 발견해, 회전하는 등대 빔이 화면을 부드럽게 쓸고 지나가는 시그니처 비주얼을 보고 싶다.
- 도감 수집가로서, 발견한 펄서를 **현상 도감**에 기록하고 최초 발견을 남기고 싶다.
- 광과민성 사용자로서, 점멸·섬광이 안전 범위(완전 소등·급격한 대비 변화 없음)인 천체를 안심하고 보고 싶다.

## Behavior

### Happy Path

1. 플레이어가 은하 맵에서 일반 별과 색·크기가 다른 노드 — **전기 청백의 점**(펄서) — 을 발견한다.
2. 그 노드를 선택하면 콜아웃/`StarInfoPanel`에 천체 종류 **"펄서 · 중성자성"**(다중성계면 구성 분광형도)이 표시된다.
3. 워프로 진입하면 LOD 거리 안에서 **고품질 펄서 본체**가 렌더된다:
   - **히어로**: 자기축에 정렬된 **쌍극 빔 2개**가 자전과 함께 원뿔을 쓴다(자기축이 자전축과 어긋남). 빔이 카메라를 향할 때 화면이 **부드러운 글로우 펄스**로 밝아졌다 잦아든다(자전 주기, ≤안전 주파수, 완전 소등 없음).
   - **보조**: 자전축 정렬 **상대론적 쌍제트**(좁은 핫코어 가산), **초고온 청백 본체 + 자기극 폴라캡 핫스팟**.
4. 워프 진입(`WarpFlashOverlay` 피크)에 본체가 crossfade로 fade-in 한다(블랙홀과 동일 계약).
5. 펄서계에 **행성이 있으면** 그대로 생성·렌더되어 탐사할 수 있다(펄서 행성은 천문학적으로도 명분 있음 — PSR B1257+12).
6. 도감의 "현상" 탭에서 펄서 아키타입이 발견/미발견 상태·발견 수·최초 발견 뱃지·로어와 함께 표시된다.

### Error Cases

- **펄서가 LOD 거리 밖**: 기존과 동일하게 본체 group `visible=false` — 빔·제트·본체 드로콜 제거. 은하 맵에선 여전히 포인트 1개.
- **워프 중(`scene.kind==='warping'`)**: 본체 렌더 중단(빔·제트 포함). 도착 후 crossfade로 fade-in.
- **셰이더 안전성**: 빔·제트 셰이더는 블랙홀 교훈(`atan(0,0)`·`pow(0|음수,·)` NaN → high 티어 검은 화면) 준수 — 각도 normalize, 제곱은 `d*d`, 출력 clamp. Bloom mipmap 번짐 방지.

### Edge Cases

| Situation | Expected Behavior |
|-----------|-------------------|
| 펄서가 다중성계(쌍성·삼중성)의 주성 | `kind`는 **주성에만** 존재. `CurrentSystem`이 `bodies[0]`(주성)일 때 `star.kind==='pulsar'`로 본체를 펄서 렌더에 디스패치, `companions`(bodies[1+])는 항상 `StarSurface`. 본체 위치·공전·광원은 `multiplicity.ts`의 `bodyPositions[0]` 사용. 펄서는 O/B에서만 나오므로 주성이 최대 질량 = 질량중심 정합. |
| 펄서계에 행성 존재 | `planetsOf()` 무변경 → 행성 생성·렌더(골든 보존). 본체 시각 반경이 `multiplicity.ts` clearance 계산에 참여해 관통 방지(쌍성계 결정 10 메커니즘 재사용). |
| 빔/제트가 동반성·행성과 겹침 | 빔·제트는 자전축 방향(수직), 동반성·행성은 궤도면(수평)이라 시각 간섭 최소. 빔은 가산 글로우라 물체를 가리지 않음. |
| reduced-motion 환경 | **이번 범위 밖** (코드베이스에 인프라 부재). 빔이 이미 부드러운 펄스·안전 주기라 즉각 위험 낮음. 데드코드만 남기지 않음(향후 인프라 신설 시 적용). |
| 빔 점멸 광과민성 | 글로우 펄스는 자전 주기(완전 소등 없음·급격한 대비 없음). 점멸 주파수 안전 상한(≤3Hz) 준수. |
| 펄서가 워프 도착 별 | 도착 시 `discoveredPhenomena`에 펄서 아키타입 기록(블랙홀과 동일 트리거 — `warpTo` persist 경유). |

## Interface Design

### Data Model (엔진)

```ts
// engine/galaxy/sectors.ts
export type StarKind = 'main_sequence' | 'black_hole' | 'pulsar'  // 'pulsar' 추가
```

- `Star.kind` 필드 자체는 이미 존재 — 값에 `'pulsar'`만 추가(모델 변경 없음).
- `KIND_WEIGHTS_BY_SPECTRAL`의 **O·B 항목에만** `pulsar` 가중치 추가. 블랙홀보다 약간 흔하게(weight: black_hole < pulsar). A/F/G/K/M은 `main_sequence` 단일 유지.
- **draw 무변경**: `kind = starRng.weighted(...)`는 테이블과 무관하게 `next()` 1회만 소비(append-only·결정론 불변). 펄서 추가는 O/B 추첨 **결과 분포**만 바꾼다.
- **블랙홀 단일성계 보정은 펄서에 미적용**: 펄서는 `kind !== 'black_hole'`이라 기존 `multiplicity`·`companions`를 그대로 보존(다중성계 허용).

### Components (렌더)

- **`Pulsar`(신규)** — `scenes/system/`. 본체(초고온 청백 + 폴라캡) + 쌍극 등대 빔 2개(회전 스윕 + 카메라 향 글로우 펄스) + 자전축 정렬 상대론적 쌍제트. high 티어 전용 디테일(세그먼트·노이즈·내부 충격파 레이어), medium/low는 경량 폴백.
- **`exotic.ts`(수정)** — 펄서 형태/애니 파라미터(자전 각속도·자기축 오프셋·빔 콘각·제트 길이·펄스 주파수)를 렌더 상수로 추가. 엔진 draw 아님(GEN_VERSION 무관, 결정 6 선례).
- **`CurrentSystem`(수정)** — `bodies[0].kind`로 `BlackHole`/`Pulsar`/`StarSurface` 디스패치. 펄서는 행성 표시 유지(블랙홀만 숨김).
- **`GalaxyStarField`(수정)** — `EXOTIC_RENDER`에 펄서 색/크기(전기 청백) 추가. 1 draw call·좌표 피킹 유지. 블랙홀 같은 링 빌보드는 불필요(펄서는 밝은 점이라 보임).
- **`StarInfoPanel`/`SystemReadout`(수정)** — 펄서 종류 라벨 "펄서 · 중성자성".
- **현상 도감(`phenomena.ts`·`CodexOverlay`)** — 펄서 아키타입(이름·로어·발견 상태) 추가.

### 버전

```ts
// engine/version.ts
export const GEN_VERSION = 7  // 6 → 7
```

- O/B kind 분포가 바뀌므로 결정 13(출력 분포 변경)에 따라 범프.
- **골든 스냅샷**: 프로브 섹터(2,0,3)는 전부 F/G/M형이라 O/B 미도달 → 펄서·블랙홀 둘 다 안 나옴 → **골든 diff 0이 예상**되지만, 분포가 바뀌었으므로 결정 13에 따라 범프하고 골든을 재생성한다(블랙홀 v6 선례와 동일).

## Acceptance Criteria

- [ ] THE SYSTEM SHALL `StarKind`에 `'pulsar'`를 추가하고, `kind`를 분광형 종속 가중치(`KIND_WEIGHTS_BY_SPECTRAL[spectral]`)에서 추첨하며, `pulsar`는 spectral∈{O,B}인 별에서만 출현한다(분포 단위 테스트로 검증).
- [ ] THE SYSTEM SHALL 펄서를 블랙홀보다 약간 높은 빈도로 출현시킨다(O/B 내 weight: pulsar > black_hole, 분포 단위 테스트로 검증).
- [ ] THE SYSTEM SHALL `kind` 추가 draw 없이(기존 `weighted` 1 draw 유지) 펄서를 도출해 `localPos`·`spectral`·`multiplicity`·`companions` 출력을 보존한다(append-only 검증).
- [ ] WHERE 펄서가 `kind !== 'black_hole'`이면 THE SYSTEM SHALL 기존 `multiplicity`·`companions`를 보존한다(다중성계 주성 허용 — 블랙홀 단일화 미적용).
- [ ] WHILE 펄서가 LOD 거리 안에서 렌더되는 동안 THE SYSTEM SHALL 등대 쌍극 빔 2개 + 상대론적 쌍제트 + 초고온 본체/폴라캡을 렌더한다.
- [ ] WHILE 등대 빔이 카메라를 향하는 동안 THE SYSTEM SHALL 화면을 부드러운 글로우 펄스로 밝힌다(자전 주기·완전 소등 없음).
- [ ] IF 펄서 점멸/펄스가 렌더되면 THEN THE SYSTEM SHALL 주파수를 광과민성 안전 상한(≤3Hz) 이하로, 완전 소등·급격한 대비 변화 없이 제한한다.
- [ ] WHILE `scene.kind==='warping'`인 동안 THE SYSTEM SHALL 펄서 본체·빔·제트 렌더를 중단하고, 도착 후 crossfade로 fade-in 한다.
- [ ] WHEN 워프가 펄서 별에 도착하면 THE SYSTEM SHALL `discoveredPhenomena`에 펄서 아키타입을 기록한다(`warpTo` persist 경유).
- [ ] THE SYSTEM SHALL 은하 맵에서 펄서를 전기 청백 색/크기로 구분 렌더한다(1 draw call·좌표 피킹 유지).
- [ ] THE SYSTEM SHALL 펄서 high 티어 셰이더에서 NaN/Bloom 번짐을 방지한다(각도 normalize·`d*d`·출력 clamp — 블랙홀 교훈 준수).
- [ ] THE SYSTEM SHALL GEN_VERSION을 7로 올리고 골든 스냅샷을 재생성한다.
- [ ] THE SYSTEM SHALL Sol·LIFE1 시드를 무변경으로 유지한다(Sol=main_sequence, 프로브 섹터 골든 diff 0, E2E green).

## Scope

**In Scope:**
- 펄서 `kind` 생성·분포(O/B 한정, 블랙홀보다 약간 흔하게)·GEN_VERSION 7·골든 재생성
- high 티어 인씬 펄서 렌더: 등대 쌍극 빔(스윕 + 글로우 펄스) + 상대론적 쌍제트 + 초고온 본체/폴라캡, medium/low 폴백
- 은하 맵 노드 구분(전기 청백), 정보 패널 종류 라벨, 현상 도감 펄서 아키타입
- 다중성계 주성 허용·행성 유지(블랙홀과 차별)
- 단위 테스트(분포·append-only·다중성 보존)·E2E(LIFE1 불변)

**Out of Scope:**
- 백색왜성·적색거성(별도 후속 — StarSurface 변조 묶음)
- reduced-motion 인프라 신설
- 포스트이펙트 기반 빔(블랙홀 high 같은 풀스크린/스크린영역 포스트)
- 자기권 필드라인·싱크로트론 토러스(블랙홀 강착원반과 시각 혼동 회피)
- 탐사 자원 보상·항행 위험(워프 방해 등)
- 성운(별도 후속)

## Open Questions

- [ ] (/yc:plan) 펄서 high 티어 셰이더 세부 — 빔 콘각·내부 충격파 레이어 수·노이즈 방식, 폴라캡 핫스팟 구현(StarSurface prop 확장 vs 전용 셰이더).
- [ ] (/yc:plan) O/B 내 정확한 weight 수치(pulsar vs black_hole vs main_sequence) — 분포 목표 확정.
- [ ] (/yc:plan) 글로우 펄스를 화면에 어떻게 전달할지 — 본체 향 가산 빌보드 강도 변조 vs 경량 스크린 글로우(포스트이펙트 비범위 원칙과 충돌하지 않는 선).
- [ ] (/yc:plan) 펄서 high 티어가 PerformanceMonitor 하향 시 medium 폴백으로 떨어지는 정책(블랙홀 결정 43 — 블랙홀은 항상 high 고정. 펄서도 고정할지).
