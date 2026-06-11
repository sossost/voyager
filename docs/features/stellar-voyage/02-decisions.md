# Decisions: Stellar Voyage — 우주 탐험 & 외계생명체 수집 (v1)

**Created:** 2026-06-11

## Technical Decisions

### 1. 비주얼 스타일 / 렌더링 방식

| Option | Pros | Cons |
|--------|------|------|
| A: 2D 스타일라이즈드 (Canvas/PixiJS) | 개발 빠름, 모바일 성능 여유 | 시각적 임팩트 낮음 |
| B: 3D 우주 (Three.js/WebGL) | 회전하는 행성·입체 은하의 몰입감 | 학습 곡선, 개발 기간 증가, 저사양 성능 이슈 |
| C: 미니멀 (SVG/DOM) | 가장 단순, React만으로 구현 | 수천 별 렌더링 한계, '게임' 느낌 약함 |

**Chosen:** B — 3D 우주 (Three.js)
**Reason:** 이 게임의 핵심 매력은 "광활한 우주를 항행하는 감각". 몰입감이 곧 제품 가치라 판단해 개발 비용을 감수하고 3D 선택.

---

### 2. 기술 스택

| Option | Pros | Cons |
|--------|------|------|
| A: React + react-three-fiber | Three.js를 React 컴포넌트로 선언적 작성, drei 헬퍼 생태계, 도감/카드 UI는 익숙한 React로 | R3F 추상화 학습 필요 |
| B: 바닐라 Three.js | 렌더 루프 직접 제어, 추상화 없음 | 3D 씬 ↔ UI 상태 동기화 직접 구축, UI 프레임워크 별도 필요 |
| C: Babylon.js | 게임 엔진 지향(씬/물리/오디오 내장) | 커뮤니티·레퍼런스 작음, React 통합 생태계 약함 |

**Chosen:** A — React + react-three-fiber (+ TypeScript, Vite, Zustand)
**Reason:** 3D 씬과 2D UI(도감/카드/패널)가 절반씩인 게임이라 둘을 하나의 상태로 묶을 수 있는 R3F가 최적. 서버 렌더링이 불필요한 로컬 게임이므로 Next.js 대신 Vite 정적 빌드.

---

### 3. 데이터 저장 방식

| Option | Pros | Cons |
|--------|------|------|
| A: 로컬 저장 (IndexedDB) | 서버 불필요, 운영 비용 제로, 빠른 출시 | 기기 간 동기화 불가, 랭킹·공유 기능 불가 |
| B: 계정 + 서버 저장 | 기기 간 동기화, 소셜 기능 확장 | 인증/DB/배포 운영 필요, 초기 개발량 큼 |
| C: 로컬 먼저, 서버는 v2 | 단계적 확장 | 마이그레이션 설계 선행 필요 |

**Chosen:** A — 로컬 저장 (IndexedDB)
**Reason:** v1은 싱글플레이 수집 게임으로 서버가 주는 가치가 없음. 시드 결정론(결정 4) 덕분에 저장량도 플레이어 기록뿐이라 로컬로 충분.

---

### 4. 우주 생성 방식

| Option | Pros | Cons |
|--------|------|------|
| A: 시드 기반 결정론적 무한 생성 | 우주 전체를 저장할 필요 없음(기록만 저장), 시드 공유 가능, 무한 콘텐츠 | 생성 로직 변경 시 기존 우주가 바뀌는 호환성 관리 필요 |
| B: 플레이어마다 랜덤 생성 후 저장 | 구현 단순 | 생성 결과 전부 저장(데이터 비대), 공유 불가 |
| C: 수작업 + 절차적 하이브리드 | 주요 별계에 스토리성 부여 | 콘텐츠 제작 비용, v1 범위 증가 |

**Chosen:** A — 시드 기반 결정론적 생성
**Reason:** 저장 구조가 극단적으로 단순해지고(방문 기록만), "시드 공유로 같은 우주 탐험"이라는 소셜 훅이 공짜로 따라옴. 생성 로직 버전을 시드와 함께 기록해 호환성 문제에 대비.

---

### 5. 외계생명체 비주얼

| Option | Pros | Cons |
|--------|------|------|
| A: 2D 파츠 조합 카드 | 파츠 조합으로 수천 종 고유 비주얼, 도감 카드 UI와 정합, 검증된 방식 | 파츠 아트 에셋 제작 필요 |
| B: 절차적 SVG/도형 생성 | 에셋 없이 코드만으로 무한 생성 | 귀엽고 애착 가는 느낌 내기 어려움, 튜닝 비용 큼 |
| C: 절차적 3D 크리처 | 3D 우주와 통일성 | 난이도 최상급, v1 범위 초과 |

