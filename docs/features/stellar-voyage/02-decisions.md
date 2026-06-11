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

**Chosen:** B — 결정 12의 섹터 가상화는 '무한 우주' 가정이었으나, 은하는 유한하다(반경 48섹터, 총 ~7.3천 별). 전수 생성을 실측하니 이름 포함 ~50ms — 가상화가 해결하던 문제가 존재하지 않았다. `useGalaxyStars`가 시드당 1회 모듈 캐시로 전수 생성하고, `GalaxyStarField`가 1드로콜로 그린다. 피킹(결정 20)은 전체 별 대상 O(n) — 클릭 시점에만 수행하므로 ~7.3천 × 투영 ≈ 수 ms. 별 셰이더는 거리 적응형 — 카메라 ~800 이내는 '단단한 코어 + 옅은 헤일로'의 또렷한 점광원, ~3,200 밖은 소프트 글로우로 전환(확대할수록 초점이 맞는 느낌). 크기 하한은 분광형 크기 비례(1.2px/단위)로 줌아웃에서도 거성/왜성 격차가 유지되고, 별마다 좌표 파생 밝기·크기 변주로 균일한 점 패턴을 깬다. 성운 백드롭(GalaxyBackdrop)은 "블러 점이 배경 같다"는 피드백으로 완전 제거 — 화면의 모든 점이 클릭 가능한 진짜 별이다.
**Consequences:** `useVisibleSectors`·`SectorPoints`·`lruCache`·구형 페이드(결정 21) 삭제. 프리셋에서 `sectorLoadRadius`·`starBudget` 제거 (점 수는 티어 불변, 티어는 크기 캡만 통제). 04-backlog의 페이드 기하 불일치 항목 무효화. 생성 분포 무변 — GEN_VERSION 2 유지, 골든 불변.

---

### 23. 줌아웃 은하 연출 — 성운 텍스처 평면 + 코어 광원

**Date:** 2026-06-11 (결정 22 직후 — "축소 시 너무 샤프하고 단조롭다, 은하 중심 광원과 성운 배경이 필요해 보인다"는 피드백)

| Option | Pros | Cons |
|--------|------|------|
| A: 점 블롭 백드롭 부활 | 구현 재사용 | "블러 점이 가짜 별 같다"로 이미 기각된 방식 |
| B: 밀도 함수를 구운 연속 텍스처 평면 1장 + 코어 라디얼 글로우 | 점이 아닌 연속 발광 면 — 가짜 별 없음, 실제 별 분포와 같은 함수라 팔에 정확히 밀착, 드로콜 1 | 평면이 화면을 덮는 중간 줌에서 fill-rate·얼룩 위험 (줌 게이팅으로 해소) |

**Chosen:** B — `GalaxyNebula`: 섹터당 1텍셀(97²)로 sectorDensity를 굽고 4배 블러 업스케일 + 중심 코어 라디얼 글로우를 덧그린 CanvasTexture를 은하면 평면(가산 블렌딩)에 깐다. 카메라-초점 거리 2,000→4,500에서만 페이드인하고 그 미만이면 mesh를 꺼서(visible=false) 근접 항행 중 fill-rate 낭비와 회색 얼룩을 차단. 밀도 함수가 시드 무관이라 텍스처는 1회 생성. 별 셰이더의 소프트 블렌딩은 상한 0.65·크기 부풀림 0.35로 낮춰 별이 헤이즈 위의 또렷한 알갱이로 남는다.
**Reason:** 결정 22에서 백드롭을 제거한 건 "점 블롭이 가짜 별로 읽혀서"였지 성운 자체가 문제가 아니었다. 연속 텍스처는 그 결함 없이 은하 사진의 광량을 준다. 렌더 전용 — 생성 분포·GEN_VERSION 불변.

---

### 24. 원거리 배경 은하 — 절차 스머지 빌보드 (백로그 E-1)

**Date:** 2026-06-11 (비주얼 2차 패스 — "우주에 우리 은하 하나뿐이라 바깥이 빈 검정")

