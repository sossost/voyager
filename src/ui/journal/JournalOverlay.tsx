import { useCallback, useEffect, useMemo, useState } from 'react'

import { starById } from '@/engine'
import type { VisitRecord } from '@/persistence/types'
import { getStorageDriver, useGameStore } from '@/store'
import { SPECTRAL_LABELS } from '@/scenes/galaxy/spectral'
import { OverlayShell } from '@/ui/common/OverlayShell'

const PAGE_SIZE = 20

function SeedShare() {
  const seed = useGameStore((state) => state.seed)
  const pushToast = useGameStore((state) => state.pushToast)
  const shareUrl = `${window.location.origin}${window.location.pathname}?seed=${seed}`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      pushToast('우주 공유 링크를 복사했어요')
    } catch {
      pushToast('복사에 실패했어요 — 주소를 직접 선택해 주세요')
    }
  }

  return (
    <section className="seed-share" aria-label="시드 공유">
      <p className="seed-share-hint">
        같은 시드는 같은 우주 — 친구가 이 링크로 접속하면 같은 좌표에서 같은 생명체를
        발견합니다.
      </p>
      <div className="seed-share-row">
        <input className="seed-input" readOnly value={shareUrl} aria-label="공유 링크" />
        <button type="button" className="hud-button" onClick={() => void handleCopy()}>
          복사
        </button>
      </div>
    </section>
  )
}

function VisitTimeline() {
  const seed = useGameStore((state) => state.seed)
  const currentStarId = useGameStore((state) => state.currentStarId)
  const [visits, setVisits] = useState<readonly VisitRecord[]>([])
  const [isExhausted, setIsExhausted] = useState(false)
  const dateFormat = useMemo(
    () => new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }),
    [],
  )

  // 일지는 전체를 store에 들고 있지 않는다 — 어댑터 페이징 (결정 19, 메모리 폭주 방지)
  const loadMore = useCallback(async (offset: number) => {
    const page = await getStorageDriver().listVisits({ offset, limit: PAGE_SIZE })
    // offset 0은 교체 — StrictMode 이중 실행에도 멱등
    setVisits((previous) => (offset === 0 ? page : [...previous, ...page]))
    if (page.length < PAGE_SIZE) setIsExhausted(true)
  }, [])

  useEffect(() => {
    void loadMore(0)
  }, [loadMore])

  return (
    <section aria-label="방문 타임라인">
      <h3 className="journal-subtitle">방문 기록</h3>
      <ol className="visit-timeline">
        {visits.map((visit) => {
          const star = starById(seed, visit.starId)
          return (
            <li key={visit.starId} className="visit-entry">
              <div className="visit-entry-star">
                <strong>{star?.name ?? visit.starId}</strong>
                {star != null ? (
                  <span className="visit-entry-spectral">{SPECTRAL_LABELS[star.spectral]}</span>
                ) : null}
                {visit.starId === currentStarId ? (
                  <span className="badge badge-current">현재 위치</span>
                ) : null}
              </div>
              <time className="visit-entry-time">{dateFormat.format(visit.visitedAt)}</time>
            </li>
          )
        })}
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
      <SeedShare />
      <VisitTimeline />
    </OverlayShell>
  )
}