**Chosen:** A — 2D 파츠 조합 카드
**Reason:** 수집 게임의 생명은 "갖고 싶게 생긴" 수집물. 파츠 조합은 품질을 통제하면서 조합 폭발로 다양성을 얻는 검증된 방식(포켓몬류). 유한 종족 도감(결정 7)과도 구조가 맞물림.

---

### 6. 항행(별 간 이동) 방식

| Option | Pros | Cons |
|--------|------|------|
| A: 워프 연출 + 즉시 도착 | 템포 빠름, 구현 단순, 캐주얼 루프와 정합 | '항해하는 느낌'은 연출에 의존 |
| B: 거리 기반 이동 시간 | 여정의 느낌, 점진적 탐사 확장 | 대기 시간이 캐주얼 유저에게 지루함 |
| C: 직접 조종 | 진짜 시뮬레이션 감각 | 조작감/물리/카메라 복잡도 높음, 모바일 어려움 |

**Chosen:** A — 워프 연출 + 즉시 도착
**Reason:** 게임 깊이를 '캐주얼 탐험+수집'으로 결정한 것과 일관됨. 항해감은 워프 연출 품질로 확보.

---

### 7. 외계인 획득 방식

| Option | Pros | Cons |
|--------|------|------|
| A: 탐사 액션 + 조우 연출 | 갓챠의 기대감 연출을 탐험 행위에 결합, 테마 정합성 최고 | 행성당 1회성이라 재방문 동기 약함 |
| B: 재화 기반 뽑기 | 전통적 갓챠 루프 | 탐험과 수집이 분리되어 테마성 약화 |
| C: 미니게임 성공 시 획득 | 인터랙션 재미 추가 | 설계/구현이 v1 범위 초과, 실패 경험이 캐주얼과 충돌 |

**Chosen:** A — 탐사 액션 + 조우 연출
**Reason:** "우주에서 만난다"는 컨셉 그 자체가 갓챠. 스캔 연출이 뽑기 연출 역할을 하며, 희귀도별 연출 차별화로 기대감 확보. 재방문 동기는 시드 결정론(같은 행성=같은 개체)과 새 행성 탐사로 해소.

---

### 8. 도감(컬렉션) 구조

| Option | Pros | Cons |
|--------|------|------|
| A: 유한 종족 × 무한 개체 | 도감 완성이라는 명확한 장기 목표 + 개체 변형의 무한 발견 재미 | 종족 60종 설계 작업 필요 |
| B: 완전 무한 개체 | 순수한 발견의 재미 | 완성 목표 부재로 수집 동기 빠르게 소진 |
| C: 유한 고정 도감 | 품질 통제 최상 | 절차 생성의 매력 상실, 콘텐츠 소모 후 끝 |

**Chosen:** A — 유한 종족(60종) × 무한 개체
**Reason:** 수집 게임에는 완성 가능한 축이 필수. 종족 도감이 그 축을 제공하고, 개체 변형이 "내 개체는 유일하다"는 절차 생성의 매력을 보존.

---

### 9. 희귀도 시스템

| Option | Pros | Cons |
|--------|------|------|
| A: 4단계 희귀도 (커먼/레어/에픽/레전더리) | 발견의 짜릿함, 등급별 연출 차별화, 장기 동기 | 출현율 밸런싱 필요 |
| B: 등급 없음 | 밸런싱 부담 없음 | 갓챠 특유의 기대감 부재 |
| C: 희귀도 + 변이체(샤이니) | 장기 수집 동기 최장 | v1 범위 증가 |

**Chosen:** A — 4단계 희귀도
**Reason:** 갓챠 재미의 핵심 장치. 변이체(C)는 시스템 확장 여지만 남기고 v2로 미룸.

---

### 10. 타겟 플랫폼

| Option | Pros | Cons |
|--------|------|------|
| A: 데스크탑 우선, 모바일 대응 | 3D 품질 기준을 데스크탑에 두고 모바일은 하향 조정 | 모바일 최적화 후순위 |
| B: 모바일 퍼스트 | 수집 게임 이용 패턴과 궁합 | 저사양 GPU 기준으로 3D 연출 제약 |
| C: 데스크탑 전용 | 고민 최소화 | 접근성 손해 |

