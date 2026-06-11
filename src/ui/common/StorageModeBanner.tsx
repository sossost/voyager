import { useGameStore } from '@/store'

/** 메모리 모드 상시 경고 (z-30) — IndexedDB를 쓸 수 없는 환경 (스펙 에러 케이스). */
export function StorageModeBanner() {
  const isMemoryMode = useGameStore((state) => state.storageMode === 'memory')

  if (!isMemoryMode) return null

  return (
    <div className="storage-banner" role="status">
      이 환경에서는 기록이 저장되지 않아요 — 세션이 끝나면 탐사 기록이 사라집니다
    </div>
  )
}