| Option | Pros | Cons |
|--------|------|------|
| A: 스카이박스/큐브맵 텍스처 | 한 번에 하늘 전체 채움 | 대형 텍스처 에셋 필요, 줌·회전 시 해상도 한계 노출, 에셋 파이프라인 추가 |
| B: 절차 베이크 스머지 텍스처 1장 + 빌보드 쿼드 8장 | 에셋 0, 라디얼 그라디언트 1회 베이크, 쿼드별 틴트·타원비·면내 회전으로 변주, 드로콜 8 | 하늘 전체가 아닌 점적 배치 — 방향 구성은 수동 |
| C: GalaxyNebula식 밀도 베이크 평면 | 기존 패턴 재사용 | 배경 은하는 "작은 점 스머지"라 평면 1장 접근이 과함 |

**Chosen:** B — `scenes/shared/DistantGalaxies`. 셸 반경 16,000~24,000(최대 줌아웃 6,000 밖, 카메라 far 30,000 안)에 고정 방향 16개(피드백 "좀 더 많아도 될듯"으로 8→16 증량). 그룹이 매 프레임 카메라 쿼터니언을 복사(빌보드)하고 자식 메시가 면내 회전·타원 스케일을 가진다. 좌표는 은하 중심 기준이며 별계 씬(플로팅 오리진, 결정 15)은 현재 별의 월드 좌표만큼 역오프셋해 마운트 — 어느 씬에서 보든 정확히 같은 하늘 방향에 떠 있다(우주 일관성, SystemBackdropStars와 같은 기준계). *별계 씬 마운트는 결정 31로 철회 — 은하 씬 전용.*
**Consequences:** 렌더 전용 — 시드·생성 분포·GEN_VERSION 무관. 피킹(화면공간 별 클릭)은 별 배열 대상 연산이라 간섭 불가. 가산 블렌딩 + depthWrite off라 별계 씬에서 행성 뒤로 자연 차폐. 텍스처·머티리얼은 앱 수명 모듈 캐시(씬 전환 재베이크 방지, useGalaxyStars 캐시와 같은 트레이드오프).

---

### 25. 별계 씬 배경 별 — 실제 이웃 별 셸 투영 (백로그 E-6)

**Date:** 2026-06-11 (비주얼 2차 패스 — "별계 씬에 배경 별이 없어 항성계만 덩그러니")

| Option | Pros | Cons |
|--------|------|------|
| A: 범용 랜덤 스타필드 (장식용 가짜 별) | 구현 단순 | 은하 지도와 무관한 하늘 — "지도가 거짓말을 한다"(결정 22와 같은 결함) |
| B: 실제 이웃 별을 천구 셸에 투영 | generateGalaxyStars 시드당 캐시 재사용(생성 비용 ~0), 방향이 실좌표 그대로 — 은하수 띠가 실제 은하면 방향에 생긴다, Points 1드로콜 | 셸 정규화·밝기 감쇠 튜닝 필요 |

**Chosen:** B — `scenes/system/SystemBackdropStars`. 별계 씬은 플로팅 오리진(결정 15)이므로 현재 별 기준 상대 벡터를 고정 반경 4,000 셸로 정규화 — 가장 가까운 이웃(수십 유닛)도 행성 궤도(~53)와 절대 겹치지 않고 시차도 없다. 밝기는 실거리 기반 감쇠((150/d)^0.8)에 좌표 파생 지터를 곱한 뒤 하한 0.04로 클램프 — 가까운 이웃은 또렷하다. 점 크기 캡 4px — 항성·행성이 주인공. 별 개성 해시는 `scenes/shared/starVariance`로 단일화 — 은하 지도와 배경 하늘이 같은 변주를 공유한다(모두가 같은 하늘).

**은하수 띠 — 결정 28로 대체(기각):** 물리 충실 접근(분해 안 되는 먼 별빛의 띠 — 텍스처 글로우, 이후 입자 1.4만 재작업)을 두 차례 시도했으나 "뿌연 구름같다", "작은 파티클 뭉침이 어색하다"로 모두 기각. 별계 배경 미학은 결정 28(스텔라리스식 균일 별밭)을 따른다.
**Consequences:** 렌더 전용 — 시드 결정론 유지, GEN_VERSION 무관. SystemBackdropStars(실이웃 별 셸 투영)는 유지.

