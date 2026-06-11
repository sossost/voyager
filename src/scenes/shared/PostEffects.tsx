import { Bloom, EffectComposer } from '@react-three/postprocessing'

/**
 * high 티어 전용 포스트 이펙트 — 항성 발광·워프 플래시 블룸 (결정 12).
 * 동적 로드(lazy)되므로 medium/low 기기는 이 번들을 받지 않는다.
 */
export function PostEffects() {
  return (
    <EffectComposer>
      <Bloom intensity={0.55} luminanceThreshold={0.3} luminanceSmoothing={0.6} mipmapBlur />
    </EffectComposer>
  )
}

export default PostEffects
