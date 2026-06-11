import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'

interface ContextLossGuardProps {
  onContextLost: () => void
  onContextRestored: () => void
}

/**
 * WebGL 컨텍스트 손실 감지 (02-decisions.md 결정 15, iOS Safari 컨텍스트 수 제한 대응).
 *
 * webglcontextlost에서 preventDefault()를 호출해야 브라우저가
 * webglcontextrestored로 복구를 시도한다. 복구가 오지 않으면
 * 부모(CanvasLayer)가 타임아웃 후 Canvas를 리마운트한다.
 */
export function ContextLossGuard({ onContextLost, onContextRestored }: ContextLossGuardProps) {
  const gl = useThree((state) => state.gl)

  useEffect(() => {
    const canvas = gl.domElement

    const handleLost = (event: Event) => {
      event.preventDefault()
      onContextLost()
    }

    canvas.addEventListener('webglcontextlost', handleLost)
    canvas.addEventListener('webglcontextrestored', onContextRestored)

    return () => {
      canvas.removeEventListener('webglcontextlost', handleLost)
      canvas.removeEventListener('webglcontextrestored', onContextRestored)
    }
  }, [gl, onContextLost, onContextRestored])

  return null
}
