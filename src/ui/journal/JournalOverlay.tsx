import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { starById } from '@/engine'
import type { VisitRecord } from '@/persistence/types'
import { getStorageDriver, useGameStore } from '@/store'
import { buildSeedShareUrl, buildSystemShareUrl } from '@/store/systemUrl'
import { SPECTRAL_LABELS } from '@/scenes/galaxy/spectral'
import { OverlayShell } from '@/ui/common/OverlayShell'

const PAGE_SIZE = 20

/** 복사 가능한 공유 링크 한 줄 — 우주(시드)·현재 항성계 공용 (백로그 L-1). */
function ShareLink({
  label,
  hint,
  url,
  successToast,
}: {
  readonly label: string
  readonly hint: string
  readonly url: string
  readonly successToast: string
}) {
  const pushToast = useGameStore((state) => state.pushToast)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      pushToast(successToast)
    } catch {
      pushToast('복사에 실패했어요 — 주소를 직접 선택해 주세요')
    }
  }

  return (
    <section className="seed-share" aria-label={label}>
      <p className="seed-share-hint">{hint}</p>
      <div className="seed-share-row">
        <input className="seed-input" readOnly value={url} aria-label={`${label} 링크`} />
        <button type="button" className="hud-button" onClick={() => void handleCopy()}>
          복사
        </button>
      </div>
    </section>
  )
}

function ShareLinks() {
  const seed = useGameStore((state) => state.seed)
  const currentStarId = useGameStore((state) => state.currentStarId)
  const currentStar = starById(seed, currentStarId)
  const systemName = currentStar?.name ?? '현재 항성계'

  return (
    <>
      <ShareLink
        label="우주 공유"
        hint="같은 시드는 같은 우주 — 친구가 이 링크로 접속하면 같은 좌표에서 같은 생명체를 발견합니다."
        url={buildSeedShareUrl(seed)}
        successToast="우주 공유 링크를 복사했어요"
      />
      <ShareLink
        label="현재 항성계 공유"
        hint={`이 링크는 ${systemName}로 바로 안내합니다 — 친구가 지금 보고 있는 이 항성계에서 시작합니다.`}
        url={buildSystemShareUrl(seed, currentStarId)}
        successToast="현재 항성계 공유 링크를 복사했어요"
      />
    </>
  )
}

/** 일지 항목 한 줄 — 방문 별 정보 + (현재 위치가 아니면) 그 항성계로 워프 (백로그 L-2). */
function VisitEntry({
  visit,
  isCurrent,
  formattedTime,
}: {
  readonly visit: VisitRecord
  readonly isCurrent: boolean
  readonly formattedTime: string
}) {
  const seed = useGameStore((state) => state.seed)
  const warpTo = useGameStore((state) => state.warpTo)
  const closeOverlay = useGameStore((state) => state.closeOverlay)
  const star = starById(seed, visit.starId)
  const starName = star?.name ?? visit.starId

  // 일지를 닫고 기존 워프 파이프라인 재사용 — 새 항법 경로가 아니다 (결정 41 5박자 시퀀스 그대로).
  const handleWarp = () => {
    closeOverlay()
    warpTo(visit.starId)
  }

  // 워프 버튼은 별이 결정론으로 복원되고(같은 시드) 현재 위치가 아닐 때만 — 현재 별은 배지로 대체.
  const canWarp = star != null && !isCurrent

  return (
    <li className="visit-entry">
      <div className="visit-entry-star">
        <strong>{starName}</strong>
        {star != null ? (
          <span className="visit-entry-spectral">{SPECTRAL_LABELS[star.spectral]}</span>
        ) : null}
        {isCurrent ? <span className="badge badge-current">현재 위치</span> : null}
      </div>
      <div className="visit-entry-aside">
        <time className="visit-entry-time">{formattedTime}</time>
        {canWarp ? (
          <button
            type="button"
            className="hud-button hud-button-primary"
            onClick={handleWarp}
            aria-label={`${starName}로 항행`}
          >
            항행
          </button>
        ) : null}
      </div>
    </li>
  )
}

function VisitTimeline() {
  const currentStarId = useGameStore((state) => state.currentStarId)
  const [visits, setVisits] = useState<readonly VisitRecord[]>([])
  const [isExhausted, setIsExhausted] = useState(false)
  const dateFormat = useMemo(
    () => new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }),
    [],
  )

  // 일지는 전체를 store에 들고 있지 않는다 — 어댑터 페이징 (결정 19, 메모리 폭주 방지)
  const isLoadingRef = useRef(false)
  const loadMore = useCallback(async (offset: number) => {
    // 인플라이트 가드 — '더 보기' 연타 시 같은 페이지 중복 추가 방지 (코드 리뷰 지적)
    if (isLoadingRef.current) return
    isLoadingRef.current = true
    try {
      const page = await getStorageDriver().listVisits({ offset, limit: PAGE_SIZE })
      // offset 0은 교체 — StrictMode 이중 실행에도 멱등
      setVisits((previous) => (offset === 0 ? page : [...previous, ...page]))
      if (page.length < PAGE_SIZE) setIsExhausted(true)
    } finally {
      isLoadingRef.current = false
    }
  }, [])

  useEffect(() => {
    void loadMore(0)
  }, [loadMore])

  return (
    <section aria-label="방문 타임라인">
      <h3 className="journal-subtitle">방문 기록</h3>
      <ol className="visit-timeline">
        {visits.map((visit) => (
          <VisitEntry
            key={visit.starId}
            visit={visit}
            isCurrent={visit.starId === currentStarId}
            formattedTime={dateFormat.format(visit.visitedAt)}
          />
        ))}
      </ol>
      {!isExhausted ? (
        <button type="button" className="hud-button" onClick={() => void loadMore(visits.length)}>
          더 보기
        </button>
      ) : null}
    </section>
  )
}

/** 탐사 일지 (z-20 오버레이) — 타임라인 페이징 + 시드 공유. */
export function JournalOverlay() {
  const isOpen = useGameStore((state) => state.overlay === 'journal')
  const closeOverlay = useGameStore((state) => state.closeOverlay)

  if (!isOpen) return null

  return (
    <OverlayShell title="탐사 일지" onClose={closeOverlay}>
      <ShareLinks />
      <VisitTimeline />
    </OverlayShell>
  )
}
