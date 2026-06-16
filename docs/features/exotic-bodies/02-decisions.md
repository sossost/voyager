# Decisions: 이색 천체 (Exotic Celestial Bodies)

**Created:** 2026-06-15 (적대 검증 1회 반영)

> ⚠️ **PR 분할 (2026-06-16, 결정 16):** 이 문서는 이색 천체 **4종 전부**를 다루지만,
> **이번 PR은 블랙홀만** 구현·머지한다. 적색거성·백색왜성·펄서는 **후속 PR**로 분리됐다.
> 4종 내용은 후속 작업의 진실의 원천이므로 **삭제하지 않고 보존**한다 — 상세는 **결정 16** 참조.

> 프로젝트 본 결정 시트(`docs/features/stellar-voyage/02-decisions.md`)의 결정 13(GEN_VERSION·스트림 격리),
> 16(저장 커밋은 연출 전), 19(드라이버 폴백 동등성), 22~28(비주얼 1·2차 패턴·기각 이력), 31(본체 감싸는 막 금지),
> 38(좁은 핫코어), 40(배경=배경의 성질), 그리고 쌍성계(`docs/features/binary-stars/`, GEN_VERSION 4)와 연속선상.
> 새 결정 번호는 본 시트 편입 시 부여.
>
> **사용자 4대 결정(brainstorm, 2026-06-15):** ① 천체 셋 = 블랙홀+펄서+백색왜성+적색거성(성운 제외) ②
> 블랙홀 = "최종적으로 최대한 실사 느낌"(→ 결정 5 피델리티 사다리) ③ 게임플레이 = 명소 + 현상 도감 ④
> 엔진 통합 = 별 스트림 내 새 `kind`.

## Technical Decisions

### 1. 엔진 통합 방식 — 별 스트림 내 새 `kind` vs 별도 격리 스트림

| Option | Pros | Cons |
|--------|------|------|
| **A: 별 스트림 내 `kind` (append draw)** | `StarId`·localPos·밀도·`starsInSector` 순회·피킹·워프·콜아웃의 *데이터 배선* 재사용, 쌍성계 append 패턴 그대로 | 골든이 별 객체 통째 직렬화 → **GEN_VERSION 범프 회피 불가**; 렌더 분기 코드는 신규(데이터만 공짜) |
| B: 별도 네임스페이스 격리 스트림(`'exotic'`) | 'star' 스트림 0바이트 소비 → 별 값 비트 동일, 순수 가산이면 범프 회피 가능성 | `StarId` 없음 → 워프/피킹/info패널 **병렬 인프라 전부 신규**, 프로브 섹터 오염 시 어차피 골든 재생성 |

**Chosen:** A — 별 스트림 내 새 `kind` (사용자 결정)
**Reason:** 이색 천체를 "워프해서 가는 1급 목적지"로 만들려면 격리(B)의 워프/피킹 병렬 인프라 비용이 append 한 줄보다 훨씬 크다. B도 프로브 섹터에 걸리면 골든 재생성이 불가피해 범프 회피 이점이 사라진다. 쌍성계(v4)가 입증한 append-only 패턴 재사용이 정직하고 싸다.
**검증 각주:** "전부 공짜 재사용"은 **데이터 배선 한정**이다. `GalaxyStarField.starBaseAttributes`(색·크기)·`useStarPicking`(라벨)·`CurrentSystem`(디스패치)·`StarInfoPanel`(라벨)은 `star.kind`를 읽는 렌더 분기를 신규 추가해야 한다(`/yc:plan` 파일트리에서 ★수정으로 명시). `kind`를 required로 추가해도 Star 생성 경로는 `SOL_STAR`·`starsInSector` 둘뿐이라(나머지는 재사용) 타입 전파는 자동.

---

### 2. 1차 천체 범위 — 어떤 이색 천체를 넣나

| Option | Pros | Cons |
|--------|------|------|
| **A: 블랙홀 + 펄서 + 백색왜성 + 적색거성 (성운 제외)** | 사용자가 원한 블랙홀이 헤드라인, 왜성/거성은 StarSurface 변형으로 저비용, 펄서는 가산 빌보드 유틸 기반. 리스크는 블랙홀 렌더에만 국한 | 4종이라 렌더 작업량 중간 |
| B: 진화 천체만(왜성·거성·펄서), 블랙홀 2차 | 최저 리스크 | 사용자가 원한 블랙홀이 빠짐 |
| C: A + 성운 | 비주얼 다양성 최대 | 성운은 볼류메트릭 금지(결정 22/28/40) → 별도 취향 지뢰밭, 스코프·리스크 급증 |

**Chosen:** A (사용자 결정)
**Reason:** 블랙홀이 탐험 다양성 임팩트의 핵심이자 사용자 명시 목표. 왜성·거성은 셰이더+테이블로 ROI 최고, 펄서는 안전. 성운은 결정 22/28/40으로 사실상 사전 기각된 영역이라 **별도 후속**으로 분리해 1차 스코프를 깨끗이.

---

### 3. 희귀도·분포 — 이색 천체를 얼마나 희귀하게

| Option | Pros | Cons |
|--------|------|------|
| **A: long-tail (main_sequence 압도, 이색은 희귀)** | "이색 천체 = 특별한 발견"의 정서, 사실적, 탐험 보상감 | 블랙홀을 만나려면 항해 필요(의도된 희소성) |
| B: 흔하게(이색 ~20%+) | 자주 마주침 | 평범한 별의 평온함 상실, "특별함" 희석 |