**Chosen:** A — 데스크탑 우선, 모바일 대응
**Reason:** 3D 은하의 시각적 가치를 살리려면 데스크탑 기준 설계가 유리. 모바일은 터치 제스처와 품질 자동 하향으로 대응.

---

### 11. 게임플레이 깊이

| Option | Pros | Cons |
|--------|------|------|
| A: 캐주얼 탐험+수집 | 순수 루프, v1 완성 가능성 최고 | 장기 동기가 도감 완성에 의존 |
| B: 라이트 자원 관리(연료 등) | 제약이 주는 긴장감과 성장 재미 | 밸런싱 작업, 개발량 증가 |
| C: 깊은 시뮬레이션 | 풍부한 시스템 | 1인 개발로 수개월~수년 스케일 |

**Chosen:** A — 캐주얼 탐험+수집
**Reason:** v1은 코어 루프의 재미 검증이 목표. 자원 관리는 루프가 검증된 뒤 v2 후보.

---

## Architecture Decisions (/yc:plan)

> 3개 독립 설계안(결정론 코어 우선 / 렌더링 성능 우선 / 제품 완성 우선)을 3개 렌즈(1인 출시 가능성 / 결정론 정합성 / 플레이어 경험)로 심사하고, 기술 실사(버전 호환·렌더링 한계·저장소·결정론·컨텍스트 손실·테스트 제약 웹 검증)를 반영해 종합한 결과.

### 12. 은하 렌더링 전략

| Option | Pros | Cons |
|--------|------|------|
| A: 인터랙티브 별 InstancedMesh + 배경 Points | 일반 레이캐스트로 선택 단순 | 저폴리 구체는 글로우 포인트 대비 시각 매력 낮음 |
| B: 8192 프리할당 단일 Points + free-list 슬롯 | 항상 1드로콜, 런타임 할당 제로 | 상주 별 수백~수천 규모에 수십 배 과잉 엔지니어링 |
| C: 섹터(청크)당 Points 1드로콜 + 카메라 기준 로드/언로드 | 구현 단순, 드로콜이 가시 섹터 수로 고정 | 히스테리시스·캐시 설계 없으면 경계 스래싱 |

**Chosen:** C + B의 디테일 이식 — 로드 반경 R/언로드 R+1 히스테리시스, 신규 섹터 300ms 페이드인, 프래그먼트 셰이더 라디얼 글로우, maxPointSize(fill-rate) 캡, LRU 용량 ≥ 가시 작업셋
**Reason:** 심사 3인 모두 B의 프리할당을 과잉으로, C의 섹터 Points를 적정 규모로 판정. 모바일 병목은 정점 수가 아니라 글로우 오버드로우(fill-rate)라는 B의 통찰만 이식.

---

### 13. PRNG / 해시 전략

| Option | Pros | Cons |
|--------|------|------|
| A: 외부 라이브러리 (seedrandom 등) | 구현 비용 0 | 의존성 업데이트 = 우주 전체 파괴 |
| B: xmur3 + mulberry32 벤더링 | ~40줄, 정수 연산만 | 32bit 단일 상태 — 무한 좌표에서 생일 역설 스트림 충돌 |
| C: cyrb128 + sfc32 벤더링 + '수정 금지' 봉인 | 128bit 상태로 충돌 여유, 모든 JS 엔진에서 비트 동일, ~50줄 | 직접 책임(골든 테스트로 상쇄) |

**Chosen:** C — cyrb128 + sfc32 벤더링. `rngFor(seed, namespace, ...key)`로 엔티티별 독립 스트림. 4중 봉인: 수정 금지 주석 + PRNG 원시 1000출력 골든 마스터 + 시드 3종 생성물 전체 직렬화 스냅샷 + fast-check 속성 테스트
**Reason:** 결정론은 이 게임의 존립 기반(결정 4). 스트림 격리 덕에 v1.1에서 속성을 추가해도 이웃 생성물이 절대 바뀌지 않는다(호환성 1차 방어). GEN_VERSION은 '출력 분포 자체가 바뀌는 변경'에서만 증가(2차 방어).

---

### 14. 생성 경로의 부동소수점 결정론

