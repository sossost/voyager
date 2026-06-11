/** 지수 백오프 재시도 간격 (결정 20). */
const RETRY_DELAYS_MS = [200, 600, 1_800] as const

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 모든 저장 쓰기의 단일 경로 — 백오프 3회 후 실패하면 onFailure로 알리고 끝낸다.
 * 게임 진행은 절대 차단하지 않는다 (호출자는 fire-and-forget).
 */
export async function persist(
  operation: () => Promise<void>,
  onFailure: (error: unknown) => void,
): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await operation()
      return
    } catch (error) {
      const delay = RETRY_DELAYS_MS[attempt]
      if (delay == null) {
        onFailure(error)
        return
      }
      await sleep(delay)
    }
  }
}