**Chosen:** A — long-tail 희귀도
**Reason:** 프로젝트 일관 미학(사실성 우선) + 발견 성취감. 정확한 비율은 결정 4의 분광형 종속 테이블에서 자연 도출하고 `/yc:plan`에서 잠금. **정량은 묘사어로 두지 않는다** — O/B=정확히 4.00%(`SPECTRAL_WEIGHTS` 합 100, O1+B3, 코드 검증됨) 기반으로 weight 잠금 시 단일 수치를 산출해 분포 테스트 단언값으로 고정(이전 초안의 '~0.3%' 선취 수치는 근거 없어 제거).

---

### 4. `kind` 추첨 — 분광형 종속 vs 독립 추첨

| Option | Pros | Cons |
|--------|------|------|
| **A: 분광형 종속 가중치(`KIND_WEIGHTS_BY_SPECTRAL[spectral]`)** | 천문학적 사실성(O/B→블랙홀·펄서, 중저질량→왜성·거성), 블랙홀 희귀도가 O/B 4%에서 자연 도출, spectral 이미 draw됨(공짜), **massOf(spectral) 질량중심 정합 보너스**(결정 7) | 가중치 테이블 7개 |
| B: 분광형 무관 단일 가중치 | 테이블 1개로 단순 | 블랙홀이 M형 왜성에 붙는 비현실, 희귀도 인위 조정, 다중성계 질량중심 틀어짐 |

**Chosen:** A — 분광형 종속
**Reason:** `weighted()`는 테이블과 무관하게 `next()` 1회만 소비(`streams.ts:71`, 검증됨)하므로 **append-only·결정론에 영향 없음**(소비 draw 수 동일). 테이블만 분기하면 결과 매핑이 사실적이 되고, 블랙홀·펄서 희귀도가 O/B 분포에서 공짜로 떨어지며, **블랙홀·펄서가 O/B에서만 나오므로 `multiplicity.ts`의 `massOf(spectral)`이 이색 주성을 자동으로 최대 질량으로 처리 → 질량중심 정합**(별도 질량 모델 불필요). 엔진 순수성 위반 없음(룩업 테이블).

---

### 5. 블랙홀 렌더 — 피델리티 사다리 ("최대한 실사" 목표 달성법)

> 사용자 목표: "최종적으론 최대한 실사에 가까운 비주얼". 가르강튀아 룩은 4특징으로 완성되며 풀스크린 레이마칭이
> 필수인 건 ④뿐: ① 사건지평선 그림자 ② 도플러 강착원반(한쪽 밝음) ③ 포톤 링/위로 휘는 호 ④ 배경 별 중력렌즈.

| Option | Pros | Cons |
|--------|------|------|
| **A: 페이크 적층 (①+②+③, 풀스크린 렌즈 없음)** | 모바일 30fps 안전, 포스트 0, 가산 빌보드. **②도플러·③포톤 호가 "실사" 시그니처라 렌즈 없이도 가르강튀아로 읽힘** | 진짜 배경 왜곡은 없음(근접 정밀 관찰 시 차이) |
| B: 진짜 중력렌즈 풀스크린 포스트셰이더 | 물리 최대 실사 | 전체화면 패스, 30fps 스로틀 시 **가장 먼저 꺼짐**, 모바일 자동 비활성, 구현·검증 비용 최고 |

**Chosen:** A (v1) + **국소 스크린스페이스 굴절을 high 티어 전용 후순위 사치로 분리**
**Reason:** 페이크 적층만으로 "거의 실사 가르강튀아"가 완성되며 예산을 지킨다. 결정 28(물리 시뮬 기각) 정신과 일치 — **시공간 시뮬이 아니라 상징적 룩을 그리는 것**, 도플러·포톤 호 같은 실사 디테일이 곧 가장 읽히는 게임 룩이라 "실사=강한 게임 미학"이 충돌하지 않는다.

**결정 31(본체 감싸는 막 금지) 준수 — 포톤 호는 "부분 호"로 못박는다:** 적대 검증이 "그림자 둘레 가산 빌보드"가 결정 31(프레넬 림 구·행성 부가 구를 2회 기각)의 회색지대에 떨어진다고 지적. **포톤 표현은 사건지평선 구를 감싸는 풀-원형 헤일로/막이 아니라, 강착원반 평면에서 도플러 밝은 쪽 + 렌즈드 상단을 흉내내는 비대칭 부분 호(크레센트) 가산 빌보드**다. 그림자=깨끗한 검은 구, 강착원반=평면 디스크, 포톤=원반의 렌즈된 연장으로 읽혀 "막으로 감싼" 인상을 주지 않는다.

**`PlanetRings` 재사용 범위 정정:** `PlanetRings.tsx`/`ringTexture.ts`는 토성 전용(반경·틸트·크림색 띠 하드코딩, 일반 블렌딩). **재사용 = 링 지오메트리 + 라디얼-UV 재매핑뿐**. 강착원반의 도플러 비대칭 발광·가산 블렌딩·고온 그라디언트·회전은 전부 신규 머티리얼/텍스처(`AccretionDisk` 신규 컴포넌트).

**후순위 업그레이드 경로:** 진짜 렌즈가 필요하면 풀스크린이 아니라 **블랙홀 화면 풋프린트에만 한정된 국소 굴절 메시**(scene 렌더타깃 샘플 + 라디얼 UV 왜곡)를 high 티어 + 근접 줌게이팅으로만, 폴백을 A로(v1 비범위).

---

### 6. 천체 수학의 책임 레이어 — scenes/ vs engine

| Option | Pros | Cons |
|--------|------|------|
| **A: 엔진은 `kind` raw draw만, 형태·애니·배치는 렌더** | engine/ 순수성 유지, 결정론 영향 최소, 쌍성계 결정 9 선례 | 표현 규칙이 렌더에 위치(의도) |
| B: 천체 기하·애니 파라미터도 엔진 | 단일 소스 | engine/ 순수성 위반(회전=시간 함수=렌더 관심사) |