| Option | Pros | Cons |
|--------|------|------|
| A: PRNG만 정수 보장, 밀도 함수는 sin/log 자유 사용 | 수식 자유로움 | ECMA-262는 초월함수 정밀도를 구현 정의로 둠 — 브라우저 간 별 개수가 갈려 '시드 공유 = 같은 우주' 파괴 가능 |
| B: 외부 simplex-noise 주입 | 검증된 노이즈 품질 | 외부 의존이 우주 형태에 직접 개입 |
| C: 정수 결정 경로 원칙 — 정수 격자 value noise + 산술 연산(+,-,*,/,sqrt)만 벤더링 | IEEE-754 비트 동일 보장 연산만 사용 | 노이즈 품질 직접 튜닝 |

**Chosen:** C — 게임플레이 결정 값은 정수 해시·PRNG·산술 연산만으로 파생. 초월함수(sin/log/exp/pow)는 시각 연출 전용, engine/ 내에서는 ESLint로 금지
**Reason:** 기술 실사가 지적한, 세 설계안이 모두 놓친 유일한 미봉합 결정론 구멍. 린트 강제까지 포함해 봉합.

---

### 15. 씬 관리

| Option | Pros | Cons |
|--------|------|------|
| A: react-router 화면 라우팅 | URL 의미론, 익숙함 | 전체화면 게임에 URL 무의미, Canvas 재마운트 = WebGL 컨텍스트 재생성 위험 |
| B: XState 상태머신 | 전이 그래프 시각화·검증 | 3상태·5전이 규모에 과투자 |
| C: 단일 영속 Canvas + Zustand 판별 유니온 + 가드 액션 | WebGL 컨텍스트 1회 생성(iOS 제한 방어), 비합법 전환 타입+런타임 차단, 의존성 0 | 전이 규칙이 액션에 분산(단위 테스트로 상쇄) |

**Chosen:** C — `SceneState = galaxy | warping{from,to} | system{starId}`. 'warping'은 씬이 아닌 전이 상태. 조우/도감/일지는 씬이 아니라 DOM 오버레이(z-레이어 계약: z-0 Canvas / z-10 HUD / z-20 오버레이 / z-30 토스트). ContextLossGuard로 contextlost/restored 대응
**Reason:** 세 안 만장일치 + iOS Safari 컨텍스트 수 제한(기술 실사)이 단일 Canvas를 사실상 강제. 외계인 카드가 2D DOM이라는 제품 결정이 이 구조를 자연스럽게 가능케 함.

---

### 16. 워프 연출 구현

| Option | Pros | Cons |
|--------|------|------|
| A: 단일 연출 + 완료 콜백 | 구현 단순 | 씬 교체·셰이더 첫 컴파일 히치가 도착 순간 노출 |
| B: 3단 타임라인 — 스트리크 셰이더 → FOV 펄스 → 플래시 피크에 씬 스왑 은닉 | 히치를 연출 뒤에 숨겨 인지 품질 상승, ref 타임라인이라 리렌더 0 | 셰이더 1개 작성 비용 |

**Chosen:** B — 3단 타임라인(~1.6s). 저장 커밋(방문 기록 + 현재 위치)은 플래시 전에 수행 — 연출이 끊겨도 데이터 안전
**Reason:** 결정 6이 '항해감은 워프 연출 품질로 확보'라 명시 — 심사 3인 모두 이 설계를 최고로 평가.

---

### 17. 외계인 파츠 구현

| Option | Pros | Cons |
|--------|------|------|
| A: 스프라이트 시트 / 캔버스 합성 | 래스터 파이프라인 익숙함 | 색 변형마다 에셋/틴팅 코드, 해상도 의존 |
| B: 시그니처 바디 60종 고유 제작 | 종족 개성 최대 | 사실상 일러스트 60장 — 1인 개발 최대 병목을 설계가 자초 |
| C: SVG 컴포넌트 레이어 합성 + 종족=JSON 데이터 + placeholder-first | CSS 변수 팔레트로 색 변형 비용 0, 실루엣 한 줄, 에셋 ~68개로 압축, 아트가 출시를 차단하지 않음 | 파츠 조합의 종족 개성이 약함(fixedParts 시그니처로 상쇄) |

**Chosen:** C — SpeciesArchetype이 fixedParts(정체성 시그니처)/allowedParts(변형 풀)/paletteFamily를 JSON으로 선언. 에셋 예산 body 12 + eyes 16 + mouth 12 + appendage 14 + pattern 10 + 레전더리 전용 4 ≈ 68개. svgo→svgr 빌드 파이프라인. Phase 5는 기하 도형 placeholder로 60종 전부 채워 시스템 먼저 완성, 실아트는 증분 교체
**Reason:** 1인 개발 최대 리스크가 아트 물량 — 예산 압축 + 자동화 + placeholder-first의 3중 완화가 출시 확률을 가장 높임.

