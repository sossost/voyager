import type { Seed, StarId } from '@/engine'
import { parseSeed, parseStarId, SOL_STAR_ID, starById } from '@/engine'

/**
 * 항성계 공유 딥링크 (백로그 L-1) — `?seed=<seed>&star=<starId>`.
 *
 * 워프·딥링크 모두 기존 결정론 좌표만 쓴다 (새 저장 필드 없음, GEN_VERSION 무관).
 * `starId`는 결정론 식별자라 같은 시드면 동일 항성계로 복원된다.
 */

const SEED_PARAM = 'seed'
const STAR_PARAM = 'star'

export interface SystemLink {
  /** 형식·범위 검증을 통과한 시드. 없거나 무효면 null. */
  readonly seed: Seed | null
  /** 형식 검증을 통과한 별 식별자. 없거나 무효면 null (시드 일치 여부는 부트가 판단). */
  readonly starId: StarId | null
}

/**
 * URL 쿼리스트링에서 시드·별 식별자를 파싱·검증한다.
 *
 * starId는 형식(`sx:sy:sz:index`)만 검증한다 — 시드 간 형식이 동일하므로
 * "이 시드에서 유효한가"는 호출부(부트 복원)가 starById로 따로 판단한다.
 */
export function parseSystemParams(search: string): SystemLink {
  const params = new URLSearchParams(search)
  const rawSeed = params.get(SEED_PARAM)
  const rawStar = params.get(STAR_PARAM)
  return {
    seed: rawSeed == null ? null : parseSeed(rawSeed),
    starId: rawStar != null && parseStarId(rawStar) != null ? (rawStar as StarId) : null,
  }
}

/**
 * 딥링크의 별을 실제 시작 별로 적용할지 결정한다.
 *
 * star ID는 시드와 무관하게 형식·유효성이 통과될 수 있어(섹터+인덱스가 시드 간 공통),
 * **URL seed가 실제 로드되는 seed와 일치할 때만** 적용한다 — 아니면 교차 오염된다.
 * 어긋나면 기본 시작 별(복귀 플레이어의 currentStarId, 신규는 Sol)로 폴백한다.
 */
export function resolveDeepLinkStar(
  loadedSeed: Seed,
  defaultStarId: StarId,
  link: SystemLink,
): StarId {
  if (link.starId == null) return defaultStarId
  if (link.seed !== loadedSeed) return defaultStarId
  return starById(loadedSeed, link.starId) != null ? link.starId : defaultStarId
}

/**
 * 공유/딥링크 쿼리스트링을 만든다. Sol(시작 항성계)이면 star를 생략한다 (결정 L-1) —
 * Sol은 모든 시드의 기본 시작점이라 `?seed=`만으로 복원된다.
 *
 * starId는 항상 정수:정수:정수:정수(parseStarId 보장)라 URL-safe — 그대로 임베드한다.
 */
export function buildSystemQuery(seed: Seed, starId: StarId): string {
  const seedParam = `${SEED_PARAM}=${encodeURIComponent(seed)}`
  if (starId === SOL_STAR_ID) return `?${seedParam}`
  return `?${seedParam}&${STAR_PARAM}=${starId}`
}

function shareBase(): string {
  return `${window.location.origin}${window.location.pathname}`
}

/** 우주(시드) 전체 공유 링크 — 별 무관, 항상 `?seed=`. */
export function buildSeedShareUrl(seed: Seed): string {
  return `${shareBase()}?${SEED_PARAM}=${encodeURIComponent(seed)}`
}

/** 현재 항성계 공유 링크 — `?seed=&star=` (Sol이면 star 생략). */
export function buildSystemShareUrl(seed: Seed, starId: StarId): string {
  return `${shareBase()}${buildSystemQuery(seed, starId)}`
}

/**
 * 정박한 항성계를 주소창에 반영한다 — `history.replaceState` (push 금지: 워프마다
 * 히스토리 스택이 쌓여 뒤로가기 지옥이 된다, 결정 L-1). pathname·hash는 보존하고
 * 쿼리만 교체한다.
 */
export function syncSystemUrl(seed: Seed, starId: StarId): void {
  if (typeof window === 'undefined') return
  const query = buildSystemQuery(seed, starId)
  if (window.location.search === query) return
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${query}${window.location.hash}`)
}