**Chosen:** A
**Reason:** 엔진은 `kind` 한 값만 draw. 자전·강착원반 회전·도플러 위상·제트·점멸은 렌더 시간/상수 함수. **책임 경계**: `scenes/system/exotic.ts`(신규) = 단일 천체 형태/애니 파라미터, `scenes/system/multiplicity.ts`(수정) = 다체 배치·질량중심·clearance에 `kind`별 본체 반경 합성. 엔진 순수성 ESLint가 기계 강제. GEN_VERSION 무관.

---

### 7. 이색 주성 × 다중성계 — CurrentSystem 디스패치 + Companion 무 kind (적대 검증 BLOCKER 해소)

> 쌍성계(v4)와의 상호작용. `CurrentSystem`은 `bodies=[primary,...companions]`를 전부 `StarSurface`로 렌더한다
> (`CurrentSystem.tsx:191-210`). 주성이 블랙홀/펄서이면 이 경로가 충돌한다.

| Option | Pros | Cons |
|--------|------|------|
| **A: bodies[0]만 kind 디스패치, companions는 항상 StarSurface, Companion 무변경** | append-only 안전(Companion에 kind 미추가), 동반성=일반별 자동, 위치/광원 경로 공유, massOf(spectral) 정합(결정 4) | bodies 순회에 index 분기 1개 |
| B: Companion에도 kind 추가 | 동반성도 이색 가능 | **draw append 위치·골든 폭발**, 동반성 이색은 사용자 미요구, 비용 급증 |

**Chosen:** A
**Reason:** `Companion` 타입(`sectors.ts:53-63`)은 **무변경**(kind 필드 미추가) — 엔진 draw·골든 안전 + 동반성이 분광형 일반 별로 자동 렌더. `CurrentSystem`은 `index===0 && star.kind!=='main_sequence'`일 때만 `bodies[0]`을 `ExoticBody`로 치환하고, 위치·공전·`pointLight`는 기존 `bodyPositions[0]`/광원 경로를 그대로 쓴다(kind는 위치 수학을 바꾸지 않음). 질량중심은 `massOf(spectral)` 유지 — 블랙홀·펄서가 O/B에서만 나오므로(결정 4) 주성이 이미 최대 질량이라 정합. 이색 본체 시각 반경은 `multiplicity.ts`의 clearance 계산(쌍성계 결정 10 `pairSemiMajor`/`planetClearanceOffset`)에 참여해 동반성/행성 관통을 막는다. 블랙홀 `pointLight`는 강착원반 발광색의 dim light로 동반성·행성 조명 유지.

---

### 8. 게임플레이 역할 + 저장 — 명소 + 현상 도감 (트리거·메커니즘 정정)

| Option | Pros | Cons |
|--------|------|------|
| **A: 시각 명소 + 가벼운 현상 도감(워프 커밋 자동 기록)** | 기존 수집 루프와 결 일치, 발견 성취감, 식별자만 저장(철칙 4), 기존 워프 커밋 경로 재사용 | 도감 탭 인프라 신규 |
| B: 순수 시각 명소만 | 저장·도감 0 | 수집욕 자극 없음 |
| C: 도감 + 탐사 보상 미니게임 | 깊이↑ | scanPhenomenon 전용 진입점 신규(사용자 미선택) |

**Chosen:** A (사용자 결정)
**Reason:** 기존 도감 정체성과 일치하며 비용 통제.

**발견 트리거 정정(적대 검증):** 기존 저장은 **`warpTo`에서 연출 *전* 커밋**된다(`createGameStore.ts:132-135`, addVisit+saveProfile, 결정 16 "중단돼도 안전"). `onWarpComplete`(도착)는 persist 없음. 따라서 "도착 시 기록"은 틀림 → **워프 커밋 시점에 목적지가 이색 천체이면 `addVisit`과 동일 persist() 트랜잭션으로 `Discovery` 추가**(원자성·결정 16 준수). "최초 발견" 토스트도 커밋 시 발화.

**`Discovery` 데이터:** `{starId, kind, discoveredAt, isFirst}` — **식별자만 저장, 종류명·로어·희귀도는 읽을 때 재생성**(철칙 4). `phenomena.ts`는 4종 아키타입 정적 메타데이터(저장 대상 아님, 배열 순서 무관 — 도감 키는 `kind` enum).

**저장 메커니즘 정정 + 확정(적대 검증 — 가장 의심스러웠던 부분):** `Profile.saveVersion`은 존재하나(`types.ts:4,12`) **쓰이기만 하고 읽히지 않는다**(부트는 `genVersion`만 비교, `BootGate.tsx:86`). 따라서 "saveVersion 불일치 → 빈 컬렉션 마이그레이션"은 **코드 경로가 없는 가상 메커니즘**이었다(제거). **`/yc:plan` 코드 분석 결과 → (b) Profile 내장 배열로 확정**(결정 13 참조):
> - **(b·확정) Profile 내장 배열**: `Profile.discoveredPhenomena?: readonly PhenomenonDiscovery[]` + 로드 시 `?? []` — `seenHints?`(`types.ts:17`)가 이미 확립한 하위호환 패턴 복제. **Dexie 스키마·`StorageDriver` 계약·`MemoryDriver`·`driverContract` 전부 무수정**, `SAVE_VERSION` 범프 불필요(옵셔널 필드라 기존 profile 무중단 로드), `warpTo`가 이미 호출 중인 `saveProfile(buildProfile())`에 필드만 얹어 **신규 쓰기 경로 0**(철칙 5). 폴백 동등성은 profile 왕복이 이미 `driverContract.ts:50-59`로 검증됨.
> - (a) Dexie 신규 테이블: `version(2)` 체인 + 계약 메서드 + 폴백 동등 구현 — **페이징/정렬 쿼리가 필요해질 때만**. 별 발견은 visit과 1:1(별당 1건, 목록 표시만)이라 (b)로 충분.