---

### 18. 저장 래퍼

| Option | Pros | Cons |
|--------|------|------|
| A: idb-keyval | 극소 용량 | key-value뿐 — 타임라인 정렬·인덱스 쿼리 불가 |
| B: idb | 가벼운 공식 프로미스 래퍼 | 인덱스·마이그레이션 수작업, ~1년 릴리스 정체 |
| C: Dexie 4 | 선언적 스키마 버저닝, 인덱스 쿼리, Safari 워크어라운드 내장, 활발한 유지보수 | ~25KB gzip(무시 가능) |

**Chosen:** C — Dexie 4.4. 단 liveQuery(dexie-react-hooks)는 의도적 미채택. 폴백 판정은 기능 감지가 아닌 실제 `db.open()` 프로브
**Reason:** liveQuery는 UI를 Dexie에 직접 결합시켜 MemoryDriver 폴백 시 도감/일지가 비는 AC 구멍(심사 2·3 공통 지적). 스키마: profile(`&id`) / visits(`&starId, visitedAt`) / explorations(`&planetId`) / collection(`&individualId, speciesId, discoveredAt`).

---

### 19. 도감/일지 데이터 접근 경로

| Option | Pros | Cons |
|--------|------|------|
| A: Dexie liveQuery 직구독 | store 동기화 코드 삭제 | MemoryDriver 폴백에서 동작 불가 — '메모리 모드에서도 플레이 가능' AC 파괴 |
| B: repository 구독 인터페이스 한 겹 | 폴백 동등성 + 반응성 | v1 규모에 구독 추상화는 과잉 |
| C: store Set/Map 캐시 + StorageDriver.listVisits(page) 페이징 | 두 드라이버 완전 동등(공유 계약 테스트), UI는 store만 읽음, 메모리 폭주 방지 | 부트 시 loadAll 1회(이미 존재) |

**Chosen:** C — 게임플레이 중 DB 읽기 0회. 부트 때 loadAll → Set/Map 캐시, 이후 write-through만. 일지 전체 타임라인만 페이징 조회
**Reason:** 폴백 AC의 동등성이 반응형 편의보다 우선. v1 데이터 규모(수백~수천 레코드)에서 가장 단순하고 테스트 가능.

---

### 20. 스토어 영속화 방식 + 별 피킹

| Option | Pros | Cons |
|--------|------|------|
| A: zustand/persist 미들웨어 통짜 직렬화 | 설정 한 줄 | 무엇이 저장되는지 불투명 — 파생 생성물이 실수로 영속화될 위험 |
| B: 액션 내 명시적 write-through + Points raycast 피킹 | 저장 시점 명시 | raycast threshold는 점 크기 의존 — 터치 정밀도 부족 |
| C: write-through + 화면공간 최근접 피킹 1차(터치 히트 반경 2배) | 저장 명시성 + 점 크기 무관 히트 영역(O(n), n=수백, <0.1ms) | 피킹 코드 직접 작성(소규모) |

**Chosen:** C — persist 미들웨어 금지, 변이 액션이 캐시 갱신과 `persist()`(지수 백오프 3회: 200/600/1800ms, 실패 시 토스트, 진행 비차단)를 함께 수행. 피킹은 click/tap 시점에만
**Reason:** '생성물은 저장하지 않는다' 원칙을 구조적으로 보장. 터치 선택 좌절은 코어 루프 이탈로 직결되는 제품 리스크.

---

### 21. 나선은하 형상 + 별 밀도 하향 (GEN_VERSION 1 → 2)

**Date:** 2026-06-11 (v1 직후 — 은하 지도가 "정육면체 별 무더기"로 읽히고 별이 과밀하다는 피드백)

| Option | Pros | Cons |
|--------|------|------|
| A: 렌더만 수정 (페이드/백드롭) | GEN_VERSION 불변 | 밀도 함수가 무정형이라 줌아웃해도 나선이 없음 — 03-plan의 '나선팔 밀도 함수' 약속 미이행 상태 지속 |
| B: 엔진 밀도 함수에 나선팔 추가 + 밀도 하향 + 렌더 수정 | 실제 은하 형상, 별 과밀 해소, 백드롭이 밀도 함수를 그대로 비춰 게임플레이와 비주얼 일치 | 출력 분포 변경 → GEN_VERSION 2 (기존 프로필은 부트 안내 모달) |