---

### 26. 워프 연출 다듬기 (백로그 E-2, 결정 16 보완)

**Date:** 2026-06-11 (비주얼 2차 패스 — "현 3단 타임라인이 투박함", 피드백 "빛줄기가 투박하고 애니메이션이 짧다")

결정 16의 3단 타임라인 **구조**는 불변, 실행 품질과 길이를 다듬는다:
- **타임라인 연장**: 스테이지 A 900→1,600→3,200ms(2차 피드백 "이동시간 2배"), 플래시 차오름 300→350ms, 걷힘 450→650ms — 총 ~1.8s → ~4.3s. 항해감(결정 6)을 충분히 느낄 길이로.
- **워프 카메라 리그** (피드백 "현 위치에서 목표 항성을 바라보는 시점으로 확대되면서"): `WarpCameraRig`가 스테이지 A 동안 카메라를 전담 — 플레이어가 보던 포즈에서 출발해 초반 ~35%에 시선을 목표 항성으로 돌리고(스무스스텝), 이후 progress³ 가속으로 목표를 향해 돌진(거리의 45%, 상한 2,200). *결정 31에서 3막(확대 → 응시 → 돌진)으로 재구성.* 별밭 시차가 진짜 이동감을 만들고 스트리크가 화면 중앙(=목표)에서 방사된다. 전제 조건 둘: SceneRouter가 galaxy ↔ warping에서 GalaxyScene을 같은 트리 위치에 유지(리마운트 = 포즈 스냅 방지), 워프 중 GalaxyScene 카메라 앵커는 출발 별(from) — warpTo가 currentStarId를 즉시 목적지로 바꾸기 때문(결정 16 저장 선행). OrbitControls는 워프 동안 enabled=false, CameraRig 의존성은 좌표 값 기준(배열 참조 무관).
- **혜성형 트레일**: 쐐기형 단층 레이 → "가는 코어 + 넓은 헤일로" 2성분 단면의 빛줄기 2층(한색 주층 75 + 보랏빛 보조층 36 — 2차 피드백 "절반으로", 버킷 폭 보정으로 굵기 유지). **가산 블렌딩** — 일반 블렌딩의 "색종이 띠" 문제를 해소, 겹치는 줄기는 자연히 백색으로 타오른다. 레이별 점화 시차, 속도·꼬리 길이·두께 변주, 머리는 둥근 캡.
- **중앙 코어 플레어**: 진행 12제곱·반경 0.2의 작고 뜨거운 점광 — 플래시 직전 목적지가 타오르는 불씨 역할만 한다. 넓은 글로우는 회색 안개로 읽혀 기각(실측 2회 반복 피드백).
- **FOV 큐빅 서지**: 선형 → progress³, 펀치가 플래시 직전에 몰린다.
- **플래시 청백 틴트**: #ffffff → #f2f6ff + 차오름/걷힘 큐빅 베지어 — 스트리크의 한색 톤과 연결.
- **NaN 가드**: atan(0,0)은 GLSL 스펙상 undefined — 방사 마스크 사각지대에서 조기 탈출해 중앙 글로우 피크에 구멍이 뚫릴 가능성 차단.

**Consequences:** 렌더 전용 — GEN_VERSION 무관. CSS(global.css .warp-flash) 지속시간은 warpTimeline.ts 상수와 수동 동기화 관계 유지 (650ms/350ms로 갱신됨).

---

### 27. 별계 씬 가독성·연출 정리 (비주얼 2차 마무리 피드백)

**Date:** 2026-06-11