**네이밍 충돌 주의**: 기존 `discoveredSpecies`(speciesId→수집 개체수 Map, `store/types.ts:72`)와 혼동 없게 레코드는 `PhenomenonDiscovery`, 스토어/Profile 필드는 `discoveredPhenomena`. 모든 쓰기 `persist()` 단일 경로(철칙 5), liveQuery 금지(메모리 폴백 동등).

**도감 탭 인프라 정정(적대 검증):** `CodexOverlay`에 **탭 구조가 없다**(단일 종족 그리드, `CodexOverlay.tsx:60-133`, 제목 하드코딩). "현상 탭 추가"는 "기존 탭에 채우기"가 아니라 **탭 셸 신규 구축 + 기존 그리드를 탭1로 리팩터 + 탭2(현상) 신설**이다. a11y(`role=tablist/tab/tabpanel` + 키보드 내비) 수락 기준 포함.

---

### 9. 비범위 확정 (스코프 크립 차단)

| 항목 | 결정 | 사유 |
|------|------|------|
| 성운(볼류메트릭/배경 색변조) | **Out** → 별도 후속 | 결정 22/28/40 취향 지뢰밭. 배경 색변조라도 별도 brainstorm(결정 2). |
| 블랙홀 진짜 중력렌즈(풀스크린) | **Out** → high 티어 후순위 | 결정 5. v1은 페이크 적층. 국소 굴절 메시 경로만 열어둠. |
| 탐사 보상 미니게임(scanPhenomenon) | **Out** | 워프 커밋 자동 기록으로 충분(결정 8). 전용 진입점 신규는 과투자. |
| 항행 위험(블랙홀 워프 방해·중력) | **Out** | `warpTo`엔 이미 진입 가드가 있다(`createGameStore.ts:118-119`: scene·동일타깃 체크). 항행 위험은 **연출·상태 머신을 더하는 신규 게임플레이 시스템**이라 별도 기능(이전 "스캐폴딩 전무" 근거는 사실 오류 — 정정). |
| 동반성의 `kind` | **Out** | `Companion` 모델 무변경(결정 7). 동반성은 일반 별. |
| 이색 천체별 행성계 특수화 | **Out** | `planetsOf` 무변경(골든 보존). 블랙홀 행성 소멸·적색거성 삼킴은 후속. |
| 부트의 saveVersion 비교 UX | **Out** | 현재 부트는 genVersion만 읽음(결정 8). |

---

### 10. GEN_VERSION 처리

| Option | Pros | Cons |
|--------|------|------|
| **A: 5로 범프 + 골든 재생성** | 철칙 2 준수, `kind` 신규 필드 추가 명시 | 기존 Profile 버전 불일치 모달(의도) |
| B: 범프 없이 진행 | 모달 없음 | 철칙 위반 — 금지 |

**Chosen:** A — 5로 범프
**Reason:** `kind` draw가 'star' 스트림 *값*은 보존하지만, 출력에 `kind` **신규 필드 추가**로 골든이 바뀐다 → 철칙 2에 따라 범프 필수. **현재값 4(v4=쌍성계, `version.ts:20` 실측) → 목표 5.** ⚠️ **코드 반영 직전 version.ts 재실측 후 확정**(백로그/메모 신뢰 금지 — 쌍성계 때 "3" 오기 전례). version.ts 주석 + 본 시트 사유 + `universe.golden.test.ts`의 `expect(GEN_VERSION).toBe(5)` 동시 갱신.

**골든·분포 검증(적대 검증):** 골든(`universe.golden.test.ts:48-66`)은 프로브 섹터(2,0,3) 별 2개 + 그 행성/외계만 캡처하므로 **분포를 검증하지 못한다** — `kind`가 별당 +1키로 붙는 것만 본다. 따라서 (1) `KIND_WEIGHTS_BY_SPECTRAL['F']`를 **프로브 두 'F'별이 `main_sequence` 유지**되도록 잠가 골든 diff가 "kind:main_sequence 키 1개 추가"로만 끝나게 하고, (2) **별도 분포 단위 테스트**(`sectors.test.ts` 스타일 sampleStars: O/B 한정·전체 비율 상한)를 추가한다. 재생성 후 수동 diff 리뷰: 별에 `kind`만 추가, planets/encounters/aliens/companions 불변 확인(그 외 움직이면 STOP).

---

### 11. 은하 맵 노드 구분 — 이색 천체를 어떻게 표시

| Option | Pros | Cons |
|--------|------|------|
| **A: 포인트 클라우드 색/크기 분기(`EXOTIC_RENDER`) + 블랙홀만 링 빌보드** | 1 draw call·좌표 기반 피킹 유지, `SPECTRAL_RENDER` 미러로 간단 | 블랙홀(어두운 점)은 예외 처리 필요 |
| B: 전부 병렬 빌보드 레이어 | 강착원반·제트까지 맵에 표현 | draw call·복잡도↑, 맵에 불필요 |