**Chosen:** B — 세 갈래 동시 변경:
1. **엔진** (`engine/math/trig.ts` 신설 + `density.ts`): cos/atan2를 사칙연산 유리 근사(Bhaskara I, 최대 오차 ~0.002)로 벤더링 — 결정 14의 "산술 연산만" 원칙 유지. 밀도 = 원반 감쇠² × 수직 감쇠² × 2팔 아르키메데스 나선(비틀림 0.45rad/섹터, 팔 바닥 0.15) × 덩어리 질감(바닥 0.5) + 벌지(반경 6섹터). `MAX_STARS_PER_SECTOR` 80 → 5.
2. **렌더**: 별 글로우 셰이더에 초점 기준 구형 페이드(로드 큐브 내접구) — 체비셰프 로드 경계가 구로 읽힘. 백드롭은 섹터당 1점 + hash01 지터/크기 변주 + 벌지 난색→팔 한색 그라데이션, 줌아웃 한계 1,600 → 6,000.
3. **호환**: 중심 섹터 (0,0,0)의 밀도를 구조적으로 1로 보장 → `originStar`는 모든 시드에서 `0:0:0:0` 유지 → 시드 LIFE1의 시작 별계·행성·외계인은 스트림 격리로 비트 동일 (E2E 불변).

**Reason:** "은하 모양"은 밀도 함수의 속성이지 렌더의 속성이 아니다 — 렌더만 고치면 백드롭과 실제 별 분포가 어긋난다. GEN_VERSION 메커니즘(결정 13)이 정확히 이런 변경을 위해 설계되었고, v1 미출시 시점이라 비용이 최소다.
**Consequences:** `tests/golden/universe.golden.test.ts.snap` 전면 재생성. 기존 v1 프로필은 부트 시 안내 모달(확인 완료). 섹터당 별 밀도 80 → 5 (24 → 12 → 8 → 5, 과밀 피드백으로 출시 전 같은 GEN_VERSION 2 안에서 단계 하향). 구형 페이드는 결정 22에서 가상화와 함께 제거됨.

---

### 22. 은하 별 전수 렌더링 — 섹터 가상화 제거 (결정 12 일부 대체, 결정 21 보완)

**Date:** 2026-06-11 (결정 21 직후 — "클릭 가능한 별은 여전히 좁은 구역에 몰려 있고, 나선은 클릭 불가능한 배경 그림"이라는 피드백)

| Option | Pros | Cons |
|--------|------|------|
| A: 가상화 유지 + 백드롭 강화 | 변경 최소 | 보이는 은하 = 가짜 점, 진짜 별 = 카메라 주변 버블 — 지도가 거짓말을 한다 |
| B: 은하 전체 별 전수 생성·렌더 (Points 1드로콜) | 보이는 별 = 클릭 가능한 별 항상 성립, 가상화·LRU·구형 페이드 전부 삭제, 드로콜 363→21 | 시드당 1회 전수 생성 비용 |

**Chosen:** B — 결정 12의 섹터 가상화는 '무한 우주' 가정이었으나, 은하는 유한하다(반경 48섹터, 총 ~7.3천 별). 전수 생성을 실측하니 이름 포함 ~50ms — 가상화가 해결하던 문제가 존재하지 않았다. `useGalaxyStars`가 시드당 1회 모듈 캐시로 전수 생성하고, `GalaxyStarField`가 1드로콜로 그린다. 피킹(결정 20)은 전체 별 대상 O(n) — 클릭 시점에만 수행하므로 ~7.3천 × 투영 ≈ 수 ms. 별 셰이더는 '단단한 코어 + 옅은 헤일로' 프로파일로 블러 없이 또렷하게, 크기 하한은 분광형 크기 비례(1.2px/단위)로 줌아웃에서도 거성/왜성 격차가 유지되고, 별마다 좌표 파생 밝기·크기 변주로 균일한 점 패턴을 깬다. 성운 백드롭(GalaxyBackdrop)은 "블러 점이 배경 같다"는 피드백으로 완전 제거 — 화면의 모든 점이 클릭 가능한 진짜 별이다.
**Consequences:** `useVisibleSectors`·`SectorPoints`·`lruCache`·구형 페이드(결정 21) 삭제. 프리셋에서 `sectorLoadRadius`·`starBudget` 제거 (점 수는 티어 불변, 티어는 크기 캡만 통제). 04-backlog의 페이드 기하 불일치 항목 무효화. 생성 분포 무변 — GEN_VERSION 2 유지, 골든 불변.

---

## Architecture

