# Voyager

시드 기반으로 무한 생성되는 3D 은하를 항행하며, 절차적으로 생성된 외계생명체를
발견·수집하는 웹 게임. **같은 시드는 언제나 같은 우주** — 좌표를 공유하면 친구도
같은 생명체를 만납니다.

## 핵심 루프

은하 뷰 → 별 선택 → 워프 → 태양계 뷰 → 생명체 행성 탐사 → 조우 카드 → 도감/일지

## 실행

```bash
npm install
npm run dev          # 개발 서버 (?seed=XXX 로 특정 우주 접속)
npm run build        # 프로덕션 빌드
```

## 품질 게이트

```bash
npm run typecheck    # TS strict + noUncheckedIndexedAccess
npm run lint         # engine/ 순수성 기계 강제 (외부 패키지·초월함수·Math.random 금지)
npm run test         # vitest — 골든 마스터 + fast-check 속성 테스트 포함
npm run test:coverage# 엔진 90% / store·persistence 80% 게이트
npm run test:e2e     # Playwright — 코어 루프 + IndexedDB 차단 폴백
```

## 아트 파이프라인

외계인은 5개 슬롯(appendage/body/pattern/eyes/mouth) SVG 레이어 합성으로 그려진다.

```bash
npm run build:parts  # assets-src/parts/*.svg → svgo → SVGR 타입드 컴포넌트 + 매니페스트
```

실아트 교체 = 같은 파일명의 SVG를 `assets-src/parts/`에 넣고 위 명령 한 번.
파츠는 `var(--alien-primary/secondary/accent)` CSS 변수로 채색된다 (색 변형 에셋 0개).

## 아키텍처

- `src/engine/` — 순수 결정론 생성 코어. React/three/브라우저 API/외부 패키지 임포트가
  ESLint로 차단된다. PRNG(cyrb128+sfc32)는 벤더링·봉인 — 의존성 업데이트가 우주를
  바꾸는 사고를 원천 차단. 골든 마스터 스냅샷이 변경되면 `GEN_VERSION`을 올릴 것.
- `src/store/` — Zustand 단일 스토어. 씬 상태머신(가드 전이) + 영속 기록의 O(1) 캐시.
  진실 원천은 StorageDriver이며 변이 액션이 명시적 write-through를 수행한다.
- `src/persistence/` — StorageDriver 계약. DexieDriver(IndexedDB)와 MemoryDriver(폴백)가
  같은 계약 테스트를 통과한다. 폴백 판정은 기능 감지가 아닌 실제 `db.open()` 프로브.
- `src/scenes/` — R3F. 단일 영속 Canvas, 섹터 가상화(히스테리시스+LRU), 워프 3단
  타임라인(플래시 피크에 씬 스왑 은닉). 게임 규칙 없음 — store 액션 호출만.
- `src/ui/` — DOM 레이어 (z-계약: Canvas 0 / HUD 10 / 오버레이 20 / 시스템 30).
  키보드 접근성은 전부 여기서 — 3D에 텍스트 UI 금지.

상세 설계와 의사결정 기록: [docs/features/stellar-voyage/](docs/features/stellar-voyage/)