- **항성/행성 시각 위계** ("행성이 항성보다 큰 케이스가 꽤 나온다"): 엔진 radius(0.4~5.0)를 그대로 쓰면 큰 행성(4.5)이 항성(구 3)을 넘는 모순. 엔진 데이터는 불변(저장·생성 포맷) — 렌더 매핑만 수정: 항성 시각 반경 3→5, 행성은 압축 매핑 0.45 + radius×0.4 (0.6~2.5) — 항성이 항상 2배 이상 크다.
- **궤도 확장**: orbitRadiusOf = 6 + au×9 → 10 + au×16 (반경 ~19.6에서 최대 ~93, 카메라 한계 180 안).
- **진입 줌인 트랜지션**: 별계 진입이 즉시 스왑("띡 하고 뜨는")이라 `SystemEntryTransition` 추가 — 안착 거리의 1.45배에서 시작해 0.9s easeOutCubic으로 다가와 안착. 안착 거리 = CameraRig maxDistance(180)와 동일 값이라 OrbitControls 클램프 스냅이 없다. 이징 동안 컨트롤 일시 정지, ref 기반(철칙 6).

**Consequences:** 전부 렌더 전용 — GEN_VERSION·저장 포맷 무관. E2E는 행성 선택을 store 액션으로 수행하므로 크기 변화 무영향.

---

### 28. 별계 배경 — 물리 충실(은하수) 기각, 게임 미학(균일 별밭) 채택 (결정 25 일부 대체)

**Date:** 2026-06-11 ("스텔라리스처럼 배경 전체에 고르게 별이 흩어져 있는 게 맞지 않아?")

| Option | Pros | Cons |
|--------|------|------|
| A: 물리 충실 — 은하수 띠 (실광량 누적) | 지구에서 보는 밤하늘처럼 "사실"에 가깝다 | 텍스처는 구름, 입자는 뭉침으로 읽힘 — 두 차례 실측 기각. 배경이 시선을 뺏는다 |
| B: 게임 미학 — 천구 균일 별밭 (스텔라리스식) | 배경이 균일하고 차분해 전경(항성·행성)이 산다, 구현 단순 | 은하수·은하면 방향성 같은 "위치감"은 포기 |

**Chosen:** B — `scenes/system/SystemStarfield`. 결정론 해시로 천구(반경 4,100)에 균일 분포한 장식 별 6천 개(Points 1드로콜, 시드 무관 — 모든 플레이어가 같은 하늘). 밝기는 제곱 치우침(다수 어둡고 소수 또렷), 백색 중심 색온도 변주. 그 위에 SystemBackdropStars(실이웃 별, 결정 25)가 "은하 지도에서 보던 그 별"의 밝은 액센트로 얹힌다 — 균일 배경 + 의미 있는 구조의 이중 레이어.
**Reason:** 물리적으로는 지구(태양계 안)에서 보는 하늘도 은하수 띠가 맞지만, 이 게임의 별계 씬은 "관측 시뮬"이 아니라 행성 탐사 무대다 — 배경의 역할은 공허하지 않으면서 조용한 것. 두 차례의 충실 구현이 모두 미학에서 기각된 것이 결정적.
**Consequences:** GalacticBand 삭제. 렌더 전용 — GEN_VERSION·저장 포맷 무관.

---

### 29. 천체 디테일 — 항성 절차 셰이더 + 행성 텍스처 베이크 (백로그 F-1)

**Date:** 2026-06-11 (비주얼 3차 패스 — 항성·행성이 단색 구라 근접 시 밋밋함)

| Option | Pros | Cons |
|--------|------|------|
| A: 텍스처 에셋 (행성 스킨 이미지) | 아트 품질 상한 높음 | 에셋 파이프라인 추가, paletteSeed 다양성(~21억) 살릴 수 없음 |
| B: 항성 = GLSL 절차 셰이더, 행성 = paletteSeed 결정론 CanvasTexture 베이크 | 에셋 0, 시드당 고유 무늬, GalaxyNebula에서 검증된 베이크 패턴 재사용 | 셰이더/베이크 코드 직접 관리 |