**Chosen:** A
**Reason:** 맵 차별화는 색/크기가 전부고 1 draw call·`useStarPicking` 좌표 피킹을 지킨다(피킹은 색과 무관하므로 "자동 피킹 유지" 성립). 적색거성=거대 주황, 백색왜성=작은 청백, 펄서=전기 청백을 `EXOTIC_RENDER` 테이블로. **블랙홀만** 순수 어두운 점이 안 보여 작은 가산 링 빌보드 시블링을 줌게이팅으로 보강. **결정 27 위계 유지** — 적색거성 상한 클램프로 "별이 주인공(행성의 2배+)"를 깨지 않게.

---

## 철칙 준수 체크리스트

- [x] **engine/ 순수성** — `kind` 생성은 기존 rngFor·weighted만 사용, 외부 패키지·초월함수 무도입. 천체 형태·회전·도플러·제트·강착원반·질량중심은 렌더(scenes/) 책임.
- [x] **GEN_VERSION 규칙** — 4 → 5 범프(실측 후 확정) + version.ts·본 시트 사유 + 골든 재생성. 카탈로그 배열 순서 무변경(`phenomena.ts` 키는 `kind` enum).
- [x] **draw append-only** — 주성 'star' 스트림 기존 draw(localPos×3·spectral·multiplicity·companions×N) **전부 뒤 마지막**에 `kind`만 추가. `planetsOf`·`alienAt`·`moons`·`drawCompanions`·`Companion` 타입 무변경.
- [x] **생성물 저장 금지** — 이색 천체 자체는 저장 대상 아님(항상 재생성). 저장은 **플레이어 발견 기록**(`Discovery`, 식별자만)뿐.
- [x] **persist() 단일 쓰기 경로** — `Discovery`는 `addVisit`과 동일 `persist()` 트랜잭션(워프 커밋, 결정 16). Dexie liveQuery 금지(메모리 폴백 동등).
- [x] **R3F 규율** — 자전·점멸·강착원반 회전·공전은 ref+useFrame(store 금지). 콜아웃·도감 텍스트는 DOM 레이어.
- [x] **Sol 예외 보존** — `SOL_STAR`에 `kind:'main_sequence'` 추가 + 루프 내 `id===SOL_STAR_ID` 분기 continue로 `kind` draw 미실행 → LIFE1 무영향. `SOL_STAR` toEqual 단위 테스트 동시 갱신.

## 결정론 무관 보장 (쌍성계 선례 형식)

> **골든이 바뀌는 것은 오직 별 직렬화에 `kind` 필드 한 개가 추가되는 것뿐이다.** `kind` draw는 'star' 스트림의
> 진짜 마지막 draw라 기존 localPos·spectral·multiplicity·companions 값을 비트 보존하고(`weighted()`는 next()
> 1회 소비), `planetsOf()`·`alienAt()`·`moons.ts`·`drawCompanions()`는 무변경이라 행성·외계·위성·동반성 골든 값이
> 보존된다. 천체 형태·회전·도플러·질량중심·clearance·맵 색은 전부 렌더 시간/상수 함수로 GEN_VERSION과 무관하다.
> 저장 측 `discoveredPhenomena`(Profile 옵셔널 필드, 결정 13 — SAVE_VERSION 범프 없음)는 `GEN_VERSION`과
> 독립이며, 부트 차단(genVersion)에 영향을 주지 않는다.

## Architecture (added by /yc:plan, 2026-06-15)

> 코드 정밀 분석(5에이전트)으로 모든 터치포인트를 실제 시그니처·라인으로 확정. 아래 결정 12~15 + Structure +
> Key Interfaces + Core Flow.

### 12. 본체 반경 단일 소스 — `renderedRadius` 확장 (관통 방지)

| Option | Pros | Cons |
|--------|------|------|
| **A: `multiplicity.ts`의 `renderedRadius`(충돌·clearance 단일 소스)와 `bodyVisualRadius`(시각)가 동일 kind 분기 공유** | clearance(`pairSemiMajor`·`stellarClearanceRadius`·`planetClearanceOffset`)가 새 반경으로 자동 재계산 → 별/행성 관통 없음 | 두 함수에 kind 분기 추가 |
| B: ExoticBody가 자체 시각 반경만 키움 | 컴포넌트 국소 | 시각 반경≠충돌 반경 → **관통**(쌍성계 결정 10에서 이미 겪은 함정) |

**Chosen:** A
**Reason:** `renderedRadius`(`multiplicity.ts:60`)가 `pairSemiMajor`(L68)·`stellarClearanceRadius`(L196)·`planetClearanceOffset`(L248)의 본체 반경 단일 진입점이다. 적색거성(큰 반경)·백색왜성(작은 반경)을 여기서 분기하면 동반성 간격·행성 궤도 오프셋이 자동 정합. `CurrentSystem`의 `bodyVisualRadius`(시각)와 **동일 분기를 공유**해야 피킹 반경(`currentBodies.radii`)·메시·clearance가 한 값을 쓴다. red_giant *코로나*(가산 투명)는 clearance 제외, *본체* 반경만 키운다.

---

### 13. `PhenomenonDiscovery` 저장 — Profile 내장 배열 (옵션 b 확정)

| Option | Pros | Cons |
|--------|------|------|
| **(b) `Profile.discoveredPhenomena?: readonly PhenomenonDiscovery[]`** | `seenHints?` 하위호환 패턴 복제, Dexie/계약/Memory/contract **무수정**, SAVE_VERSION 무변경, `saveProfile` 단일 경로 재사용(철칙 5·신규 쓰기 경로 0), profile 왕복 폴백 동등성 기검증 | profile JSON 성장(별당 1건이라 무해) |
| (a) Dexie 신규 테이블 | 페이징/정렬 인덱스 | 5파일 수정(types·dexie·memory·contract·store)·SAVE_VERSION 범프·폴백 동등 수작업 |