### Structure

```
src/
├── main.tsx                  # 부트스트랩: WebGL 프로브 → 저장소 프로브 → 부트 시퀀스
├── App.tsx                   # z-레이어 계약: Canvas(z-0) + HUD(z-10) + 오버레이(z-20) + 토스트(z-30)
├── engine/                   # 순수 결정론 코어 — React/three/브라우저 API 임포트 금지(ESLint 강제)
│   ├── rng/                  # cyrb128 + sfc32 벤더링('수정 금지' 봉인) + rngFor 스트림 팩토리
│   ├── noise/valueNoise.ts   # 정수 격자 + 산술 보간 노이즈 — 초월함수 0
│   ├── coords.ts             # Seed/StarId/PlanetId/IndividualId 브랜디드 키
│   ├── galaxy/               # density(원반 감쇠+나선팔) + starsInSector
│   ├── system/planets.ts     # planetsOf: 1~8행성, 암석/가스, 생명체 10%
│   ├── alien/                # speciesPick(희귀도 가중) + individual(alienAt)
│   ├── naming/names.ts       # 절차 명명
│   └── version.ts            # GEN_VERSION
├── data/species/             # 60종 JSON (fixedParts/allowedParts/paletteFamily/rarity/lore)
├── assets/parts/             # SVGR 생성 타입드 파츠 컴포넌트 (초기엔 기하 placeholder)
├── store/                    # zustand 4슬라이스: scene/player/ui/settings + universe 상수
├── persistence/              # StorageDriver 인터페이스, DexieDriver, MemoryDriver, probeStorage, persist()
├── scenes/                   # R3F — 게임 규칙 없음, store 액션 호출만
│   ├── SceneRouter.tsx       # scene.kind switch
│   ├── shared/               # CameraRig(마우스+터치), ContextLossGuard
│   ├── galaxy/               # GalaxyScene, GalaxyStarField(전수 별, 결정 22), useGalaxyStars, useStarPicking, VisitedStarMarkers
│   ├── system/               # SystemScene, Planet, Orbits
│   └── warp/WarpEffect.tsx   # 3단 타임라인
├── quality/useQualityTier.ts # detect-gpu 초기 티어 + PerformanceMonitor 사후 하향
├── ui/                       # DOM 레이어 — 키보드/포커스/반응형 전부 여기
│   ├── boot/  (SeedSetup, WebGLBlocked)
│   ├── hud/   (TopBar, StarInfoPanel, PlanetPanel)
│   ├── encounter/ (ScanSequence, AlienCard, RarityReveal)
│   ├── codex/ (CodexGrid, SpeciesDetail, IndividualList)
│   ├── journal/ (VisitTimeline, SeedShare)
│   └── common/ (Modal, Toast, Banner)
└── styles/                   # CSS 변수(희귀도 색), 375px+ 반응형
scripts/build-parts.ts        # SVG → svgo → @svgr/cli → parts.manifest.ts
tests/golden/                 # PRNG 원시 1000출력 해시 + 시드 3종 생성물 전체 직렬화 스냅샷
tests/e2e/                    # Playwright: 코어 루프 + 새로고침 복원 + IDB 차단 폴백
```

### Core Flow (Pseudo-code)

```
# 부트
main():
  !hasWebGL()            → WebGLBlocked
  driver = probeStorage()                       # 실제 db.open() 시도, 실패 시 MemoryDriver
  profile == null        → SeedSetup(자동생성/입력/?seed= 프리필) → 저장
  loadAll() → store 하이드레이트(Set/Map 캐시) → 현재 별 태양계 뷰로 시작
  driver.mode == 'memory' → 상시 경고 배너

# 결정론 생성 (engine/* 순수함수 — 저장 안 함, 은하 전수는 useGalaxyStars 시드당 1회 캐시)
starsInSector(seed, sector) → rngFor(seed,'sector',...)로 별 0~24개 (나선 밀도, 결정 21)
planetsOf(seed, starId)     → 행성마다 독립 스트림(스트림 격리 = 호환성 1차 방어)
alienAt(seed, planetId)     → 희귀도(70/22/7/1) → 종족 → fixedParts+allowedParts pick
                              individualId = hash128(...) — 결정론 PK, 중복 등록 DB 제약 차단

# 씬 전환 (가드 액션만이 유일한 전이 경로)
warpTo(target): guard(galaxy && target != current)
  → 'warping' → 3단 타임라인(스트리크 → 플래시 피크에 씬 스왑 은닉 → 페이드아웃)
  → 저장 커밋은 플래시 전 → 'system'

# 조우 (씬은 'system' 유지, DOM 오버레이)
explore(planetId): guard(hasLife && !encounter)
  → alienAt → 중복 판정(O(1) Set) → ScanSequence(희귀도 차등) → 카드 공개
  → 신규면 캐시 갱신 + persist(write-through)

# 수명주기/품질
탭 비활성·풀스크린 오버레이 → frameloop='never'
detect-gpu 초기 티어 → decline 시 DPR → 점 크기 캡 → postFx 순 하향 (별 수는 전수 고정, 결정 22)
```