**Chosen:** B —
- **항성** `StarSurface`: 시간 애니메이션 value noise 입상반(두 위상 노이즈 장 교차 = 끓는 표면) + 림 다크닝 + 가산 빌보드 코로나(텍스처 없는 라디얼 셰이더, 느린 호흡 맥동). 뜨거운 입상반은 1을 넘는 백색으로 출력해 high 티어 Bloom(임계 0.3)이 증폭하고, 코로나는 Bloom 없는 티어에서도 빛무리를 보장한다. 색은 SPECTRAL_RENDER 재사용.
- **행성** `planetTexture.ts` + `Planet` 재작업: 등장방형 베이크(베이스 192×96 → ×2 블러 업스케일, 구름은 96×48 → ×4)를 마운트 시 1회 수행하고 언마운트 시 dispose. 노이즈는 단위 구 3D 좌표에서 샘플링(엔진 valueNoise3 재사용, paletteSeed가 솔트)하므로 가로 이음매가 없다. 암석형 = fbm 고도 → 지형 색 밴드 + 시드 변주 극관, 생명체 = 바다/대륙 + 구름층(별도 구, 1.55배속 자전), 가스형 = 노이즈로 뒤튼 위도 밴드 + 폭풍 반점. 공통 = paletteSeed 파생 자전(속도·방향) + ~~`PlanetAtmosphere` 프레넬 림~~(결정 31로 기각 — "막에 둘러싸인" 느낌). 조명은 기존 meshStandardMaterial + 항성 포인트라이트 유지(낮/밤 경계 공짜). 미사용이던 품질 프리셋 planetSegments를 이번에 실제 연결.
**Consequences:** 렌더 전용 — 엔진 draw 소비 없음, GEN_VERSION·골든 불변. 같은 paletteSeed = 같은 무늬(시각 결정론). 베이크는 계당 1~8장 × 수 ms로 진입 트랜지션(0.9s)에 가려진다.

---

### 30. 위치 가시화 — 방문 틴트·현재 비콘·여정 경로선 (백로그 F-2)

**Date:** 2026-06-11 (비주얼 3차 패스 — 7.3천 별 줌아웃에서 방문 링이 묻히고 "여기"가 안 보임)

정보 위계 **현재 > 선택 > 방문 > 미방문**을 색·모션으로 분리한다:

| Option (방문 표시) | Pros | Cons |
|--------|------|------|
| A: 링 마커 유지 + 캡 상향 | 변경 최소 | 줌아웃에서 링이 별과 분리되어 떠 보임, 인스턴스 캡(512) 잔존 |
| B: GalaxyStarField starColor/size 어트리뷰트 갱신 — 별 자체가 켜진다 | 줌 무관 가시성, 드로콜·캡 추가 0, "지도의 점 = 진짜 별" 원칙(결정 22) 유지 | 어트리뷰트 갱신 경로 관리 |