**Chosen:** (b)
**Reason:** 발견은 visit과 1:1 카디널리티·목록 표시뿐이라 (a)의 테이블 인프라가 과투자. `warpTo`가 이미 호출하는 `saveProfile(buildProfile())`에 `discoveredPhenomena`를 얹으면 끝. 네이밍은 기존 `discoveredSpecies`와 구분.

---

### 14. `ExoticBody` 컴포넌트 분리 + `StarSurface` optional props

| Option | Pros | Cons |
|--------|------|------|
| **A: `ExoticBody` 디스패처 신규 + StarSurface에 optional `emissiveBoost?`/`coronaScale?`(기본값) 추가** | 거성/왜성은 StarSurface 재사용(색+계수 주입), 펄서/블랙홀은 전용 컴포넌트. **optional default라 기존 단일 항성 렌더 1픽셀도 불변** | StarSurface 셰이더 소폭 확장 |
| B: StarSurface에 kind 전부 욱여넣기 | 파일 1개 | God 컴포넌트, 블랙홀/펄서는 StarSurface와 이질적 |

**Chosen:** A
**Reason:** `CurrentSystem.tsx:198`의 `<StarSurface>` 자리를 `body.kind` 선언적 디스패치로. 거성/왜성=`StarSurface`(emissiveBoost/coronaScale + 색), 펄서=`Pulsar`(제트+점멸), 블랙홀=`BlackHole`(그림자+`AccretionDisk`+포톤 호). `ExoticBody`는 부모 `<group>` ref 계약 + `uOpacity` 워프 크로스페이드(결정 41-c)를 StarSurface와 동일하게 준수(안 그러면 도착 팝인). `bodies` 슬롯의 *종류만* 바꾸므로 `MAX_BODIES=3` 상한 무영향.

---

### 15. 도감 탭 — 로컬 useState 셸 (과한 추상화 금지)

| Option | Pros | Cons |
|--------|------|------|
| **A: `CodexOverlay` 로컬 `useState<'species'|'phenomena'>` + `CodexContent`를 탭1로 + role=tablist** | 오버레이 1곳뿐이라 최소, a11y 충족 | — |
| B: 공유 `Tabs` 컴파운드 추상화 | 재사용 | Rule-of-three 미달(1곳) — 과한 추상화 |

**Chosen:** A
**Reason:** `CodexOverlay.tsx:128-132`의 `OverlayShell` children을 `role=tablist` + 삼항으로 감싼다(`CodexContent`=탭1 그대로, `PhenomenaTab`=탭2 신규). 탭 전환 시 언마운트로 `selectedSpeciesId` 자연 리셋. 키보드 내비(role=tab/tabpanel + 화살표) 포함. 도감/일지는 이미 별개 오버레이라(`Overlay='codex'|'journal'`) 탭은 codex 내부에만.

---

### 16. PR 분할 — 이번 PR=블랙홀만, 거성·왜성·펄서는 후속 (GEN_VERSION 5 유지)

**Date:** 2026-06-16
**Status:** accepted

#### Context
4종(적색거성·백색왜성·펄서·블랙홀)이 한 브랜치(`feature/exotic-bodies`)에 전부 구현된 상태에서, 사용자가 **블랙홀을 별도로 리뷰**하기 위해 이번 PR을 블랙홀만으로 축소하기로 결정. 거성·왜성·펄서 + 그들의 현상 도감은 후속 PR.

#### Decision
- `StarKind`를 `'main_sequence' | 'black_hole'` **2종으로 축소**. `KIND_WEIGHTS_BY_SPECTRAL`은 O/B만 `black_hole` 보유, A/F/G/K/M은 `main_sequence` 단일 항목.
- 삭제: `Pulsar.tsx`, `ExoticBody.tsx`(블랙홀 단일 분기라 CurrentSystem에 `<BlackHole>` 직접 인라인), `exotic.ts`의 `surfaceModulationOf`·`SurfaceModulation`·`NEUTRAL_MODULATION`, `spectral.ts`/`phenomena.ts`의 거성·왜성·펄서 항목, 관련 테스트 단언.
- 유지: 블랙홀 렌더 일체(측지선 레이마칭·강착원반·맵 링·렌즈 공유상태)·현상 도감(블랙홀)·블랙홀 행성 숨김.
- 4종 구현은 **git 히스토리(c3f9dbf..7d7288a)에 보존** → 후속 PR에서 cherry-pick/참조.

#### GEN_VERSION = 5 유지 (범프 안 함)
- **근거:** 릴리즈 시퀀스 기준 main(v4) 다음 첫 머지가 곧 v5(블랙홀). 4종 v5는 **미릴리즈 중간 산물**이라 '5' 재사용이 정당. 후속 PR(거성·왜성·펄서 재도입, 분포 변경)이 v6.
- **골든 무변화(실측):** 프로브 섹터(2,0,3)의 7개 별이 전부 F/G/M형 → `black_hole` 도달 불가, 전부 `main_sequence` 유지. 단일 항목 테이블의 weight 값은 출력 무관(`target < total` 항상). `weighted()`는 테이블 크기와 무관하게 `next()` 1회 소비 → RNG 시퀀스 바이트 동일. **스냅샷 git diff 0 확인.**
- **분포는 변함(인지):** O/B 별의 `black_hole` 재분할 + 비O/B의 거성·왜성 롤이 `main_sequence`로 플립. 단 골든 프로브가 O/B를 안 뽑아 스냅샷엔 안 보임. 철칙 2의 트리거("스냅샷이 바뀌는 변경")는 미충족 → 범프 불필요로 판단(사용자 확정).
- **dev 프로필 주의:** 4종-v5로 테스트한 로컬 프로필은 genVersion이 같아 자동 리셋 안 됨 → stale 펄서·거성 발견 기록이 남을 수 있음. `indexedDB.deleteDatabase('stellar-voyage')` 후 재부트로 정리.

