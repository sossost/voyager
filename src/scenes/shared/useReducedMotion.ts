import { useEffect, useState } from 'react'

/**
 * `prefers-reduced-motion: reduce` 구독 — 렌더 레이어(scenes/) 전용 a11y 훅.
 * 강착원반 회전 등 시간 애니메이션을 정지/정적으로 전환하는 데 쓴다
 * (광과민성·전정 민감성 배려). engine/ 순수성과 무관(브라우저 API는 scenes/에서 허용).
 */
const QUERY = '(prefers-reduced-motion: reduce)'

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches,
  )

  useEffect(() => {
    const media = window.matchMedia(QUERY)
    const onChange = (): void => setReduced(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  return reduced
}