**Chosen:** B + 비콘 + 토글 경로선 —
- **방문 틴트**: 방문 별의 색을 청록(#52f5d0)으로 60% 섞고 밝기 1.45×·크기 1.18× — 별 자체가 "켜진" 느낌. 기본 변주를 재계산 후 틴트를 얹는 멱등 이펙트라 방문 집합 증가·지오메트리 재생성 모두 안전. `VisitedStarMarkers` 삭제 (대체).
- **현재 비콘** `CurrentStarBeacon`: 호박색(#ffd166 — 한색 별밭·보라 선택 링·청록 틴트와 모두 구분) 펄스 링 + 소나 확장 링 2개. 수직 FOV 역산으로 화면 고정 크기(반지름 17px) 클램프 — 어떤 줌에서도 "여기"가 같은 크기. 워프 중엔 currentStarId가 이미 목적지(결정 16)라 자연히 착륙 비콘이 된다.
- **여정 경로선** `JourneyPath`: visitedStars Set 순회 순서를 잇는 폴리라인. createGameStore가 hydration.visits를 visitedAt 오름차순으로 정렬해 Set을 구성하므로(드라이버 loadAll 정렬은 구현마다 달라 스토어에서 보장) Set 순서 = 타임라인. 오래된 구간은 정점 색 페이드. 취향 타는 요소라 HUD 토글(`isJourneyPathVisible`, 기본 off). 방문 기록은 starId 업서트(별당 1레코드)라 재방문 구간은 "최근 방문 순"으로 단순화된다 — 코스메틱 라인에 충분.
**Consequences:** 렌더 전용 + uiSlice 토글 1개 — GEN_VERSION·저장 포맷 무관. 후순위 ④ 오프스크린 화살표는 백로그 잔류.

---

### 31. 비주얼 3차 실측 피드백 — 대기 막·별계 배경 은하 기각, 워프 3막 재구성 (결정 24·26·29 보완)

**Date:** 2026-06-11 (PR #3 실측 피드백 3건)

1. **행성 프레넬 대기 림 기각** — "행성들이 막 같은 거에 둘러싸여 있다". FrontSide 프레넬 글로우 구(×1.16)가 게임 스케일(시각 반경 0.6~2.5)에서는 대기가 아니라 반투명 껍질로 읽혔다. `PlanetAtmosphere` 삭제 — 생명체 행성의 시각 신호는 구름층 + 바다/대륙 팔레트로 충분하다. (이로써 행성 주변 부가 구는 두 차례 기각: v1 생명 헤일로 구 → 결정 29에서 프레넬 림으로 교체 → 본 결정에서 제거. 행성은 깨끗한 텍스처 구로 둔다.)
2. **별계 씬 배경 은하 제거** — "별계 배경에서 별 말고 은하는 빼도 될 듯". DistantGalaxies의 별계 마운트(결정 24의 우주 일관성 장치)를 철회 — 별계 배경은 균일 별밭(결정 28) + 실이웃 별(결정 25)의 별 2층만. 은하 씬 마운트는 유지.
3. **워프 카메라 3막 재구성** — "현 위치 항성에서 최대한 확대한 뒤(우주선 시점) 목표 방향을 바라보면서 워프". 기존(결정 26)은 보던 포즈에서 시선만 돌리고 돌진했다. 새 구성: **① 확대**(0~30%: 현재 뷰 축을 따라 출발 항성 30유닛까지 다이브, 시선은 항성에) → **② 응시**(30~50%: 시선을 목표로 회전) → **③ 돌진**(50~100%: local³ 가속 전진). 스트리크·FOV 서지는 다이브 종료 후부터 점화(`WARP_DIVE_END_PROGRESS` 공유) — 목표를 바라보는 상태에서만 워프 효과가 켜진다. 다이브가 추가된 만큼 스테이지 A 3,200→4,000ms. 서브 페이즈 경계는 warpTimeline 상수로 카메라·스트리크가 동기화. *결정 34에서 ①·②가 즉시 컷으로 대체됨 — "트랜지션으로 다이브하지 말고 바로 시점이 바뀌어야" 피드백.*

**Consequences:** 전부 렌더 전용 — GEN_VERSION·저장 포맷 무관. 결정 16의 3단(A/플래시/공개) 구조는 불변, A 내부만 3막화. 총 연출 ~4.3s → ~5.1s (E2E 8s 타임아웃 안).

---

### 32. 은하 수직 두께 렌즈형 프로파일 (GEN_VERSION 2 → 3, 결정 21 보완)

**Date:** 2026-06-11 ("측면에서 보면 가운데랑 날개 끝 두께가 일정한데, 은하처럼 가운데가 도톰하고 날개로 갈수록 얇아지게")

| Option | Pros | Cons |
|--------|------|------|
| A: 렌더 시 Y 좌표 스쾃시 (엔진 불변) | GEN_VERSION 유지 | starWorldPosition 소비처 ~6곳(피킹·마커·비콘·경로·워프·배경 별)에 변환을 일관 적용해야 — 누락 한 곳이면 "지도가 거짓말" 재발 |
| B: 밀도 함수의 수직 감쇠를 반경 의존으로 (엔진 변경) | 구조적으로 정직 — 별의 실제 분포가 렌즈형, 소비처 변경 0 | 출력 분포 변경 = GEN_VERSION 3 + 골든 재생성 |

**Chosen:** B — 절반 두께를 상수(5섹터)에서 반경 함수로: `RIM(1.2) + (5 − 1.2) × t·sqrt(t)` (t = radialFalloff, t^1.5 테이퍼 — Math.pow 금지라 곱·sqrt로 표현, 결정 14 준수). 중심 벌지는 ±5섹터, 가장자리는 ±1.2섹터로 얇아지는 렌즈 실루엣. 총 별 수 ~7.3천 → ~4.8천 (바깥 날개의 평면 밖 별 정리 — "별은 적고 또렷하게" 취향과 부합).
**안전판:** 수직 프로파일은 |sy|/두께 꼴이라 **sy=0 평면 밀도를 절대 못 바꾼다** — originStar 순회와 LIFE1 시작 별계가 모두 sy=0이라 기존 E2E·테스트 시드 보장이 그대로 성립 (density.ts 주석으로 불변식 명문화). 골든 프로브 섹터도 전부 sy=0이라 스냅샷은 genVersion 스탬프만 변경.
**Consequences:** GEN_VERSION 3 (v2 프로필은 부트 안내 모달 — 실측 확인). 골든 스냅샷 재생성. useGalaxyStars 순회 상한(GALAXY_HALF_THICKNESS_SECTORS=5)은 최대값 의미로 유지.

---

### 34. 우주선 뷰 ↔ 은하 전도 분리 + 워프 즉시 컷 (백로그 E-4, 결정 15·31 보완)

**Date:** 2026-06-11 ("은하맵뷰가 하나뿐인데 우주선 뷰 / 월드(은하) 뷰 둘로 — 시뮬레이션은 우주선 뷰, 은하 뷰는 이동할 항성을 고르는 뷰. 은하 뷰는 중심축이 은하 중심에 고정, 우주선 뷰는 현 위치에 고정")

| Option | Pros | Cons |
|--------|------|------|
| A: 단일 뷰 유지 + 줌 레벨로 암묵 구분 | 변경 0 | 지도와 현장의 역할이 섞임 — 궤도 중심이 항상 현재 별이라 은하 전체 탐색이 어색 |
| B: SceneState galaxy에 view 축(ship/map) 추가 | 역할 분리가 상태로 명시 — 카메라 앵커·줌·정보 레이어를 뷰별로 게이팅, 가드 액션 패턴(결정 15) 그대로 | 씬 상태 형태 변경 (kind 비교 코드는 무영향) |

**Chosen:** B —
- **우주선 뷰(ship)**: 궤도 중심 = 현재 별, 줌 15~600(이웃 몇 섹터). 시뮬레이션의 기본 시점 — 별계 이탈(backToGalaxy)은 항상 여기로 나온다. HUD "은하 지도"로 전도 열기.
- **은하 전도(map)**: 궤도 중심 = **은하 중심(0,0,0) 고정**, 줌 200~6,000. 항행 목적지 선택용 전략 지도. 정보 레이어(현위치 비콘·여정 경로선)는 지도 전용 — 우주선 뷰에서 비콘은 워프 중 목적지 표지로만 등장. HUD "← 우주선"으로 복귀. 별 선택·항행은 두 뷰 모두 허용(지도가 더 편할 뿐).
- **뷰 전환 = 컷**: CameraRig의 초점 스냅(기존 동작)이 그대로 컷이 된다 — 트랜지션 없음.
- **캐노피 프레임** ("같은 별밭이라 어느 뷰인지 헷갈린다" 후속 피드백): 우주선 뷰·워프 중에만 보이는 장식 DOM 오버레이(`ShipFrame` — 코너 브래킷 + 가장자리 비네트 + 하단 콘솔 밴드, 포인터 통과). 두 뷰를 즉각 구분하는 시점 표지 — drei Html 금지 규칙대로 DOM 레이어(HudLayer 최하단)에 둔다.
- **워프 1막 컷** ("다이브 트랜지션 말고 바로 시점이 띡 변경"): 결정 31의 ①확대·②응시를 폐기. 발동 즉시 우주선 포즈로 컷 — 출발 항성의 목표 반대편 30유닛에서 목표를 응시(출발 별이 바로 앞, 목적지가 화면 중앙). 홀드(~18%: 전진 크리프 14유닛 = 엔진 예열) → 점화(`WARP_IGNITION_PROGRESS`) → 큐빅 돌진. 다이브가 빠진 만큼 스테이지 A 4,000→3,200ms 복원.
**Consequences:** 렌더·상태 전용 — GEN_VERSION·저장 포맷 무관. E2E 코어 루프가 별계 이탈 → 지도 열기 → 선택 → 항행 흐름으로 갱신. 백로그 E-4 해소, E-5(이탈 워프 연출)는 우주선 뷰에 자연스럽게 얹을 수 있는 자리가 생김.

---

### 33. 행성 텍스처 해상도 — 품질 티어 연동 (결정 29 보완)

**Date:** 2026-06-11 ("항성·행성 텍스처 좀 더 해상도 높였을 때 성능 이슈 있을까")

- **항성은 해당 없음** — 텍스처가 아니라 절차 GLSL 셰이더(결정 29)라 화면 픽셀 단위로 계산된다. 확대해도 항상 선명하고 비용은 화면을 덮는 픽셀 수에만 비례 — 해상도 개념이 없다.
- **행성 베이크는 마운트 시 동기 CPU 작업** — 해상도가 곧 별계 진입 비용. 실측(M계열, 암석형 페인터): 192×96=5.3ms/장, 256×128=9.1ms, 384×192=20.5ms, 512×256=36.3ms (8행성 최악 각각 43/73/164/290ms). GPU 메모리는 high 기준 행성당 ~1.6MB로 무시 가능 — 병목은 베이크 CPU다.

**Chosen:** 베이스 해상도를 품질 프리셋으로 (`planetTextureBaseWidth`): high 384(×2 업스케일 = 768×384), medium 256(512×256), low 192(현행 384×192). high의 최악 164ms는 워프 플래시 페이드(650ms) 뒤에 숨고, 약한 기기는 티어가 내려가며 베이크 비용도 함께 준다. 512는 비용 대비 화질 이득이 작아 보류(최대 행성 풀줌 화면 직경 ~515px 대비 768폭이면 ~1.3px/텍셀로 충분).
**Consequences:** 렌더 전용 — GEN_VERSION 무관. 티어 변경 시 재베이크.

**보완 (같은 날, "해상도 높일 수 있으면 더 디테일하게" 피드백):** 동기 일괄 베이크를 **프레임 분산 큐**(`bakeQueue` — rAF 체인, 프레임당 1장)로 전환해 히치 자체를 제거 — 해상도가 진입 비용에서 분리됐다. 베이크 도착 전에는 paletteSeed 플레이스홀더 단색, 도착하면 텍스처 팝인(진입 트랜지션·워프 플래시에 가려 체감 미미). 이 덕에 high를 512(최종 1024×512)로 상향 — 36ms/장도 프레임당 1장이라 안전. 항성도 fbm 3→4옥타브 + 입상반 주파수 5.5→8.0으로 정밀화 (셰이더라 GPU 비용은 화면 픽셀 비례 — 무시 가능).

**보완 2 ("행성이 너무 시커멓다" 피드백):** 원인 셋 — ① **R3F 머티리얼 함정**: 플레이스홀더(단색) ↔ 베이크(map) 머티리얼을 같은 위치 조건 분기로 갈아끼우면 React가 같은 타입이라 인스턴스를 재사용하고, 제거된 color prop이 검정으로 리셋되어 최종색(= color × map)이 검정이 됐다. **분기 머티리얼에는 key를 달아 리마운트를 강제**하고 color를 항상 명시 — 렌더 체크리스트에 추가할 패턴. ② 베이크 팔레트의 저지대 명도(L 26~28%)가 플레이스홀더(52~62%)보다 한참 어두웠다 — 평균 명도를 플레이스홀더 수준으로 상향. ③ 물리 광원 모드의 ambient는 알베도/π 페널티로 직관의 ~1/3 — 0.25는 밤면이 새까매서 1.2로 상향(밤면 가독성).

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
│   ├── galaxy/               # GalaxyScene, GalaxyStarField(전수 별+방문 틴트, 결정 22·30), useGalaxyStars, useStarPicking, CurrentStarBeacon, JourneyPath
│   ├── system/               # SystemScene, StarSurface(결정 29), Planet(+planetTexture), Orbits
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