#### Consequences
- 도감 "현상" 탭은 블랙홀 1종만 표시(완료율 1/1). `PhenomenonRarity`의 `uncommon`/`rare`는 미사용이나 후속 PR 대비 보존.
- `createGameStore.test.ts`: 블랙홀이 최희귀(O/B 한정)라 평면 sy=0만으론 동종 2개 미확보 → 표본을 3D 박스(sy ±4)로 확장.
- `StarSurface`의 `emissiveBoost?`/`coronaScale?`는 호출자가 사라졌으나 기본값이라 무해 → 후속 정리 후보(코어 셰이더 리스크 회피로 이번엔 유지).

---

### Structure (영향 파일 — ★수정 ☆신규)

```
src/
├── engine/
│   ├── galaxy/sectors.ts        # ★ StarKind 타입 + KIND_WEIGHTS_BY_SPECTRAL + kind append draw(L171 직후) + Star 필드 + SOL_STAR
│   ├── galaxy/sectors.test.ts   # ★ kind 분포 테스트(sampleStars O/B 한정·비율) + SOL_STAR.kind 단언
│   ├── version.ts               # ★ GEN_VERSION 4→5 + v5 사유 주석 (실측 후)
│   └── index.ts                 # ★ StarKind export(L22 타입 배럴)
├── scenes/
│   ├── system/exotic.ts            # ☆ 이색 천체 형태/애니 파라미터(렌더 상수·도플러·제트·점멸 — 순수)
│   ├── system/ExoticBody.tsx       # ☆ kind 디스패처(거성/왜성→StarSurface, 펄서→Pulsar, 블랙홀→BlackHole)
│   ├── system/BlackHole.tsx        # ☆ 그림자 구 + AccretionDisk + 비대칭 포톤 호(부분 호, 결정 31)
│   ├── system/AccretionDisk.tsx    # ☆ RingGeometry+라디얼UV 재사용 + 신규 가산 도플러 셰이더·회전
│   ├── system/Pulsar.tsx           # ☆ 중성자성 본체 + 가산 제트 콘 2개 + 점멸(≤3Hz)
│   ├── system/StarSurface.tsx      # ★ optional emissiveBoost?/coronaScale?(기본값) — 거성/왜성
│   ├── system/multiplicity.ts      # ★ renderedRadius·bodyVisualRadius에 kind 반경 분기(clearance 정합)
│   ├── system/CurrentSystem.tsx    # ★ BodyVisual에 kind + L198 디스패치
│   ├── galaxy/spectral.ts          # ★ EXOTIC_RENDER + STAR_KIND_LABELS
│   ├── galaxy/GalaxyStarField.tsx  # ★ starBaseAttributes L56 kind 분기(색/크기, draw call 불변)
│   ├── galaxy/BlackHoleMapRings.tsx# ☆ 블랙홀 맵 링 빌보드(SelectedStarMarker 패턴, 줌게이팅)
│   └── galaxy/GalaxyScene.tsx      # ★ BlackHoleMapRings 시블링 마운트(L100 직후)
├── data/phenomena/
│   └── phenomena.ts             # ☆ 4종 아키타입 정적 카탈로그(label·lore·rarity, species.ts frozen 패턴, kind 키)
├── persistence/
│   └── types.ts                 # ★ PhenomenonDiscovery + Profile.discoveredPhenomena?(옵션 b)
├── store/
│   └── createGameStore.ts       # ★ warpTo persist에 discovery 기록(L131-135) + buildProfile + 캐시 set + 최초발견 토스트
├── ui/
│   ├── hud/StarInfoPanel.tsx    # ★ "종류" 행(L71 직전, 주성·비-main만)
│   └── codex/CodexOverlay.tsx   # ★ 탭 셸(L128) + PhenomenaTab 신규
└── tests/
    ├── golden/universe.golden.test.ts  # ★ GEN_VERSION 단언 5(L33-34) + 스냅샷 재생성(-u)
    └── e2e/                            # ★ LIFE1 green 유지 + (선택) 발견 E2E
```

### Key Interfaces

```typescript
// engine/galaxy/sectors.ts
export type StarKind = 'main_sequence' | 'red_giant' | 'white_dwarf' | 'pulsar' | 'black_hole'
const KIND_WEIGHTS_BY_SPECTRAL: Readonly<Record<SpectralClass, readonly WeightedEntry<StarKind>[]>>
//   O/B: main_sequence 다수 + black_hole·pulsar + 소량 red_giant
//   A/F/G: main_sequence 압도 + 소량 white_dwarf·red_giant   (F: 프로브섹터 별이 main 유지되게 검산)
//   K/M: main_sequence 압도 + 소량 red_giant·드물게 white_dwarf
export interface Star { /* 기존 7필드 불변 */ readonly kind: StarKind }   // Companion 무변경

// scenes/galaxy/spectral.ts
type ExoticKind = Exclude<StarKind, 'main_sequence'>
export const EXOTIC_RENDER: Readonly<Record<ExoticKind, { color: string; size: number }>>
export const STAR_KIND_LABELS: Readonly<Record<StarKind, string>>

// persistence/types.ts (옵션 b)
export interface PhenomenonDiscovery { readonly starId: StarId; readonly kind: StarKind; readonly discoveredAt: number }
export interface Profile { /* 기존 + */ readonly discoveredPhenomena?: readonly PhenomenonDiscovery[] }

// data/phenomena/phenomena.ts
export interface PhenomenonArchetype { readonly kind: ExoticKind; readonly label: string; readonly lore: string; readonly rarity: 'uncommon'|'rare'|'legendary' }
export const PHENOMENA_CATALOG: readonly PhenomenonArchetype[]   // frozen, 저장 무관(키=kind)
```