### Key Interfaces

```typescript
type Brand<T, B extends string> = T & { readonly __brand: B }
export type Seed = Brand<string, 'Seed'>
export type StarId = Brand<string, 'StarId'>            // "sx:sy:sz:i"
export type PlanetId = Brand<string, 'PlanetId'>        // `${StarId}:p${index}`
export type IndividualId = Brand<string, 'IndividualId'> // hash128(seed,'alien',planetId)

export interface Rng {
  next(): number                       // [0,1) — u32/2^32 정수 유도만
  int(maxExclusive: number): number
  pick<T>(items: readonly T[]): T
  weighted<T>(entries: readonly { value: T; weight: number }[]): T
}
export declare function rngFor(seed: Seed, ns: RngNamespace, ...key: (string | number)[]): Rng
export const GEN_VERSION = 1           // 출력 분포가 바뀌는 변경에서만 증가

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary'
export type PartSlot = 'body' | 'eyes' | 'mouth' | 'appendage' | 'pattern'
export interface SpeciesArchetype {
  readonly id: string; readonly name: string; readonly rarity: Rarity; readonly lore: string
  readonly fixedParts: Partial<Record<PartSlot, string>>              // 종족 정체성(body 고정)
  readonly allowedParts: Partial<Record<PartSlot, readonly string[]>> // 개체 변형 풀
  readonly paletteFamily: string
}
export interface AlienIndividual {
  readonly individualId: IndividualId; readonly speciesId: string; readonly rarity: Rarity
  readonly parts: Readonly<Record<PartSlot, string>>
  readonly palette: { primary: string; secondary: string; accent: string }
  readonly name: string
}

// 영속 레코드 — 저장 대상은 이 4종 + 설정뿐
export interface Profile {
  id: 1; seed: Seed
  saveVersion: number    // 저장 스키마 버전 (Dexie 마이그레이션 축)
  genVersion: number     // 생성 로직 버전 (불일치 시 안내, 마이그레이션은 v2)
  currentStarId: StarId; createdAt: number
}
export interface VisitRecord { starId: StarId; visitedAt: number }
export interface ExplorationRecord { planetId: PlanetId; exploredAt: number }
export interface CollectionEntry {
  individualId: IndividualId; speciesId: string; rarity: Rarity; planetId: PlanetId
  discoveredAt: number; isFirstOfSpecies: boolean
}

export interface StorageDriver {
  readonly mode: 'persistent' | 'memory'
  loadProfile(): Promise<Profile | null>
  saveProfile(p: Profile): Promise<void>
  addVisit(v: VisitRecord): Promise<void>
  listVisits(page: { offset: number; limit: number }): Promise<VisitRecord[]>
  addExploration(e: ExplorationRecord): Promise<void>
  addCollectionEntry(e: CollectionEntry): Promise<void>
  loadAll(): Promise<{ visits: VisitRecord[]; explorations: ExplorationRecord[]; collection: CollectionEntry[] }>
  reset(): Promise<void>
}

export type SceneState =
  | { kind: 'galaxy' }
  | { kind: 'warping'; from: StarId; to: StarId }
  | { kind: 'system'; starId: StarId }
```

### R3F 성능 규율 (코드 체크리스트)

- 매 프레임 변하는 연속 값(카메라, 워프 진행도, 궤도 각)은 **절대 store에 넣지 않는다** — useFrame 내 ref + maath damp 전용
- useFrame에서 상태가 필요하면 `useGameStore.getState()` (transient read)
- 파생값(완성률 등)은 셀렉터로 계산, 저장하지 않는다
- 엔진 호출 결과(섹터/행성계)는 store가 아닌 뷰 레이어 LRU/useMemo — store에는 '진실(기록·위치·설정)'만
- 텍스트 UI에 drei `<Html>` 금지 — 키보드 접근성은 DOM 레이어에서
