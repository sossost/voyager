# Stellar Voyage — 프로젝트 규칙

시드 기반 결정론적 3D 은하 탐험·외계생명체 수집 웹 게임 (React 19 + R3F 9 + TS strict + Zustand + Dexie).

## 진실의 원천

`docs/features/stellar-voyage/` — **코드를 만지기 전에 읽을 것:**
- `01-spec.md` 스펙·수락 기준 / `02-decisions.md` 결정 20건 + 아키텍처 / `03-plan.md` 구현 계획 + 편차 노트 / `04-backlog.md` 개선 백로그

## 철칙 (위반 시 기존 플레이어의 우주가 깨진다)

1. **engine/ 순수성** — 외부 패키지·브라우저 API·초월함수·전역 난수 임포트 금지 (ESLint가 기계 강제). `engine/rng/`의 cyrb128·sfc32는 FROZEN — 절대 수정 금지.
2. **GEN_VERSION 규칙** — `tests/golden/` 스냅샷이 바뀌는 변경 = 출력 분포 변경 = `src/engine/version.ts`의 GEN_VERSION을 올리고 02-decisions에 사유 기록. 카탈로그(`species.json`·`palettes.json`)의 **배열 순서도 저장 포맷이다** (rng.pick이 인덱스로 해석).
3. **draw append-only** — 엔티티 스트림(rngFor) 안에서 새 속성은 항상 기존 draw들 *뒤에* 추가. 순서 변경/삽입 금지.
4. **생성물 저장 금지** — 저장 대상은 플레이어 기록(Profile/Visit/Exploration/Collection)뿐. 별·행성·외계인은 항상 재생성.
5. **persist() 단일 쓰기 경로** — 모든 저장 쓰기는 `persistence/persist.ts` 경유 (백오프 3회 + 토스트, 진행 비차단). Dexie liveQuery 금지 (Memory 폴백 동등성).
6. **R3F 규율** — 연속 값(카메라·진행도·궤도각)은 store 금지, ref+useFrame만. 텍스트 UI에 drei `<Html>` 금지 (DOM 레이어로).

## 게이트 (커밋 전 전부 green)

```bash
npm run typecheck && npm run lint && npm run test && npm run test:coverage && npm run build
npm run test:e2e   # Playwright — 상태 단언 (window.__gameStore, dev 모드 노출)
```

## 알아둘 것

- 아트 교체: 같은 파일명 SVG를 `assets-src/parts/`에 넣고 `npm run build:parts` 한 번 (CSS 변수 `--alien-*`로 채색).
- 테스트용 시드 `LIFE1`: 시작 별계 p0에 생명체 행성(에픽 종족) — E2E가 의존하므로 변경 금지.
- 워크플로우: 새 기능은 `/yc:brainstorm` → `/yc:plan` → `/yc:impl`, 브랜치는 `feature/` → PR.