### Core Flow (Pseudo-code)

```
// ── 엔진: starsInSector(), 기존 draw(localPos×3·spectral·multiplicity·companions×N) 전부 뒤 ──
kind = starRng.weighted(KIND_WEIGHTS_BY_SPECTRAL[spectral])   // 마지막 draw, weighted=next()1회
stars.push({ id, sector, localPos, spectral, name, multiplicity, companions, kind })
// SOL_STAR(루프 continue)은 draw 미실행 → kind:'main_sequence' 리터럴

// ── 맵 노드: GalaxyStarField.starBaseAttributes (L56) ──
render = star.kind === 'main_sequence' ? SPECTRAL_RENDER[star.spectral] : EXOTIC_RENDER[star.kind]
// → 색/크기만 바뀜, 지오메트리 속성·draw call·피킹 불변

// ── 근접: CurrentSystem bodies.map (L198) ──
body.kind === 'main_sequence' → <StarSurface radius color/>
            'red_giant'|'white_dwarf' → <StarSurface radius color emissiveBoost coronaScale/>
            'pulsar' → <Pulsar/>   'black_hole' → <BlackHole/>   // 부모 group ref + uOpacity 공유
// renderedRadius/bodyVisualRadius가 kind 반경 공유 → clearance 자동 정합(관통 없음)

// ── 발견: warpTo (L131-135), 연출 전 커밋(결정 16) ──
visitedAt = now()
set({ ...scene 'warping', discoveredPhenomena: target이 exotic이면 [...prev, rec] })
persist(async () => {
  await driver.addVisit({ starId: target, visitedAt })
  await driver.saveProfile(buildProfile())   // discoveredPhenomena 포함 — 신규 쓰기 경로 0
})
if (firstOfKind) toast('최초 발견: ' + label)

// ── 도감: CodexOverlay 탭 ──
activeTab==='species' ? <CodexContent/> : <PhenomenaTab discovered={discoveredPhenomena} catalog={PHENOMENA_CATALOG}/>
```

> **결정론 무관 보장**(위 "결정론 무관 보장" 섹션 재확인): 골든 변화는 별 직렬화에 `kind` 1키 추가뿐.
> 모든 렌더 수학(renderedRadius 분기·도플러·회전·포톤 호·맵 색·clearance)과 저장(discoveredPhenomena)은
> GEN_VERSION과 무관. **다음 단계: `/yc:impl`.**

---

## 결정 (2026-06-16 후속 세션) — 블랙홀 단일성 + 가르강튀아 비주얼

### 결정 X: 블랙홀은 단일성계 (GEN_VERSION 5 → 6)
**Status:** accepted · **사유:** 블랙홀이 이중·삼중성계 주성으로 생성되면, 동반성 궤도가 강착원반(rs×18)·
렌즈 영역 안에서 돌아 부자연스럽고, 동반성이 블랙홀 앞을 지날 때 스크린공간 렌즈가 빛을 맺히게 함(사용자 피드백).
**방식:** `sectors.ts`에서 `kind==='black_hole'`이면 `multiplicity='single'`·`companions=[]`로 **출력만 덮어쓴다.**
draw(multiplicity·drawCompanions)는 그대로 소비 → RNG 스트림·다른 별·다른 draw 불변. 블랙홀 별의
multiplicity/companions 출력만 변경. 프로브 섹터(2,0,3)는 블랙홀이 없어 골든 별 데이터는 불변이나,
블랙홀 출력 분포가 바뀌므로 결정 13에 따라 **GEN_VERSION 6**으로 올림(골든 스냅샷의 genVersion 필드 갱신).
**천문학적 주석:** 블랙홀 쌍성(예: 백조자리 X-1)은 실재하나, 게임 렌더 한계상 단일로 단순화.

### 결정 Y: 가르강튀아 룩 — 화면공간 레이마칭 렌즈 (전부 렌더 전용, GEN_VERSION 무관)
**Status:** accepted · **사유:** 레퍼런스 dgreenheck/webgpu-black-hole을 WebGL GLSL 포스트패스로 포팅.
- **중력렌즈 ON**(`LENS_STRENGTH`): 광선 굴절로 디스크 뒷면이 위로 감김 + 배경 별 휘어짐(2차상 반전 — 정상).
- **그림자**: 광자구 임계 `BCRIT`(=b_crit)로 정의 → horizon보다 큰 검은 원. 탈출 못 한 광선도 검정.
- **디스크**: 안쪽을 그림자에 바짝(diskInner) + 외곽 직선 패스로 안 잘리게 + 황금빛(가르강튀아) 흑체 램프.
- **배경**: 스크린공간 굴절(실제 씬 샘플) — 휜 방향만 보임, 전경(앞 항성)은 깊이 비교로 오클루전.
- **게이팅**: `uScreenRadius`(성능 마스크)를 렌즈 소실 지점까지 + edgeFade로 경계 은폐.
- **함교뷰**: 블랙홀계만 시선 고도 8°(거의 옆에서) — 감김이 잘 보이는 각도. 그 외 20°.
- **충돌 회피**: 블랙홀의 유효 반경을 디스크 외곽(rs×18)으로 — 단일성계화 후엔 사실상 방어 코드.
- WebGPU 마이그레이션 검토 → **기각**(postprocessing이 WebGLRenderer 전용, compute 불요).
